"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { disconnectIntegration, getDashboard, getWorkspaceByOwner, updateWorkspace } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { DashboardData, Workspace } from "@/lib/types";

async function loadWorkspace() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No active user.");
  return user;
}

export default function SettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [contextText, setContextText] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const user = await loadWorkspace();
        setEmail(user.email ?? "");
        const activeWorkspace = await getWorkspaceByOwner(user.id);
        const dashboardData = await getDashboard(activeWorkspace.id);
        setWorkspace(activeWorkspace);
        setDashboard(dashboardData);
        setContextText(JSON.stringify(activeWorkspace.strategic_context ?? {}, null, 2));
      } catch {
        toast.error("Connection failed. Check your internet and try again.");
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Capture your ICP, OKRs, and product principles to guide discovery.</CardDescription>
        <Input
          value={workspace?.name ?? ""}
          onChange={(event) => setWorkspace((current) => (current ? { ...current, name: event.target.value } : current))}
        />
        <Textarea value={contextText} onChange={(event) => setContextText(event.target.value)} />
        <Button
          onClick={async () => {
            if (!workspace) return;
            try {
              const updated = await updateWorkspace(workspace.id, {
                name: workspace.name,
                strategic_context: JSON.parse(contextText || "{}")
              });
              setWorkspace(updated);
              toast.success("Workspace updated.");
            } catch {
              toast.error("We couldn't save your workspace settings.");
            }
          }}
        >
          Save workspace settings
        </Button>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connected integrations detected from synced data sources.</CardDescription>
        <div className="flex flex-wrap gap-3">
          {dashboard?.integrations.length ? (
            dashboard.integrations.map((integration) => (
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600" key={integration}>
                <span>{integration}</span>
                <button
                  className="text-violet-600"
                  onClick={async () => {
                    if (!workspace) return;
                    await disconnectIntegration(workspace.id, integration);
                    const nextDashboard = await getDashboard(workspace.id);
                    setDashboard(nextDashboard);
                    toast.success(`${integration} disconnected.`);
                  }}
                  type="button"
                >
                  Disconnect
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No integrations connected yet.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Account</CardTitle>
        <CardDescription>Change your password for this workspace account.</CardDescription>
        <Input disabled value={email} />
        <Input
          placeholder="New password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button
          onClick={async () => {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
              toast.error("We couldn't update your password right now.");
              return;
            }
            setPassword("");
            toast.success("Password updated.");
          }}
        >
          Change password
        </Button>
      </Card>
    </div>
  );
}
