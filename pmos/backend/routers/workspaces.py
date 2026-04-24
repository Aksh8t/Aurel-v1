from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import DataSource, Opportunity, Spec, Task, Workspace, get_db
from models.schemas import (
    ActivityItem,
    DashboardResponse,
    DashboardStats,
    WorkspaceCreateRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)
from services.errors import not_found

router = APIRouter(tags=["workspaces"])


def serialize_workspace(workspace: Workspace) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=str(workspace.id),
        name=workspace.name,
        owner_id=str(workspace.owner_id) if workspace.owner_id else None,
        strategic_context=workspace.strategic_context or {},
        created_at=workspace.created_at,
    )


@router.post("/workspaces", response_model=WorkspaceResponse)
async def create_workspace(payload: WorkspaceCreateRequest, db: AsyncSession = Depends(get_db)):
    workspace = Workspace(name=payload.name, owner_id=payload.owner_id, strategic_context={})
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    return serialize_workspace(workspace)


@router.get("/workspaces/by-owner/{owner_id}", response_model=WorkspaceResponse)
async def get_workspace_by_owner(owner_id: str, db: AsyncSession = Depends(get_db)):
    workspace = await db.scalar(select(Workspace).where(Workspace.owner_id == owner_id))
    if workspace is None:
        raise not_found("Workspace not found for this user.")
    return serialize_workspace(workspace)


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    workspace = await db.scalar(select(Workspace).where(Workspace.id == workspace_id))
    if workspace is None:
        raise not_found("Workspace not found.")

    if payload.name is not None:
        workspace.name = payload.name
    if payload.strategic_context is not None:
        workspace.strategic_context = payload.strategic_context

    await db.commit()
    await db.refresh(workspace)
    return serialize_workspace(workspace)


@router.get("/workspaces/{workspace_id}/dashboard", response_model=DashboardResponse)
async def get_workspace_dashboard(workspace_id: str, db: AsyncSession = Depends(get_db)):
    workspace = await db.scalar(select(Workspace).where(Workspace.id == workspace_id))
    if workspace is None:
        raise not_found("Workspace not found.")

    data_sources = (
        (
            await db.scalars(
                select(DataSource).where(DataSource.workspace_id == workspace_id).order_by(desc(DataSource.created_at))
            )
        )
        .all()
    )
    opportunities = (
        (
            await db.scalars(
                select(Opportunity).where(Opportunity.workspace_id == workspace_id, Opportunity.status == "active")
            )
        )
        .all()
    )
    specs = (
        (await db.scalars(select(Spec).where(Spec.workspace_id == workspace_id).order_by(desc(Spec.created_at)))).all()
    )
    tasks = (
        (await db.scalars(select(Task).where(Task.workspace_id == workspace_id).order_by(desc(Task.created_at)))).all()
    )

    activities: list[ActivityItem] = []
    for source in data_sources[:4]:
        activities.append(ActivityItem(id=str(source.id), type="upload", title=source.name, created_at=source.created_at))
    for opportunity in opportunities[:3]:
        activities.append(
            ActivityItem(
                id=str(opportunity.id),
                type="discovery",
                title=opportunity.title,
                created_at=opportunity.created_at,
            )
        )
    for spec in specs[:3]:
        activities.append(ActivityItem(id=str(spec.id), type="spec", title=spec.title, created_at=spec.created_at))
    for task in tasks[:3]:
        activities.append(ActivityItem(id=str(task.id), type="task", title=task.title, created_at=task.created_at))

    activities.sort(key=lambda item: item.created_at or datetime.min, reverse=True)

    integrations = sorted({source.source for source in data_sources if source.source != "upload"})

    return DashboardResponse(
        workspace=serialize_workspace(workspace),
        stats=DashboardStats(
            total_customer_signals=len(data_sources),
            interviews_processed=sum(1 for source in data_sources if source.type == "interview" and source.status == "ready"),
            open_opportunities=len(opportunities),
            specs_in_draft=sum(1 for spec in specs if spec.status == "draft"),
        ),
        data_sources=[
            {
                "id": str(source.id),
                "workspace_id": str(source.workspace_id),
                "type": source.type,
                "source": source.source,
                "name": source.name,
                "status": source.status,
                "metadata": source.metadata_json or {},
                "file_path": source.file_path,
                "created_at": source.created_at,
            }
            for source in data_sources
        ],
        recent_activity=activities[:10],
        integrations=integrations,
    )
