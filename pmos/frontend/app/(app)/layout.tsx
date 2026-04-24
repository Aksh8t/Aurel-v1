"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Lightbulb, ListChecks, LogOut, Settings2, StickyNote } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Lightbulb },
  { href: "/specs", label: "Specs", icon: StickyNote },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings2 }
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-50">
      <aside className="fixed left-0 top-0 flex h-screen w-[240px] flex-col border-r border-zinc-200 bg-white p-4">
        <Link className="px-3 py-4 text-lg font-semibold text-violet-600" href="/dashboard">
          PM·OS
        </Link>
        <nav className="mt-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900",
                  active && "bg-violet-50 text-violet-600"
                )}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <Button
            className="w-full"
            variant="secondary"
            onClick={async () => {
              const supabase = createClient();
              const { error } = await supabase.auth.signOut();
              if (error) {
                toast.error("Could not sign out right now.");
                return;
              }
              router.push("/login");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="ml-[240px] min-h-screen p-8">{children}</main>
    </div>
  );
}
