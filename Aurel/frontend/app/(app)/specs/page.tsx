"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSpecs, getWorkspaceByOwner } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { Spec, Workspace } from "@/lib/types";

async function resolveWorkspace() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return getWorkspaceByOwner(user.id);
}

export default function SpecsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const currentWorkspace = await resolveWorkspace();
        setWorkspace(currentWorkspace);
        const nextSpecs = await getSpecs(currentWorkspace.id);
        setSpecs(nextSpecs);
      } catch {
        toast.error("Connection failed. Check your internet and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return <Skeleton className="h-[420px]" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Specifications</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Drafts and approved PRDs for {workspace?.name ?? "your workspace"}.
        </p>
      </div>

      {specs.length ? (
        <div className="grid gap-4">
          {specs.map((spec) => (
            <Card key={spec.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>{spec.title}</CardTitle>
                  <CardDescription className="mt-2 line-clamp-2">
                    {spec.problem_statement ?? "No problem statement yet."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={spec.status === "approved" ? "approved" : "draft"}>{spec.status}</Badge>
                  <Button asChild>
                    <Link href={`/specs/${spec.id}`}>Open spec</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center">
          <CardTitle>No specs yet</CardTitle>
          <CardDescription className="mt-2">Generate a spec from the discover page to start building.</CardDescription>
          <div className="mt-6">
            <Button asChild>
              <Link href="/discover">Go to discover</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
