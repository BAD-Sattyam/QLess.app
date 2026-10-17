// ============= Full file contents =============

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { displayNameSchema, indianMobileSchema, otpSchema, phoneAuthError, RESEND_SECONDS, safeAuthDestination } from "@/lib/phone-auth";
import { emailAuthError, emailSchema, passwordSchema, saveAuthReturn, sameOriginUrl } from "@/lib/email-auth";
import { applyPendingDisplayName, savePendingDisplayName } from "@/lib/customer-name";

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => z.object({ redirect: z.string().optional() }).parse(search),
  head: () => ({ meta: [
    { title: "Sign in — Qless" },
    { name: "description", content: "Sign in to Qless with your email, Google account or Indian mobile number to keep your orders." },
    { property: "og:title", content: "Sign in — Qless" },
    { property: "og:description", content: "Secure customer sign-in for Qless." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: CustomerAuth,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function CustomerAuth() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [mobile, setMobile] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [transition, setTransition] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) { setError(parsedEmail.error.issues[0]?.message ?? "Enter a valid email address."); return; }
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) { setError(parsedPassword.error.issues[0]?.message ?? "Choose a stronger password."); return; }
    const profile = displayNameSchema.safeParse(name);
    if (!profile.success) { setError("Name must be 100 characters or fewer."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (mode === "signup") {
        savePendingDisplayName(profile.data);
        const { data, error: authError } = await supabase.auth.signUp({
          email: parsedEmail.data,
          password,
          // The confirmation link returns to this same site, never to an editor or preview address.
          options: { emailRedirectTo: sameOriginUrl("/auth/callback") },
        });
        if (authError) { setError(emailAuthError(authError, true)); return; }
        if (data.session && data.user) {
          await applyPendingDisplayName(data.user.id);
          await navigate({ to: safeAuthDestination(redirect), replace: true });
          return;
        }
        // Email confirmation is on: no session exists until the customer opens the link.
        setSent(true);
        return;
      }
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: parsedEmail.data, password });
      if (authError) { setError(emailAuthError(authError)); return; }
      if (!data.session || !data.user) { setError("Confirm your email first — we sent a link to your inbox."); return; }
      await applyPendingDisplayName(data.user.id);
      await navigate({ to: safeAuthDestination(redirect), replace: true });
    } catch { setError("Couldn't connect. Please check your connection and try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const startOAuth = async (provider: "google" | "lovable") => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      // The provider returns to a public callback page, so the intended destination is remembered here.
      saveAuthReturn(redirect, "/orders");
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: sameOriginUrl("/auth/callback") });
      if (result.error) { setError("That sign-in didn't work. Please try again or use your email."); return; }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setError("Sign-in didn't finish. Please try again."); return; }
      await applyPendingDisplayName(data.user.id);
      await navigate({ to: safeAuthDestination(redirect), replace: true });
    } catch { setError("Couldn't start sign-in. Please try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (inFlight.current || remaining > 0 || transition) return;
    const parsed = indianMobileSchema.safeParse(mobile);
    const profile = displayNameSchema.safeParse(name);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your mobile number."); return; }
    if (!profile.success) { setError("Name must be 100 characters or fewer."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({ phone: parsed.data, options: { shouldCreateUser: true } });
      if (authError) {
        if (authError.status === 429) setDeadline(Date.now() + RESEND_SECONDS * 1000);
        setError(phoneAuthError(authError)); return;
      }
      setPhone(parsed.data); setOtp(""); setDeadline(Date.now() + RESEND_SECONDS * 1000);
    } catch { setError("Couldn't connect. Please check your connection and try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) { setError("Enter the 6-digit code from your SMS."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const { data, error: authError } = await supabase.auth.verifyOtp({ phone, token: parsed.data, type: "sms" });
      if (authError) { setError(phoneAuthError(authError, true)); return; }
      if (!data.session || !data.user) { setError("Sign-in hasn't completed. Please request a new code."); return; }
      const profile = displayNameSchema.safeParse(name);
      if (profile.success && profile.data) {
        // Owner-only RLS and database length constraints apply; failure must not discard a valid session.
        await supabase.from("profiles").update({ display_name: profile.data }).eq("id", data.user.id);
      }
      setOtp("");
      await navigate({ to: safeAuthDestination(redirect), replace: true });
    } catch { setError("Couldn't connect. Please check your connection and try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6 text-foreground">
      <header className="mx-auto flex max-w-xl items-center justify-between">
        <Link to="/" className="text-2xl font-bold">Qless<span className="text-accent">.</span></Link>
        <Button asChild variant="ghost" size="sm"><Link to="/staff/login"><ShieldCheck className="size-4" />Staff sign in</Link></Button>
      </header>
      <main className="mx-auto max-w-sm pb-10 pt-10 sm:pt-16">
        <div role="tablist" aria-label="Sign-in method" className="flex gap-1 rounded-lg bg-secondary p-1">
          <button role="tab" type="button" aria-selected={method === "email"} onClick={() => { setMethod("email"); setError(""); }} className={`h-10 flex-1 rounded-md text-sm font-medium transition-colors ${method === "email" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>Email</button>
          <button role="tab" type="button" aria-selected={method === "phone"} onClick={() => { setMethod("phone"); setError(""); }} className={`h-10 flex-1 rounded-md text-sm font-medium transition-colors ${method === "phone" ? "bg-card shadow-soft" : "text-muted-foreground"}`}>Mobile</button>
        </div>

        {method === "email" ? (sent ? (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold">Confirm your email</h1>
            <p role="status" className="mt-3 text-sm leading-relaxed text-muted-foreground">We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it to finish creating your account, then sign in.</p>
            <Button variant="outline" size="lg" className="mt-6 h-12 w-full rounded-lg" disabled={busy} onClick={() => { setSent(false); setError(""); }}>Use a different email</Button>
          </section>
        ) : (
          <section className="mt-8">
            <h1 className="text-3xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{mode === "signin" ? "Sign in to keep your orders and skip the queue." : "Your next coffee is one step closer. We'll email you a link to confirm."}</p>
            <form onSubmit={submitEmail} className="mt-7" noValidate>
              {mode === "signup" && <div className="mb-5"><Label htmlFor="display-name">Your name <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="display-name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 bg-card" disabled={busy} /></div>}
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} disabled={busy} className="mt-2 h-12 bg-card" aria-describedby={error ? "auth-error" : undefined} />
              <div className="mt-5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} disabled={busy} className="mt-2 h-12 bg-card" aria-describedby={error ? "auth-error" : undefined} /></div>
              {mode === "signin" && <Button asChild variant="link" className="mt-3 h-auto px-0 text-sm"><Link to="/reset-password">Forgot password?</Link></Button>}
              {error && <p id="auth-error" role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-lg" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}<ArrowRight className="size-4" /></Button>
            </form>
            <Button variant="ghost" className="mt-4 w-full text-muted-foreground" disabled={busy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "New to Qless? Create an account" : "Already have an account? Sign in"}</Button>
          </section>
        )) : (
          <section className="mt-8">
            <div className="mb-6 flex items-center gap-3" aria-label={phone ? "Step 2 of 2" : "Step 1 of 2"}>
              <span className="flex gap-2"><span className="h-1 w-10 rounded-full bg-primary" /><span className={`h-1 w-10 rounded-full ${phone ? "bg-primary" : "bg-border"}`} /></span>
              <span className="ml-auto text-xs font-medium text-muted-foreground">{phone ? "02" : "01"} / 02</span>
            </div>
            <h1 className="text-3xl font-semibold">{phone ? "Verify your number" : "Sign in with your mobile"}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{phone ? `Enter the code sent to ${phone.slice(0, 3)} ${phone.slice(3)}.` : "We'll text you a 6-digit code. New numbers are registered automatically."}</p>
            <form onSubmit={phone ? verify : sendCode} className="mt-7" noValidate>
              {!phone ? <>
                <Label htmlFor="mobile">Mobile number</Label>
                <div className="mt-2 flex h-12 items-center rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring">
                  <span className="border-r px-4 text-sm font-semibold">+91</span>
                  <Input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile number" value={mobile} onChange={(event) => { setMobile(event.target.value.replace(/\D/g, "")); setError(""); }} disabled={busy} className="h-full min-w-0 border-0 bg-transparent text-base shadow-none focus-visible:ring-0" aria-describedby={error ? "auth-error" : undefined} />
                </div>
                <div className="mt-5"><Label htmlFor="display-name-phone">Your name <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="display-name-phone" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12 bg-card" disabled={busy} /></div>
              </> : <>
                <Label htmlFor="sms-code">Verification code</Label>
                <InputOTP id="sms-code" aria-label="6-digit verification code" maxLength={6} pattern="^[0-9]*$" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={setOtp} disabled={busy} containerClassName="mt-3 w-full" autoFocus>
                  <InputOTPGroup className="w-full justify-between gap-2">{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="h-12 min-w-0 flex-1 rounded-md border text-lg first:rounded-md last:rounded-md" />)}</InputOTPGroup>
                </InputOTP>
              </>}
              {error && <p id="auth-error" role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-lg" disabled={busy || transition || (!phone && remaining > 0)}>{busy ? "One moment…" : phone ? "Verify & continue" : remaining > 0 ? `Try again in ${remaining}s` : "Send verification code"}<ArrowRight className="size-4" /></Button>
            </form>
            {phone ? <div className="mt-5 space-y-2 text-center">
              <Button variant="ghost" disabled={busy || remaining > 0} onClick={() => sendCode()}>{remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}</Button>
              <Button variant="ghost" className="w-full text-muted-foreground" disabled={busy} onClick={() => { setPhone(""); setOtp(""); setError(""); }}><ArrowLeft className="size-4" />Change number</Button>
            </div> : <>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Text messages arrive once Qless's SMS provider is connected. Email and Google sign-in work today.</p>
              <Button variant="link" className="mt-3 h-auto px-0" onClick={() => { setTransition(!transition); setError(""); }}>Previously used email sign-in?</Button>
              {transition && <p role="status" className="mt-2 border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted-foreground">Contact your Qless administrator before continuing. They must verify your identity and link your number to your existing account so you keep your orders. Do not create a second account.</p>}
            </>}
          </section>
        )}

        <div className="my-7 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" /></div>
        <div className="space-y-3">
          <Button type="button" variant="outline" size="lg" className="h-12 w-full rounded-lg" disabled={busy} onClick={() => startOAuth("google")}><GoogleMark />Google</Button>
          <Button type="button" variant="outline" size="lg" className="h-12 w-full rounded-lg" disabled={busy} onClick={() => startOAuth("lovable")}>Lovable</Button>
        </div>
        <Button asChild variant="ghost" className="mt-8 w-full text-muted-foreground"><Link to="/"><ArrowLeft className="size-4" />Back to cafés</Link></Button>
      </main>
    </div>
  );
}
