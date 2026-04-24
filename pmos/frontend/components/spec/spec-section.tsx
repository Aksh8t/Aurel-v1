"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function formatContent(value: unknown) {
  if (value === null || value === undefined || value === "") return "No content yet.";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function SpecSection({
  label,
  value,
  revised,
  onSave,
  onRevise
}: {
  label: string;
  value: unknown;
  revised?: boolean;
  onSave: (value: unknown) => Promise<void>;
  onRevise: (instruction: string) => Promise<void>;
}) {
  const initial = useMemo(() => formatContent(value), [value]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [revising, setRevising] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">{label}</h2>
          {revised ? <Badge variant="approved">AI revised this</Badge> : null}
        </div>
        <Button variant="secondary" onClick={() => setEditing((current) => !current)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-[220px]" />
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                let next: unknown = draft;
                const trimmed = draft.trim();
                if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
                  next = JSON.parse(trimmed);
                }
                await onSave(next);
                setEditing(false);
              } catch {
                toast.error("We couldn't save that section. Please review the content and try again.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">{formatContent(value)}</pre>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="mb-3 text-sm font-medium text-zinc-700">Ask AI to revise this section</p>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            placeholder="Make this more detailed, focus on mobile..."
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
          />
          <Button
            disabled={!instruction.trim() || revising}
            onClick={async () => {
              setRevising(true);
              try {
                await onRevise(instruction);
                setInstruction("");
              } catch {
                toast.error("We couldn't revise that section right now.");
              } finally {
                setRevising(false);
              }
            }}
          >
            {revising ? "Revising..." : "Ask AI to revise"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
