"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <Card className="w-full max-w-md">
        <CardTitle>Welcome back</CardTitle>
        <CardDescription className="mt-2">Sign in to continue working in Aurel.</CardDescription>
        <div className="mt-6 space-y-4">
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
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                  toast.error("Could not sign you in. Check your email and password.");
                  return;
                }
                router.push("/dashboard");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-sm text-zinc-500">
            New here?{" "}
            <Link className="text-violet-600" href="/signup">
              Create an account
            </Link>
          </p>
        </div>
      </Card>
    </main>
  );
}
