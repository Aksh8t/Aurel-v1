export type SourceStatus = "processing" | "ready" | "error";
export type OpportunityStatus = "active" | "dismissed" | "specced";
export type SpecStatus = "draft" | "approved" | "shipped";
export type TaskType = "frontend" | "backend" | "data_migration" | "integration" | "infra";

export interface Workspace {
  id: string;
  name: string;
  owner_id?: string | null;
  strategic_context: Record<string, unknown>;
  created_at?: string;
}

export interface DataSource {
  id: string;
  workspace_id: string;
  type: string;
  source: string;
  name: string;
  status: SourceStatus;
  metadata: Record<string, unknown>;
  file_path?: string | null;
  created_at?: string;
}

export interface DashboardData {
  workspace: Workspace;
  stats: {
    total_customer_signals: number;
    interviews_processed: number;
    open_opportunities: number;
    specs_in_draft: number;
  };
  data_sources: DataSource[];
  recent_activity: Array<{
    id: string;
    type: string;
    title: string;
    created_at?: string;
  }>;
  integrations: string[];
}

export interface OpportunityEvidence {
  quote: string;
  source: string;
  source_type: string;
  source_id?: string;
}

export interface Opportunity {
  id: string;
  workspace_id: string;
  title: string;
  summary: string;
  evidence: OpportunityEvidence[];
  frequency_score: number;
  severity_score: number;
  strategic_alignment_score: number;
  effort_estimate: string;
  why_now?: string | null;
  affected_segment?: string | null;
  status: OpportunityStatus;
  created_at?: string;
}

export interface Spec {
  id: string;
  workspace_id: string;
  opportunity_id?: string | null;
  title: string;
  status: SpecStatus;
  problem_statement?: string | null;
  proposed_solution?: string | null;
  success_metrics: Array<Record<string, string>>;
  user_stories: Array<Record<string, unknown>>;
  ui_changes: Array<Record<string, unknown>>;
  data_model_changes: Array<Record<string, unknown>>;
  workflow_changes: Array<Record<string, unknown>>;
  out_of_scope?: string | null;
  open_questions: Array<Record<string, string>>;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  spec_id: string;
  workspace_id?: string | null;
  title: string;
  type: TaskType;
  context: string;
  acceptance_criteria: string[];
  constraints: string;
  dependencies: string[];
  effort_estimate: string;
  likely_files: string[];
  test_cases: string[];
  jira_ticket_id?: string | null;
  status: string;
  display_order?: number | null;
  created_at?: string;
}

export interface GeneratedTasks {
  tasks: Task[];
  suggested_sprint_split: {
    mvp: string[];
    full_rollout: string[];
  };
  cursor_context_summary: string;
}
