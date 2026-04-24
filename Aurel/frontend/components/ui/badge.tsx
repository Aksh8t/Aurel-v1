import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  variant = "default"
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "processing" | "ready" | "error" | "draft" | "approved";
}) {
  const variants = {
    default: "bg-zinc-100 text-zinc-600",
    processing: "bg-amber-100 text-amber-700",
    ready: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    draft: "bg-zinc-100 text-zinc-600",
    approved: "bg-violet-100 text-violet-700"
  };

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
