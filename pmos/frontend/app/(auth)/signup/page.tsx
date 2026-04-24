"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createWorkspace } from "@/lib/api";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <Card className="w-full max-w-md">
        <CardTitle>Create your workspace</CardTitle>
        <CardDescription className="mt-2">
          You’ll be analyzing customer interviews in a couple of minutes.
        </CardDescription>
        <div className="mt-6 space-y-4">
          <Input
            placeholder="Workspace name"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
          />
          <Input placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            className="w-full"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const supabase = createClient();
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error || !data.user) {
                  toast.error("We couldn't create your account. Please try again.");
                  return;
                }
                await createWorkspace({ name: workspaceName, owner_id: data.user.id });
                toast.success("Workspace created. Start by uploading your first customer interview.");
                router.push("/dashboard");
              } catch {
                toast.error("Connection failed. Check your internet and try again.");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-zinc-500">
            Already have an account?{" "}
            <Link className="text-violet-600" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </main>
  );
}
