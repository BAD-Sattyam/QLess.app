import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — Qless" },
      { name: "description", content: "Sign in or create your Qless account to order ahead." },
      { property: "og:title", content: "Sign in — Qless" },
      { property: "og:description", content: "Sign in or create your Qless account to order ahead." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const navigate = useNavigate();

  const goAfterLogin = () => {
    if (redirect && redirect.startsWith("/")) {
      window.location.href = redirect;
    } else {
      navigate({ to: "/orders" });
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    goAfterLogin();
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) { goAfterLogin(); return; }
    setConfirmSent(true);
  };

  if (confirmSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-soft">
          <p className="text-sm font-semibold text-accent">Qless</p>
          <h1 className="mt-1 text-3xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then sign in.
          </p>
          <Button variant="outline" className="mt-6 rounded-full" onClick={() => { setConfirmSent(false); setMode("signin"); }}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={mode === "signin" ? signIn : signUp} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-soft">
        <p className="text-sm font-semibold text-accent">Qless</p>
        <h1 className="text-3xl font-semibold">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to order ahead and track your orders." : "One account for ordering and order history. Café staff sign in here too."}
        </p>
        <div className="mt-6 space-y-4">
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-12 text-base" /></div>
          <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-12 text-base" /></div>
        </div>
        <Button type="submit" size="lg" disabled={busy} className="mt-6 h-12 w-full rounded-full text-base">
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 block w-full text-center text-sm font-medium text-primary"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <Link to="/" className="mt-2 block text-center text-sm text-muted-foreground">← Back to café</Link>
      </form>
    </div>
  );
}
