import { ArrowRight, BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Opportunity } from "@/lib/types";

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export function OpportunityCard({
  opportunity,
  onDismiss,
  onSpec,
  busy
}: {
  opportunity: Opportunity;
  onDismiss: () => Promise<void>;
  onSpec: () => Promise<void>;
  busy?: boolean;
}) {
  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-zinc-900">{opportunity.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{opportunity.summary}</p>
        </div>
        <Badge>{opportunity.effort_estimate}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ScoreBar label="Frequency" value={opportunity.frequency_score} color="bg-blue-500" />
        <ScoreBar label="Severity" value={opportunity.severity_score} color="bg-rose-500" />
        <ScoreBar label="Strategic Fit" value={opportunity.strategic_alignment_score} color="bg-violet-600" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <BarChart3 className="h-4 w-4 text-violet-600" />
          Evidence
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {opportunity.evidence.slice(0, 3).map((evidence, index) => (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" key={`${evidence.source}-${index}`}>
              <p className="text-sm leading-6 text-zinc-700">"{evidence.quote}"</p>
              <p className="mt-3 text-xs text-zinc-500">
                {evidence.source} · {evidence.source_type}
              </p>
            </div>
          ))}
        </div>
      </div>

      {opportunity.why_now ? <p className="text-sm italic text-zinc-500">{opportunity.why_now}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy} onClick={onDismiss}>
          Dismiss
        </Button>
        <Button disabled={busy} onClick={onSpec}>
          Spec this out <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
