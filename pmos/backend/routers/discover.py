import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Opportunity, Workspace, get_db
from models.schemas import DiscoverRequest, OpportunityResponse, OpportunityUpdateRequest
from prompts.discovery import DISCOVERY_PROMPT
from services.claude import generate_json, stream_text
from services.errors import not_found, processing_error
from services.retrieval import build_context, hybrid_search

router = APIRouter(prefix="/discover", tags=["discover"])


def serialize_opportunity(opportunity: Opportunity) -> OpportunityResponse:
    return OpportunityResponse(
        id=str(opportunity.id),
        workspace_id=str(opportunity.workspace_id),
        title=opportunity.title,
        summary=opportunity.summary,
        evidence=opportunity.evidence or [],
        frequency_score=opportunity.frequency_score or 0,
        severity_score=opportunity.severity_score or 0,
        strategic_alignment_score=opportunity.strategic_alignment_score or 0,
        effort_estimate=opportunity.effort_estimate or "M",
        why_now=opportunity.why_now,
        affected_segment=opportunity.affected_segment,
        status=opportunity.status,
        created_at=opportunity.created_at,
    )


async def persist_opportunities(db: AsyncSession, workspace_id: str, payload: dict) -> list[Opportunity]:
    inserted: list[Opportunity] = []
    for item in payload.get("opportunities", []):
        row = Opportunity(
            workspace_id=workspace_id,
            title=item["title"],
            summary=item["summary"],
            evidence=item.get("evidence", []),
            frequency_score=item.get("frequency_score"),
            severity_score=item.get("severity_score"),
            strategic_alignment_score=item.get("strategic_alignment_score"),
            effort_estimate=item.get("effort_estimate"),
            why_now=item.get("why_now"),
            affected_segment=item.get("affected_segment"),
        )
        db.add(row)
        inserted.append(row)
    await db.commit()
    for row in inserted:
        await db.refresh(row)
    return inserted


@router.post("")
async def run_discovery(payload: DiscoverRequest, db: AsyncSession = Depends(get_db)):
    workspace = await db.scalar(select(Workspace).where(Workspace.id == payload.workspace_id))
    if workspace is None:
        raise not_found("Workspace not found.")

    query = payload.query or "What are the most important problems our users face that we should solve next?"
    chunks = await hybrid_search(
        workspace_id=payload.workspace_id,
        query=query,
        limit=40,
        source_types=["interview", "review", "ticket", "usage_data"],
    )
    if not chunks:
        raise processing_error("No customer signals found yet. Upload interviews or connect integrations first.")

    context = build_context(chunks, limit=30)
    prompt = DISCOVERY_PROMPT.format(
        context=context,
        strategic_context=json.dumps(workspace.strategic_context or {}, indent=2),
    )

    if payload.stream:
        async def event_stream():
            buffer: list[str] = []
            async for text in stream_text(prompt):
                buffer.append(text)
                yield f"data: {json.dumps({'chunk': text})}\n\n"
            parsed = json.loads("".join(buffer))
            await persist_opportunities(db, payload.workspace_id, parsed)
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    parsed = await generate_json(prompt)
    opportunities = await persist_opportunities(db, payload.workspace_id, parsed)
    return {"opportunities": [serialize_opportunity(item).model_dump() for item in opportunities]}


@router.get("/{workspace_id}", response_model=list[OpportunityResponse])
async def get_opportunities(workspace_id: str, db: AsyncSession = Depends(get_db)):
    score = (
        (Opportunity.frequency_score * 0.35)
        + (Opportunity.severity_score * 0.35)
        + (Opportunity.strategic_alignment_score * 0.30)
    )
    rows = (
        (
            await db.scalars(
                select(Opportunity)
                .where(Opportunity.workspace_id == workspace_id)
                .order_by(desc(score), desc(Opportunity.created_at))
            )
        )
        .all()
    )
    return [serialize_opportunity(row) for row in rows]


@router.patch("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: str,
    payload: OpportunityUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    row = await db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if row is None:
        raise not_found("Opportunity not found.")
    row.status = payload.status
    await db.commit()
    await db.refresh(row)
    return serialize_opportunity(row)
