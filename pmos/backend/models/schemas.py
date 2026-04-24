from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error: str
    detail: str
    code: str


class WorkspaceCreateRequest(BaseModel):
    name: str
    owner_id: str


class WorkspaceUpdateRequest(BaseModel):
    name: str | None = None
    strategic_context: dict[str, Any] | None = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner_id: str | None = None
    strategic_context: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class SourceMetadata(BaseModel):
    error: str | None = None
    size_bytes: int | None = None
    integrations: dict[str, Any] = Field(default_factory=dict)


class DataSourceResponse(BaseModel):
    id: str
    workspace_id: str
    type: str
    source: str
    name: str
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    file_path: str | None = None
    created_at: datetime | None = None


class DashboardStats(BaseModel):
    total_customer_signals: int = 0
    interviews_processed: int = 0
    open_opportunities: int = 0
    specs_in_draft: int = 0


class ActivityItem(BaseModel):
    id: str
    type: str
    title: str
    created_at: datetime | None = None


class DashboardResponse(BaseModel):
    workspace: WorkspaceResponse
    stats: DashboardStats
    data_sources: list[DataSourceResponse] = Field(default_factory=list)
    recent_activity: list[ActivityItem] = Field(default_factory=list)
    integrations: list[str] = Field(default_factory=list)


class IntegrationAmplitudeRequest(BaseModel):
    workspace_id: str
    api_key: str
    secret_key: str


class IntegrationJiraRequest(BaseModel):
    workspace_id: str
    jira_url: str
    email: str
    api_token: str


class DiscoverRequest(BaseModel):
    workspace_id: str
    query: str | None = None
    stream: bool = False


class EvidenceItem(BaseModel):
    quote: str
    source: str
    source_type: str
    source_id: str | None = None


class OpportunityPayload(BaseModel):
    title: str
    summary: str
    evidence: list[EvidenceItem]
    frequency_score: int
    severity_score: int
    strategic_alignment_score: int
    effort_estimate: str
    why_now: str | None = None
    affected_segment: str | None = None


class OpportunityResponse(OpportunityPayload):
    id: str
    workspace_id: str
    status: str
    created_at: datetime | None = None


class OpportunityUpdateRequest(BaseModel):
    status: Literal["dismissed", "active"]


class MetricItem(BaseModel):
    metric: str
    baseline: str
    target: str
    measurement: str


class StoryItem(BaseModel):
    type: Literal["primary", "edge_case", "error_state"]
    story: str
    acceptance_criteria: list[str]


class UIChangeItem(BaseModel):
    screen: str
    change_type: Literal["add", "modify", "remove"]
    description: str
    rationale: str
    validation_needed: str


class DataModelChangeItem(BaseModel):
    type: Literal["new_table", "new_field", "modify_field", "new_relationship"]
    description: str
    migration_notes: str


class WorkflowChangeItem(BaseModel):
    description: str
    affected_integrations: list[str] = Field(default_factory=list)


class OpenQuestionItem(BaseModel):
    question: str
    why_it_matters: str


class SpecGenerateRequest(BaseModel):
    workspace_id: str
    opportunity_id: str
    stream: bool = False


class SpecResponse(BaseModel):
    id: str
    workspace_id: str
    opportunity_id: str | None = None
    title: str
    status: str
    problem_statement: str | None = None
    proposed_solution: str | None = None
    success_metrics: list[MetricItem] = Field(default_factory=list)
    user_stories: list[StoryItem] = Field(default_factory=list)
    ui_changes: list[UIChangeItem] = Field(default_factory=list)
    data_model_changes: list[DataModelChangeItem] = Field(default_factory=list)
    workflow_changes: list[WorkflowChangeItem] = Field(default_factory=list)
    out_of_scope: str | None = None
    open_questions: list[OpenQuestionItem] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SpecUpdateRequest(BaseModel):
    title: str | None = None
    status: str | None = None
    problem_statement: str | None = None
    proposed_solution: str | None = None
    success_metrics: list[dict[str, Any]] | None = None
    user_stories: list[dict[str, Any]] | None = None
    ui_changes: list[dict[str, Any]] | None = None
    data_model_changes: list[dict[str, Any]] | None = None
    workflow_changes: list[dict[str, Any]] | None = None
    out_of_scope: str | None = None
    open_questions: list[dict[str, Any]] | None = None


class SpecReviseRequest(BaseModel):
    section: str
    instruction: str


class TaskGenerateRequest(BaseModel):
    spec_id: str


class TaskPayload(BaseModel):
    title: str
    type: Literal["frontend", "backend", "data_migration", "integration", "infra"]
    context: str
    acceptance_criteria: list[str]
    constraints: str
    dependencies: list[str] = Field(default_factory=list)
    effort_estimate: str
    likely_files: list[str] = Field(default_factory=list)
    test_cases: list[str] = Field(default_factory=list)


class TaskResponse(TaskPayload):
    id: str
    spec_id: str
    workspace_id: str | None = None
    jira_ticket_id: str | None = None
    status: str
    display_order: int | None = None
    created_at: datetime | None = None


class SuggestedSprintSplit(BaseModel):
    mvp: list[str] = Field(default_factory=list)
    full_rollout: list[str] = Field(default_factory=list)


class TasksGenerateResponse(BaseModel):
    tasks: list[TaskResponse]
    suggested_sprint_split: SuggestedSprintSplit
    cursor_context_summary: str


class JiraConfig(BaseModel):
    url: str
    email: str
    api_token: str
    project_key: str


class TasksExportJiraRequest(BaseModel):
    task_ids: list[str]
    jira_config: JiraConfig


class JiraTicketReference(BaseModel):
    task_id: str
    jira_key: str
    jira_url: str


class TasksExportJiraResponse(BaseModel):
    exported: int
    tickets: list[JiraTicketReference]
