import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeEmailReturn } from "@/lib/complete-email-return";
import { emailReturnDestination, QLESS_PASSWORD_RESET } from "@/lib/auth-return";
import { getStaffAccess } from "@/lib/staff-access.functions";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Set your password — Qless" },
    { name: "description", content: "Secure Qless password recovery and staff invitation completion." },
    { property: "og:title", content: "Set your password — Qless" },
    { property: "og:description", content: "Complete your Qless password recovery securely." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    window.history.replaceState(window.history.state, "", "/reset-password");
    void (async () => {
      try {
        if (url.search || url.hash) {
          const result = await completeEmailReturn(url, "recovery");
          if (result.type !== "recovery" && result.type !== "invite") throw new Error("Please open a password reset or invitation link.");
          sessionStorage.setItem("qless-email-password", JSON.stringify({ userId: result.userId, type: result.type }));
        }
        const saved = sessionStorage.getItem("qless-email-password");
        if (!saved) return;
        const marker = JSON.parse(saved);
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError || !data.user || marker.userId !== data.user.id || (marker.type !== "recovery" && marker.type !== "invite")) throw new Error("Request a new password reset link.");
        setReady(true);
      } catch (cause) {
        sessionStorage.removeItem("qless-email-password");
        setError(cause instanceof Error ? cause.message : "This link could not be verified.");
      } finally { setChecking(false); }
    })();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (ready && password !== confirmation) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      if (!ready) {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: QLESS_PASSWORD_RESET });
        if (authError) throw new Error("Could not send a reset link. Please wait and try again.");
        setMessage("If this email has a Qless account, a password reset link will arrive shortly.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw new Error(authError.message);
        sessionStorage.removeItem("qless-email-password");
        const access = await getStaffAccess();
        await navigate({ to: emailReturnDestination(access), replace: true });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not complete your request."); }
    finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-card p-6 shadow-soft">
    <p className="text-sm font-semibold text-accent">Qless</p><h1 className="mt-2 text-2xl font-semibold">{checking ? "Verifying your link…" : ready ? "Set your password" : "Reset your password"}</h1>
    {!checking && <><div className="mt-6 space-y-4">{ready ? <>
      <div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-12" /></div>
      <div><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-2 h-12" /></div>
    </> : <div><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-12" /></div>}</div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}
    <Button type="submit" disabled={busy} className="mt-6 h-12 w-full">{busy ? "One moment…" : ready ? "Save password" : "Send reset link"}</Button>
    <Button asChild variant="ghost" className="mt-2 w-full"><Link to="/staff/login">Back to sign in</Link></Button></>}
  </form></main>;
}