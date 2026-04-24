"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Database, FolderClock, MicVocal } from "lucide-react";
import { toast } from "sonner";

import { IntegrationDialog } from "@/components/data-sources/integration-dialog";
import { UploadDropzone } from "@/components/data-sources/upload-dropzone";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { connectAmplitude, connectJira, getDashboard, getWorkspaceByOwner, uploadFile } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { DashboardData, DataSource, Workspace } from "@/lib/types";

async function resolveWorkspace() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return getWorkspaceByOwner(user.id);
}

function groupedSources(sources: DataSource[]) {
  return sources.reduce<Record<string, DataSource[]>>((groups, source) => {
    groups[source.type] = [...(groups[source.type] ?? []), source];
    return groups;
  }, {});
}

export default function DashboardPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const refresh = async (currentWorkspace?: Workspace) => {
    const activeWorkspace = currentWorkspace ?? workspace;
    if (!activeWorkspace) return;
    const nextDashboard = await getDashboard(activeWorkspace.id);
    setDashboard(nextDashboard);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const currentWorkspace = await resolveWorkspace();
        setWorkspace(currentWorkspace);
        const dashboardData = await getDashboard(currentWorkspace.id);
        setDashboard(dashboardData);
      } catch {
        toast.error("Connection failed. Check your internet and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!dashboard?.data_sources.some((source) => source.status === "processing")) return;
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [dashboard, workspace]);

  const sourceGroups = useMemo(() => groupedSources(dashboard?.data_sources ?? []), [dashboard?.data_sources]);

  if (loading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
        <Skeleton className="h-[560px]" />
        <Skeleton className="h-[560px]" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
      <Card className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Knowledge Base</CardTitle>
            <CardDescription className="mt-1">Upload interviews and connect product signals.</CardDescription>
          </div>
          <Badge>{dashboard?.data_sources.length ?? 0} items</Badge>
        </div>

        <UploadDropzone
          disabled={uploading}
          onFiles={async (files) => {
            if (!workspace) return;
            setUploading(true);
            try {
              for (const file of Array.from(files)) {
                await uploadFile({ file, workspaceId: workspace.id, sourceType: "interview" });
              }
              toast.success("Upload started. We’re processing your files now.");
              await refresh();
            } catch (error) {
              const message = error instanceof Error ? error.message : "Upload failed.";
              toast.error(message);
            } finally {
              setUploading(false);
            }
          }}
        />

        <div className="flex flex-wrap gap-3">
          <IntegrationDialog
            description="Sync the last 30 days of usage events into the knowledge base."
            fields={[
              { id: "api_key", label: "API Key" },
              { id: "secret_key", label: "Secret Key", type: "password" }
            ]}
            onSubmit={async (values) => {
              if (!workspace) return;
              await connectAmplitude({
                workspace_id: workspace.id,
                api_key: values.api_key,
                secret_key: values.secret_key
              });
              toast.success("Amplitude connected.");
              await refresh();
            }}
            title="Connect Amplitude"
            triggerLabel="Connect Amplitude"
          />
          <IntegrationDialog
            description="Sync bugs and stories from Jira into the knowledge base."
            fields={[
              { id: "jira_url", label: "Jira URL", placeholder: "https://your-domain.atlassian.net" },
              { id: "email", label: "Email" },
              { id: "api_token", label: "API Token", type: "password" }
            ]}
            onSubmit={async (values) => {
              if (!workspace) return;
              await connectJira({
                workspace_id: workspace.id,
                jira_url: values.jira_url,
                email: values.email,
                api_token: values.api_token
              });
              toast.success("Jira connected.");
              await refresh();
            }}
            title="Connect Jira"
            triggerLabel="Connect Jira"
          />
        </div>

        <div className="space-y-5">
          {Object.keys(sourceGroups).length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              Start by uploading your first customer interview.
            </div>
          ) : (
            Object.entries(sourceGroups).map(([group, sources]) => (
              <div key={group}>
                <p className="mb-3 text-sm font-medium capitalize text-zinc-700">{group.replaceAll("_", " ")}</p>
                <div className="space-y-3">
                  {sources.map((source) => (
                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4" key={source.id}>
                      <div>
                        <p className="font-medium text-zinc-900">{source.name}</p>
                        <p className="text-sm text-zinc-500">{source.source}</p>
                      </div>
                      <Badge variant={source.status}>{source.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-4">
          <CardTitle>Quick stats</CardTitle>
          <div className="grid gap-4">
            {[
              {
                label: "Total customer signals ingested",
                value: dashboard?.stats.total_customer_signals ?? 0,
                icon: Database
              },
              {
                label: "Interviews processed",
                value: dashboard?.stats.interviews_processed ?? 0,
                icon: MicVocal
              },
              {
                label: "Open opportunities",
                value: dashboard?.stats.open_opportunities ?? 0,
                icon: BarChart3
              },
              {
                label: "Specs in draft",
                value: dashboard?.stats.specs_in_draft ?? 0,
                icon: FolderClock
              }
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4" key={stat.label}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-violet-50 p-2">
                      <Icon className="h-4 w-4 text-violet-600" />
                    </div>
                    <p className="text-sm text-zinc-600">{stat.label}</p>
                  </div>
                  <span className="text-xl font-semibold text-zinc-900">{stat.value}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardTitle>Recent activity</CardTitle>
          <div className="mt-4 space-y-3">
            {dashboard?.recent_activity.length ? (
              dashboard.recent_activity.map((activity) => (
                <div className="rounded-xl border border-zinc-200 p-4" key={activity.id}>
                  <p className="font-medium text-zinc-900">{activity.title}</p>
                  <p className="text-sm capitalize text-zinc-500">{activity.type}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                Activity will appear here as your team uploads data and creates specs.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
