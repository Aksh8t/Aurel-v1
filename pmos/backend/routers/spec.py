import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Opportunity, Spec, get_db
from models.schemas import SpecGenerateRequest, SpecResponse, SpecReviseRequest, SpecUpdateRequest
from prompts.spec import SPECIFICATION_PROMPT
from services.claude import generate_json, stream_text
from services.errors import not_found
from services.retrieval import build_context, hybrid_search

router = APIRouter(prefix="/spec", tags=["spec"])

REVISION_TEMPLATE = """
Revise only the "{section}" section of the following product specification.

CURRENT SECTION CONTENT:
{current_content}

REVISION INSTRUCTION:
{instruction}

Return valid JSON only:
{{
  "section": "{section}",
  "revised_content": "updated section content"
}}
"""


def serialize_spec(spec: Spec) -> SpecResponse:
    return SpecResponse(
        id=str(spec.id),
        workspace_id=str(spec.workspace_id),
        opportunity_id=str(spec.opportunity_id) if spec.opportunity_id else None,
        title=spec.title,
        status=spec.status,
        problem_statement=spec.problem_statement,
        proposed_solution=spec.proposed_solution,
        success_metrics=spec.success_metrics or [],
        user_stories=spec.user_stories or [],
        ui_changes=spec.ui_changes or [],
        data_model_changes=spec.data_model_changes or [],
        workflow_changes=spec.workflow_changes or [],
        out_of_scope=spec.out_of_scope,
        open_questions=spec.open_questions or [],
        created_at=spec.created_at,
        updated_at=spec.updated_at,
    )


async def save_spec_from_payload(db: AsyncSession, workspace_id: str, opportunity_id: str, payload: dict) -> Spec:
    spec = Spec(
        workspace_id=workspace_id,
        opportunity_id=opportunity_id,
        title=payload["title"],
        status="draft",
        problem_statement=payload.get("problem_statement"),
        proposed_solution=payload.get("proposed_solution"),
        success_metrics=payload.get("success_metrics", []),
        user_stories=payload.get("user_stories", []),
        ui_changes=payload.get("ui_changes", []),
        data_model_changes=payload.get("data_model_changes", []),
        workflow_changes=payload.get("workflow_changes", []),
        out_of_scope=payload.get("out_of_scope"),
        open_questions=payload.get("open_questions", []),
    )
    db.add(spec)
    opportunity = await db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if opportunity:
        opportunity.status = "specced"
    await db.commit()
    await db.refresh(spec)
    return spec


@router.post("/generate")
async def generate_spec(payload: SpecGenerateRequest, db: AsyncSession = Depends(get_db)):
    opportunity = await db.scalar(
        select(Opportunity).where(
            Opportunity.id == payload.opportunity_id,
            Opportunity.workspace_id == payload.workspace_id,
        )
    )
    if opportunity is None:
        raise not_found("Opportunity not found.")

    related_chunks = await hybrid_search(payload.workspace_id, opportunity.title, limit=20)
    prd_chunks = await hybrid_search(payload.workspace_id, opportunity.title, limit=10, source_types=["prd"])
    context = build_context(related_chunks + prd_chunks, limit=30)
    prompt = SPECIFICATION_PROMPT.format(
        opportunity=json.dumps(
            {
                "title": opportunity.title,
                "summary": opportunity.summary,
                "why_now": opportunity.why_now,
                "affected_segment": opportunity.affected_segment,
            },
            indent=2,
        ),
        evidence=json.dumps(opportunity.evidence or [], indent=2),
        context=context,
    )

    if payload.stream:
        async def event_stream():
            buffer: list[str] = []
            async for text in stream_text(prompt):
                buffer.append(text)
                yield f"data: {json.dumps({'chunk': text})}\n\n"
            parsed = json.loads("".join(buffer))
            spec = await save_spec_from_payload(db, payload.workspace_id, payload.opportunity_id, parsed)
            yield f"data: {json.dumps({'done': True, 'spec_id': str(spec.id)})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    parsed = await generate_json(prompt)
    spec = await save_spec_from_payload(db, payload.workspace_id, payload.opportunity_id, parsed)
    return serialize_spec(spec)


@router.get("/workspace/{workspace_id}", response_model=list[SpecResponse])
async def get_specs_for_workspace(workspace_id: str, db: AsyncSession = Depends(get_db)):
    rows = (
        (await db.scalars(select(Spec).where(Spec.workspace_id == workspace_id).order_by(desc(Spec.updated_at)))).all()
    )
    return [serialize_spec(row) for row in rows]


@router.get("/{spec_id}", response_model=SpecResponse)
async def get_spec(spec_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(Spec).where(Spec.id == spec_id))
    if row is None:
        raise not_found("Spec not found.")
    return serialize_spec(row)


@router.patch("/{spec_id}", response_model=SpecResponse)
async def update_spec(spec_id: str, payload: SpecUpdateRequest, db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(Spec).where(Spec.id == spec_id))
    if row is None:
        raise not_found("Spec not found.")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return serialize_spec(row)


@router.post("/{spec_id}/revise")
async def revise_spec_section(spec_id: str, payload: SpecReviseRequest, db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(Spec).where(Spec.id == spec_id))
    if row is None:
        raise not_found("Spec not found.")

    current_content = getattr(row, payload.section, None)
    if current_content is None:
        raise not_found("Spec section not found.")

    revised = await generate_json(
        REVISION_TEMPLATE.format(
            section=payload.section,
            current_content=json.dumps(current_content, indent=2) if isinstance(current_content, (list, dict)) else current_content,
            instruction=payload.instruction,
        ),
        max_tokens=1800,
    )
    setattr(row, payload.section, revised["revised_content"])
    await db.commit()
    return {"section": payload.section, "revised_content": revised["revised_content"]}


@router.post("/{spec_id}/approve", response_model=SpecResponse)
async def approve_spec(spec_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(Spec).where(Spec.id == spec_id))
    if row is None:
        raise not_found("Spec not found.")
    row.status = "approved"
    await db.commit()
    await db.refresh(row)
    return serialize_spec(row)
