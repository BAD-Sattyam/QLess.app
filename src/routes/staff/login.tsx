import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeAuthDestination } from "@/lib/phone-auth";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/staff/login")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Staff sign in — Qless" },
      { name: "description", content: "Secure email sign-in for Qless café staff and administrators." },
      { property: "og:title", content: "Staff sign in — Qless" },
      { property: "og:description", content: "Secure email sign-in for Qless café staff and administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const goAfterLogin = () => {
    navigate({ to: safeAuthDestination(redirect) === "/orders" ? "/merchant" : safeAuthDestination(redirect) });
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    goAfterLogin();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-soft">
        <p className="text-sm font-semibold text-accent">Qless</p>
        <h1 className="text-3xl font-semibold">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Secure access for assigned restaurant staff and administrators.
        </p>
        <div className="mt-6 space-y-4">
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-12 text-base" /></div>
          <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-12 text-base" /></div>
        </div>
        <Button type="submit" size="lg" disabled={busy} className="mt-6 h-12 w-full rounded-full text-base">
          {busy ? "One moment…" : "Sign in"}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">Accounts and restaurant access are provisioned by the Qless administrator.</p>
        <Link to="/" className="mt-2 block text-center text-sm text-muted-foreground">← Back to café</Link>
      </form>
    </div>
  );
}
