import io
import os
from pathlib import Path

from docx import Document
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from PyPDF2 import PdfReader
from qdrant_client.models import FieldCondition, Filter, MatchAny
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import Client, create_client

from models.database import AsyncSessionLocal, DataSource, Workspace, get_db
from models.schemas import DataSourceResponse, IntegrationAmplitudeRequest, IntegrationJiraRequest
from services.amplitude import aggregate_events, events_to_chunks, fetch_last_30_days_events, test_amplitude_connection
from services.embeddings import ensure_collection, ingest_knowledge, qdrant_client
from services.errors import bad_request, not_found, processing_error
from services.jira import fetch_recent_issues, issue_to_chunk, test_jira_connection
from services.whisper import transcribe_audio

router = APIRouter(prefix="/ingest", tags=["ingest"])

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".mp3", ".mp4"}
MAX_FILE_BYTES = 50 * 1024 * 1024


def supabase_client() -> Client:
    return create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_SERVICE_KEY", ""))


def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension == ".txt":
        return file_bytes.decode("utf-8", errors="ignore")
    if extension == ".pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    if extension == ".docx":
        document = Document(io.BytesIO(file_bytes))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    raise processing_error("Unsupported file type for text extraction.")


async def process_uploaded_file(
    data_source_id: str,
    workspace_id: str,
    source_type: str,
    filename: str,
    file_bytes: bytes,
):
    async with AsyncSessionLocal() as db:
        data_source = await db.scalar(select(DataSource).where(DataSource.id == data_source_id))
        if data_source is None:
            return

        try:
            extension = Path(filename).suffix.lower()
            if extension in {".mp3", ".mp4"}:
                text = await transcribe_audio(filename, file_bytes)
            else:
                text = extract_text_from_file(filename, file_bytes)

            chunk_count = await ingest_knowledge(
                workspace_id=workspace_id,
                data_source_id=data_source_id,
                source_type=source_type,
                source_name=filename,
                text=text,
                metadata={"filename": filename},
            )
            data_source.status = "ready"
            data_source.metadata_json = {**(data_source.metadata_json or {}), "chunks_ingested": chunk_count}
            await db.commit()
        except Exception as exc:
            data_source.status = "error"
            data_source.metadata_json = {**(data_source.metadata_json or {}), "error": str(exc)}
            await db.commit()


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    workspace_id: str = Form(...),
    source_type: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    workspace = await db.scalar(select(Workspace).where(Workspace.id == workspace_id))
    if workspace is None:
        raise not_found("Workspace not found.")

    extension = Path(file.filename or "").suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise bad_request("Supported formats: PDF, DOCX, TXT, MP3, MP4")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_BYTES:
        raise bad_request("File must be under 50MB")

    file_path = f"{workspace_id}/{source_type}/{file.filename}"
    supabase = supabase_client()
    supabase.storage.from_("uploads").upload(file=file_bytes, path=file_path, file_options={"content-type": file.content_type})

    data_source = DataSource(
        workspace_id=workspace_id,
        type=source_type,
        source="upload",
        name=file.filename or "uploaded-file",
        status="processing",
        metadata_json={"size_bytes": len(file_bytes)},
        file_path=file_path,
    )
    db.add(data_source)
    await db.commit()
    await db.refresh(data_source)

    background_tasks.add_task(
        process_uploaded_file,
        str(data_source.id),
        workspace_id,
        source_type,
        file.filename or "uploaded-file",
        file_bytes,
    )
    return {"data_source_id": str(data_source.id), "status": "processing"}


@router.get("/sources/{workspace_id}", response_model=list[DataSourceResponse])
async def list_sources(workspace_id: str, db: AsyncSession = Depends(get_db)):
    rows = (
        (await db.scalars(select(DataSource).where(DataSource.workspace_id == workspace_id).order_by(DataSource.created_at.desc())))
        .all()
    )
    return [
        DataSourceResponse(
            id=str(row.id),
            workspace_id=str(row.workspace_id),
            type=row.type,
            source=row.source,
            name=row.name,
            status=row.status,
            metadata=row.metadata_json or {},
            file_path=row.file_path,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/connect/amplitude")
async def connect_amplitude(payload: IntegrationAmplitudeRequest, db: AsyncSession = Depends(get_db)):
    workspace = await db.scalar(select(Workspace).where(Workspace.id == payload.workspace_id))
    if workspace is None:
        raise not_found("Workspace not found.")

    try:
        await test_amplitude_connection(payload.api_key, payload.secret_key)
        raw_events = await fetch_last_30_days_events(payload.api_key, payload.secret_key)
        aggregates = aggregate_events(raw_events)
        chunks = events_to_chunks(aggregates)
    except Exception as exc:
        raise processing_error("Could not connect to Amplitude. Check your credentials and try again.") from exc

    data_source = DataSource(
        workspace_id=payload.workspace_id,
        type="usage_data",
        source="amplitude",
        name="Amplitude events",
        status="processing",
        metadata_json={"events_synced": len(aggregates)},
    )
    db.add(data_source)
    await db.commit()
    await db.refresh(data_source)

    await ingest_knowledge(
        workspace_id=payload.workspace_id,
        data_source_id=str(data_source.id),
        source_type="usage_data",
        source_name="Amplitude events",
        text="\n\n".join(chunks),
        metadata={"provider": "amplitude"},
        chunk_type="usage_metric",
    )

    data_source.status = "ready"
    await db.commit()
    return {"success": True, "events_synced": len(aggregates)}


@router.post("/connect/jira")
async def connect_jira(payload: IntegrationJiraRequest, db: AsyncSession = Depends(get_db)):
    workspace = await db.scalar(select(Workspace).where(Workspace.id == payload.workspace_id))
    if workspace is None:
        raise not_found("Workspace not found.")

    try:
        await test_jira_connection(payload.jira_url, payload.email, payload.api_token)
        issues = await fetch_recent_issues(payload.jira_url, payload.email, payload.api_token)
        chunks = [issue_to_chunk(issue) for issue in issues]
    except Exception as exc:
        raise processing_error("Could not connect to Jira. Check your credentials and URL.") from exc

    data_source = DataSource(
        workspace_id=payload.workspace_id,
        type="ticket",
        source="jira",
        name="Jira issues",
        status="processing",
        metadata_json={"tickets_synced": len(issues)},
    )
    db.add(data_source)
    await db.commit()
    await db.refresh(data_source)

    await ingest_knowledge(
        workspace_id=payload.workspace_id,
        data_source_id=str(data_source.id),
        source_type="ticket",
        source_name="Jira issues",
        text="\n\n".join(chunks),
        metadata={"provider": "jira"},
        chunk_type="decision",
    )
    data_source.status = "ready"
    await db.commit()
    return {"success": True, "tickets_synced": len(issues)}


@router.delete("/connect/{workspace_id}/{source}")
async def disconnect_integration(workspace_id: str, source: str, db: AsyncSession = Depends(get_db)):
    rows = (
        (await db.scalars(select(DataSource).where(DataSource.workspace_id == workspace_id, DataSource.source == source))).all()
    )
    if not rows:
        raise not_found("Integration not found.")

    collection_name = ensure_collection(workspace_id)
    data_source_ids = [row.id for row in rows]
    try:
        qdrant_client.delete(
            collection_name=collection_name,
            points_selector=Filter(must=[FieldCondition(key="data_source_id", match=MatchAny(any=data_source_ids))]),
        )
    except Exception:
        pass

    for row in rows:
        await db.delete(row)
    await db.commit()
    return {"success": True}
