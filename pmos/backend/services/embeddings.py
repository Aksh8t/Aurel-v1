import os
import uuid
from datetime import datetime

from dotenv import load_dotenv
from openai import AsyncOpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from models.database import AsyncSessionLocal, KnowledgeChunk

load_dotenv()

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
qdrant_client = QdrantClient(
    host=os.getenv("QDRANT_HOST", "localhost"),
    port=int(os.getenv("QDRANT_PORT", "6333")),
)


def ensure_collection(workspace_id: str) -> str:
    collection_name = f"{workspace_id}_knowledge"
    try:
        qdrant_client.get_collection(collection_name)
    except Exception:
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
        )
    return collection_name


def split_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + chunk_size)
        chunk = " ".join(words[start:end]).strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(words):
            break
        start = max(0, end - overlap)
    return chunks


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    response = await openai_client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [item.embedding for item in response.data]


async def embed_text(text: str) -> list[float]:
    vectors = await embed_texts([text])
    return vectors[0]


async def ingest_knowledge(
    workspace_id: str,
    data_source_id: str,
    source_type: str,
    source_name: str,
    text: str,
    metadata: dict | None = None,
    chunk_type: str = "pain_point",
) -> int:
    chunks = split_text(text)
    if not chunks:
        return 0

    vectors = await embed_texts(chunks)
    collection_name = ensure_collection(workspace_id)
    points: list[PointStruct] = []
    knowledge_rows: list[KnowledgeChunk] = []
    created_at = datetime.utcnow().isoformat()

    for chunk, vector in zip(chunks, vectors, strict=False):
        qdrant_id = str(uuid.uuid4())
        chunk_id = str(uuid.uuid4())
        payload = {
            "chunk_id": chunk_id,
            "workspace_id": workspace_id,
            "data_source_id": data_source_id,
            "source_type": source_type,
            "source_name": source_name,
            "text": chunk,
            "created_at": created_at,
            **(metadata or {}),
        }
        points.append(PointStruct(id=qdrant_id, vector=vector, payload=payload))
        knowledge_rows.append(
            KnowledgeChunk(
                id=chunk_id,
                workspace_id=workspace_id,
                data_source_id=data_source_id,
                content=chunk,
                chunk_type=chunk_type,
                metadata_json=metadata or {},
                qdrant_id=qdrant_id,
            )
        )

    qdrant_client.upsert(collection_name=collection_name, points=points)

    async with AsyncSessionLocal() as session:
        session.add_all(knowledge_rows)
        await session.commit()

    return len(chunks)
