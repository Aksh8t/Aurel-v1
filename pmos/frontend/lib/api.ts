import type { DashboardData, GeneratedTasks, Opportunity, Spec, Task, Workspace } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? "Connection failed. Check your internet and try again.");
  }

  return response.json() as Promise<T>;
}

async function parseStream(
  response: Response,
  handlers: {
    onChunk: (chunk: string) => void;
    onComplete?: (payload: Record<string, unknown>) => void;
  }
) {
  if (!response.body) {
    throw new Error("Streaming not supported.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event
        .split("\n")
        .find((part) => part.startsWith("data: "));
      if (!line) continue;
      const raw = line.replace("data: ", "");
      if (raw === "[DONE]") {
        return;
      }
      const payload = JSON.parse(raw) as { chunk?: string; done?: boolean; spec_id?: string };
      if (payload.chunk) {
        handlers.onChunk(payload.chunk);
      }
      if (payload.done) {
        handlers.onComplete?.(payload);
      }
    }
  }
}

export async function createWorkspace(payload: { name: string; owner_id: string }) {
  return request<Workspace>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getWorkspaceByOwner(ownerId: string) {
  return request<Workspace>(`/api/workspaces/by-owner/${ownerId}`);
}

export async function updateWorkspace(
  workspaceId: string,
  payload: { name?: string; strategic_context?: Record<string, unknown> }
) {
  return request<Workspace>(`/api/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getDashboard(workspaceId: string) {
  return request<DashboardData>(`/api/workspaces/${workspaceId}/dashboard`);
}

export async function uploadFile(payload: { file: File; workspaceId: string; sourceType: string }) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("workspace_id", payload.workspaceId);
  formData.append("source_type", payload.sourceType);

  const response = await fetch(`${API_URL}/api/ingest/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? "Upload failed.");
  }

  return response.json() as Promise<{ data_source_id: string; status: string }>;
}

export async function connectAmplitude(payload: {
  workspace_id: string;
  api_key: string;
  secret_key: string;
}) {
  return request<{ success: boolean; events_synced: number }>("/api/ingest/connect/amplitude", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function connectJira(payload: {
  workspace_id: string;
  jira_url: string;
  email: string;
  api_token: string;
}) {
  return request<{ success: boolean; tickets_synced: number }>("/api/ingest/connect/jira", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function disconnectIntegration(workspaceId: string, source: string) {
  return request<{ success: boolean }>(`/api/ingest/connect/${workspaceId}/${source}`, {
    method: "DELETE"
  });
}

export async function getOpportunities(workspaceId: string) {
  return request<Opportunity[]>(`/api/discover/${workspaceId}`);
}

export async function updateOpportunity(opportunityId: string, status: "dismissed" | "active") {
  return request<Opportunity>(`/api/discover/${opportunityId}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function streamDiscovery(
  payload: { workspace_id: string; query?: string },
  handlers: { onChunk: (chunk: string) => void }
) {
  const response = await fetch(`${API_URL}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true })
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? "Discovery failed.");
  }
  await parseStream(response, handlers);
}

export async function getSpec(specId: string) {
  return request<Spec>(`/api/spec/${specId}`);
}

export async function getSpecs(workspaceId: string) {
  return request<Spec[]>(`/api/spec/workspace/${workspaceId}`);
}

export async function generateSpec(payload: { workspace_id: string; opportunity_id: string }) {
  return request<Spec>("/api/spec/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function streamSpec(
  payload: { workspace_id: string; opportunity_id: string },
  handlers: { onChunk: (chunk: string) => void; onComplete: (specId: string) => void }
) {
  const response = await fetch(`${API_URL}/api/spec/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true })
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? "Spec generation failed.");
  }
  await parseStream(response, {
    onChunk: handlers.onChunk,
    onComplete: (payload) => {
      handlers.onComplete(String(payload.spec_id ?? ""));
    }
  });
}

export async function updateSpec(specId: string, payload: Partial<Spec>) {
  return request<Spec>(`/api/spec/${specId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function reviseSpecSection(specId: string, section: string, instruction: string) {
  return request<{ section: string; revised_content: string }>(`/api/spec/${specId}/revise`, {
    method: "POST",
    body: JSON.stringify({ section, instruction })
  });
}

export async function approveSpec(specId: string) {
  return request<Spec>(`/api/spec/${specId}/approve`, {
    method: "POST"
  });
}

export async function generateTasks(specId: string) {
  return request<GeneratedTasks>("/api/tasks/generate", {
    method: "POST",
    body: JSON.stringify({ spec_id: specId })
  });
}

export async function getTasks(specId: string) {
  return request<Task[]>(`/api/tasks/${specId}`);
}

export async function exportTasksToJira(payload: {
  task_ids: string[];
  jira_config: { url: string; email: string; api_token: string; project_key: string };
}) {
  return request<{ exported: number; tickets: Array<{ task_id: string; jira_key: string; jira_url: string }> }>(
    "/api/tasks/export/jira",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function getCursorPrompt(taskId: string) {
  return request<{ prompt: string }>(`/api/tasks/${taskId}/cursor-prompt`);
}
