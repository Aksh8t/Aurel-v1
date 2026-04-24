from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Spec, Task, get_db
from models.schemas import TaskGenerateRequest, TaskResponse, TasksExportJiraRequest, TasksGenerateResponse
from prompts.tasks import HANDOFF_PROMPT
from services.claude import generate_json
from services.errors import not_found
from services.jira import create_jira_issue

router = APIRouter(prefix="/tasks", tags=["tasks"])


def serialize_task(task: Task) -> TaskResponse:
    return TaskResponse(
        id=str(task.id),
        spec_id=str(task.spec_id),
        workspace_id=str(task.workspace_id) if task.workspace_id else None,
        title=task.title,
        type=task.type or "backend",
        context=task.context or "",
        acceptance_criteria=task.acceptance_criteria or [],
        constraints=task.constraints or "",
        dependencies=task.dependencies or [],
        effort_estimate=task.effort_estimate or "4h",
        likely_files=task.likely_files or [],
        test_cases=task.test_cases or [],
        jira_ticket_id=task.jira_ticket_id,
        status=task.status,
        display_order=task.display_order,
        created_at=task.created_at,
    )


@router.post("/generate", response_model=TasksGenerateResponse)
async def generate_tasks(payload: TaskGenerateRequest, db: AsyncSession = Depends(get_db)):
    spec = await db.scalar(select(Spec).where(Spec.id == payload.spec_id))
    if spec is None:
        raise not_found("Spec not found.")

    prompt = HANDOFF_PROMPT.format(
        spec={
            "title": spec.title,
            "problem_statement": spec.problem_statement,
            "proposed_solution": spec.proposed_solution,
            "success_metrics": spec.success_metrics,
            "user_stories": spec.user_stories,
            "ui_changes": spec.ui_changes,
            "data_model_changes": spec.data_model_changes,
            "workflow_changes": spec.workflow_changes,
            "out_of_scope": spec.out_of_scope,
            "open_questions": spec.open_questions,
        }
    )
    response = await generate_json(prompt)

    await db.execute(delete(Task).where(Task.spec_id == payload.spec_id))
    tasks: list[Task] = []
    for index, item in enumerate(response.get("tasks", []), start=1):
        task = Task(
            spec_id=spec.id,
            workspace_id=spec.workspace_id,
            title=item["title"],
            type=item.get("type"),
            context=item.get("context"),
            acceptance_criteria=item.get("acceptance_criteria", []),
            constraints=item.get("constraints"),
            dependencies=item.get("dependencies", []),
            effort_estimate=item.get("effort_estimate"),
            likely_files=item.get("likely_files", []),
            test_cases=item.get("test_cases", []),
            display_order=index,
        )
        db.add(task)
        tasks.append(task)

    await db.commit()
    for task in tasks:
        await db.refresh(task)

    return TasksGenerateResponse(
        tasks=[serialize_task(task) for task in tasks],
        suggested_sprint_split=response.get("suggested_sprint_split", {"mvp": [], "full_rollout": []}),
        cursor_context_summary=response.get("cursor_context_summary", ""),
    )


@router.post("/export/jira")
async def export_tasks_to_jira(payload: TasksExportJiraRequest, db: AsyncSession = Depends(get_db)):
    rows = (
        (await db.scalars(select(Task).where(Task.id.in_(payload.task_ids)).order_by(Task.display_order.asc()))).all()
    )
    if not rows:
        raise not_found("No tasks found for export.")

    tickets = []
    for row in rows:
        jira_issue = await create_jira_issue(
            jira_url=payload.jira_config.url,
            email=payload.jira_config.email,
            api_token=payload.jira_config.api_token,
            project_key=payload.jira_config.project_key,
            task=serialize_task(row).model_dump(),
        )
        row.jira_ticket_id = jira_issue["key"]
        tickets.append(
            {
                "task_id": str(row.id),
                "jira_key": jira_issue["key"],
                "jira_url": f"{payload.jira_config.url.rstrip('/')}/browse/{jira_issue['key']}",
            }
        )

    await db.commit()
    return {"exported": len(tickets), "tickets": tickets}


@router.get("/{task_id}/cursor-prompt")
async def cursor_prompt(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.scalar(select(Task).where(Task.id == task_id))
    if task is None:
        raise not_found("Task not found.")

    dependency_titles: list[str] = []
    if task.dependencies:
        dependency_rows = (
            (await db.scalars(select(Task).where(Task.spec_id == task.spec_id, Task.title.in_(task.dependencies)))).all()
        )
        dependency_titles = [row.title for row in dependency_rows]

    acceptance = "\n".join(f"- [ ] {item}" for item in task.acceptance_criteria)
    dependencies = "\n".join(dependency_titles) if dependency_titles else "None"
    prompt = f"""## Context
{task.context or ''}

## What to build
{task.title}

## Acceptance criteria
{acceptance}

## Constraints
{task.constraints or ''}

## Dependencies (must be done first)
{dependencies}
"""
    return {"prompt": prompt}


@router.get("/{spec_id}", response_model=list[TaskResponse])
async def get_tasks(spec_id: str, db: AsyncSession = Depends(get_db)):
    rows = (
        (await db.scalars(select(Task).where(Task.spec_id == spec_id).order_by(Task.display_order.asc()))).all()
    )
    return [serialize_task(row) for row in rows]
