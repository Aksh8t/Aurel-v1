import type { Task } from "@/lib/types";

export function DependencyGraph({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return null;

  const height = Math.max(160, tasks.length * 64);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">Dependency graph</h3>
      <svg className="mt-4 min-w-[700px]" height={height} width="700">
        {tasks.map((task, index) => {
          const x = 40 + (index % 2) * 320;
          const y = 30 + index * 56;
          return (
            <g key={task.id}>
              <rect fill="#ffffff" height="40" rx="12" stroke="#e4e4e7" width="260" x={x} y={y} />
              <text fill="#18181b" fontSize="12" x={x + 16} y={y + 24}>
                {task.title}
              </text>
              {task.dependencies.map((dependency) => {
                const dependencyIndex = tasks.findIndex((candidate) => candidate.title === dependency);
                if (dependencyIndex === -1) return null;
                const depX = 40 + (dependencyIndex % 2) * 320 + 260;
                const depY = 30 + dependencyIndex * 56 + 20;
                return (
                  <line
                    key={`${task.id}-${dependency}`}
                    stroke="#7c3aed"
                    strokeWidth="2"
                    x1={depX}
                    x2={x}
                    y1={depY}
                    y2={y + 20}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
