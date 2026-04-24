CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  strategic_context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  metadata JSONB DEFAULT '{}'::jsonb,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL,
  frequency_score INTEGER,
  severity_score INTEGER,
  strategic_alignment_score INTEGER,
  effort_estimate TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS why_now TEXT,
  ADD COLUMN IF NOT EXISTS affected_segment TEXT;

CREATE TABLE specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  problem_statement TEXT,
  proposed_solution TEXT,
  success_metrics JSONB,
  user_stories JSONB,
  ui_changes JSONB,
  data_model_changes JSONB,
  workflow_changes JSONB,
  out_of_scope TEXT,
  open_questions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID REFERENCES specs(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id),
  title TEXT NOT NULL,
  type TEXT,
  context TEXT,
  acceptance_criteria JSONB,
  constraints TEXT,
  dependencies JSONB,
  effort_estimate TEXT,
  jira_ticket_id TEXT,
  status TEXT DEFAULT 'pending',
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS likely_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS test_cases JSONB DEFAULT '[]'::jsonb;

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  qdrant_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
