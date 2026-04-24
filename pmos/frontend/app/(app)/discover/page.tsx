"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { OpportunityCard } from "@/components/discover/opportunity-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard, getOpportunities, getWorkspaceByOwner, streamDiscovery, streamSpec, updateOpportunity } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { Opportunity, Workspace } from "@/lib/types";

async function resolveWorkspace() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return getWorkspaceByOwner(user.id);
}

export default function DiscoverPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [query, setQuery] = useState("What should we build next?");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [speccingId, setSpeccingId] = useState<string | null>(null);
  const [hasSources, setHasSources] = useState(true);

  const loadExisting = async (activeWorkspace: Workspace) => {
    const [items, dashboard] = await Promise.all([
      getOpportunities(activeWorkspace.id),
      getDashboard(activeWorkspace.id)
    ]);
    setOpportunities(items.filter((item) => item.status !== "dismissed"));
    setHasSources(dashboard.data_sources.length > 0);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const currentWorkspace = await resolveWorkspace();
        setWorkspace(currentWorkspace);
        await loadExisting(currentWorkspace);
      } catch {
        toast.error("Connection failed. Check your internet and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return <Skeleton className="h-[520px]" />;
  }

  if (!hasSources) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <CardTitle>Upload customer data first</CardTitle>
        <CardDescription className="mt-2">
          Discovery works best once you’ve added interviews, tickets, or usage data.
        </CardDescription>
        <div className="mt-6">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <CardTitle>What should we build next?</CardTitle>
        <CardDescription>Ask a broad question or focus the analysis on a specific product area.</CardDescription>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button
            disabled={analyzing || !workspace}
            onClick={async () => {
              if (!workspace) return;
              setAnalyzing(true);
              const chunks: string[] = [];
              try {
                await streamDiscovery(
                  { workspace_id: workspace.id, query },
                  {
                    onChunk: (chunk) => {
                      chunks.push(chunk);
                    }
                  }
                );
                JSON.parse(chunks.join(""));
                const persisted = await getOpportunities(workspace.id);
                setOpportunities(persisted.filter((item) => item.status !== "dismissed"));
                toast.success("Analysis complete.");
              } catch {
                toast.error("Connection failed. Check your internet and try again.");
              } finally {
                setAnalyzing(false);
              }
            }}
          >
            {analyzing ? <span className="dot-typing">Analyzing your data</span> : "Analyze"}
          </Button>
        </div>
      </Card>

      <div className="space-y-5">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            busy={speccingId === opportunity.id}
            key={opportunity.id}
            onDismiss={async () => {
              await updateOpportunity(opportunity.id, "dismissed");
              setOpportunities((current) => current.filter((item) => item.id !== opportunity.id));
              toast.success("Opportunity dismissed.");
            }}
            onSpec={async () => {
              if (!workspace) return;
              setSpeccingId(opportunity.id);
              const buffer: string[] = [];
              try {
                await streamSpec(
                  { workspace_id: workspace.id, opportunity_id: opportunity.id },
                  {
                    onChunk: (chunk) => {
                      buffer.push(chunk);
                    },
                    onComplete: (specId) => {
                      window.location.href = `/specs/${specId}`;
                    }
                  }
                );
              } catch {
                toast.error("We couldn't generate that spec. Please try again.");
              } finally {
                setSpeccingId(null);
              }
            }}
            opportunity={opportunity}
          />
        ))}
      </div>
    </div>
  );
}
