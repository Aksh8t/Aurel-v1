"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SpecSection } from "@/components/spec/spec-section";
import { approveSpec, getSpec, reviseSpecSection, updateSpec } from "@/lib/api";
import type { Spec } from "@/lib/types";

const sections = [
  ["problem_statement", "Problem Statement"],
  ["proposed_solution", "Proposed Solution"],
  ["success_metrics", "Success Metrics"],
  ["user_stories", "User Stories"],
  ["ui_changes", "UI Changes"],
  ["data_model_changes", "Data Model Changes"],
  ["workflow_changes", "Workflow Changes"],
  ["out_of_scope", "Out of Scope"],
  ["open_questions", "Open Questions"]
] as const;

export default function SpecDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTitle, setSavingTitle] = useState(false);
  const [revisedSections, setRevisedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const currentSpec = await getSpec(params.id);
        setSpec(currentSpec);
      } catch {
        toast.error("Connection failed. Check your internet and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  const sectionMap = useMemo(() => Object.fromEntries(sections), []);

  if (loading || !spec) {
    return <Skeleton className="h-[680px]" />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[240px,1fr]">
      <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="space-y-1">
          {sections.map(([key, label]) => (
            <a
              className="block rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              href={`#${key}`}
              key={key}
            >
              {label}
            </a>
          ))}
        </div>
      </aside>

      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 space-y-3">
              <Link className="text-sm text-violet-600" href="/discover">
                Back to opportunities
              </Link>
              <Input
                className="text-xl font-semibold"
                value={spec.title}
                onBlur={async (event) => {
                  setSavingTitle(true);
                  try {
                    const updated = await updateSpec(spec.id, { title: event.target.value });
                    setSpec(updated);
                  } finally {
                    setSavingTitle(false);
                  }
                }}
                onChange={(event) => setSpec((current) => (current ? { ...current, title: event.target.value } : current))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={spec.status === "approved" ? "approved" : "draft"}>{spec.status}</Badge>
              <Button
                disabled={savingTitle || spec.status === "approved"}
                onClick={async () => {
                  const approved = await approveSpec(spec.id);
                  setSpec(approved);
                  router.push(`/tasks?spec=${spec.id}`);
                }}
              >
                Approve Spec
              </Button>
            </div>
          </div>
        </div>

        {sections.map(([key, label]) => (
          <div id={key} key={key}>
            <SpecSection
              label={label}
              onRevise={async (instruction) => {
                const revised = await reviseSpecSection(spec.id, key, instruction);
                setSpec((current) => (current ? { ...current, [key]: revised.revised_content } : current));
                setRevisedSections((current) => ({ ...current, [key]: true }));
                toast.success(`${label} revised.`);
              }}
              onSave={async (value) => {
                const updated = await updateSpec(spec.id, { [key]: value } as Partial<Spec>);
                setSpec(updated);
                toast.success(`${label} updated.`);
              }}
              revised={revisedSections[key]}
              value={spec[key]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
