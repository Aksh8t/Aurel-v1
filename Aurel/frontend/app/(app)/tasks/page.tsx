"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DependencyGraph } from "@/components/tasks/dependency-graph";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IntegrationDialog } from "@/components/data-sources/integration-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { exportTasksToJira, generateTasks, getCursorPrompt, getTasks } from "@/lib/api";
import type { Task } from "@/lib/types";

const taskGroups = ["frontend", "backend", "data_migration", "integration", "infra"] as const;

export default function TasksPage() {
  const searchParams = useSearchParams();
  const specId = searchParams.get("spec");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!specId) {
        setLoading(false);
        return;
      }
      try {
        const taskItems = await getTasks(specId);
        setTasks(taskItems);
      } catch {
        toast.error("Connection failed. Check your internet and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [specId]);

  const grouped = useMemo(
    () =>
      taskGroups.reduce<Record<string, Task[]>>((groups, group) => {
        groups[group] = tasks.filter((task) => task.type === group);
        return groups;
      }, {}),
    [tasks]
  );

  if (loading) {
    return <Skeleton className="h-[520px]" />;
  }

  if (!specId) {
    return (
      <Card className="text-center">
        <CardTitle>No spec selected</CardTitle>
        <CardDescription className="mt-2">Approve a spec first, then generate tasks from it.</CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      {!tasks.length ? (
        <Card className="text-center">
          <CardTitle>Generate tasks</CardTitle>
          <CardDescription className="mt-2">
            Break this approved spec into dev-ready task packages for engineering.
          </CardDescription>
          <div className="mt-6">
            <Button
              disabled={generating}
              onClick={async () => {
                setGenerating(true);
                try {
                  const response = await generateTasks(specId);
                  setTasks(response.tasks);
                  toast.success("Task breakdown generated.");
                } finally {
                  setGenerating(false);
                }
              }}
            >
              {generating ? "Breaking down your spec into engineering tasks..." : "Generate Tasks"}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <DependencyGraph tasks={tasks} />
          {taskGroups.map((group) =>
            grouped[group]?.length ? (
              <section className="space-y-4" key={group}>
                <h2 className="text-xl font-semibold capitalize text-zinc-900">{group.replaceAll("_", " ")}</h2>
                <div className="space-y-4">
                  {grouped[group].map((task) => (
                    <TaskCard
                      key={task.id}
                      onCopyPrompt={async () => {
                        const { prompt } = await getCursorPrompt(task.id);
                        await navigator.clipboard.writeText(prompt);
                        toast.success("Cursor prompt copied.");
                      }}
                      task={task}
                    />
                  ))}
                </div>
              </section>
            ) : null
          )}
        </>
      )}

      {tasks.length ? (
        <div className="fixed bottom-0 left-[240px] right-0 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
            <IntegrationDialog
              description="Create Jira tickets for the selected task set."
              fields={[
                { id: "url", label: "Jira URL" },
                { id: "email", label: "Email" },
                { id: "api_token", label: "API Token", type: "password" },
                { id: "project_key", label: "Project Key" }
              ]}
              onSubmit={async (values) => {
                await exportTasksToJira({
                  task_ids: tasks.map((task) => task.id),
                  jira_config: {
                    url: values.url,
                    email: values.email,
                    api_token: values.api_token,
                    project_key: values.project_key
                  }
                });
                toast.success("Tasks exported to Jira.");
              }}
              title="Export to Jira"
              triggerLabel="Export to Jira"
            />
            <Button
              variant="secondary"
              onClick={async () => {
                const markdown = tasks
                  .map(
                    (task) =>
                      `## ${task.title}\n\nType: ${task.type}\n\nContext: ${task.context}\n\nAcceptance Criteria:\n${task.acceptance_criteria
                        .map((criterion) => `- ${criterion}`)
                        .join("\n")}`
                  )
                  .join("\n\n");
                await navigator.clipboard.writeText(markdown);
                toast.success("Task markdown copied.");
              }}
            >
              Copy All as Markdown
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
