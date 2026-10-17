import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in — CoffeeSkip" },
      { name: "description", content: "Sign in to the CoffeeSkip café dashboard." },
      { property: "og:title", content: "Staff sign in — CoffeeSkip" },
      { property: "og:description", content: "Sign in to the CoffeeSkip café dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/merchant" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-soft">
        <p className="text-sm font-semibold text-accent">CoffeeSkip</p>
        <h1 className="text-3xl font-semibold">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accounts are created by the CoffeeSkip admin.</p>
        <div className="mt-6 space-y-4">
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-12 text-base" /></div>
          <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-12 text-base" /></div>
        </div>
        <Button type="submit" size="lg" disabled={busy} className="mt-6 h-12 w-full rounded-full text-base">{busy ? "Signing in…" : "Sign in"}</Button>
        <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground">← Back to café</Link>
      </form>
    </div>
  );
}
