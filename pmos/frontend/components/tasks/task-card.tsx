"use client";

import { ChevronDown, Copy, Link2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Task } from "@/lib/types";

export function TaskCard({
  task,
  onCopyPrompt
}: {
  task: Task;
  onCopyPrompt: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-zinc-900">{task.title}</h3>
            <Badge>{task.type}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{task.context}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{task.effort_estimate}</Badge>
          <Button variant="secondary" onClick={onCopyPrompt}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Cursor Prompt
          </Button>
        </div>
      </div>

      {task.dependencies.length ? (
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <Link2 className="h-4 w-4" />
          {task.dependencies.map((dependency) => (
            <span className="rounded-full bg-zinc-100 px-2 py-1" key={dependency}>
              {dependency}
            </span>
          ))}
        </div>
      ) : null}

      <Button className="w-full" variant="ghost" onClick={() => setExpanded((current) => !current)}>
        <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Hide details" : "Show details"}
      </Button>

      {expanded ? (
        <div className="grid gap-4 text-sm text-zinc-600 md:grid-cols-3">
          <div>
            <p className="font-medium text-zinc-900">Acceptance criteria</p>
            <ul className="mt-2 space-y-2">
              {task.acceptance_criteria.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-zinc-900">Constraints</p>
            <p className="mt-2 leading-6">{task.constraints}</p>
          </div>
          <div>
            <p className="font-medium text-zinc-900">Test cases</p>
            <ul className="mt-2 space-y-2">
              {task.test_cases.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
