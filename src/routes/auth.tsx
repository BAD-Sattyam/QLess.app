import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ShieldCheck, Smartphone } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { displayNameSchema, indianMobileSchema, otpSchema, phoneAuthError, RESEND_SECONDS, safeAuthDestination } from "@/lib/phone-auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => z.object({ redirect: z.string().optional() }).parse(search),
  head: () => ({ meta: [
    { title: "Mobile sign in — Qless" },
    { name: "description", content: "Sign in to Qless securely with your Indian mobile number and SMS verification code." },
    { property: "og:title", content: "Mobile sign in — Qless" },
    { property: "og:description", content: "Secure mobile sign-in for Qless customers." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: MobileAuth,
});

function MobileAuth() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
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

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
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

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <main className="mx-auto max-w-sm pb-10 pt-12 sm:pt-20">
        <div className="mb-7 flex items-center gap-3" aria-label={phone ? "Step 2 of 2" : "Step 1 of 2"}>
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary"><Smartphone className="size-5" /></span>
          <div className="flex gap-2"><span className="h-1 w-10 rounded-full bg-primary" /><span className={`h-1 w-10 rounded-full ${phone ? "bg-primary" : "bg-border"}`} /></div>
          <span className="ml-auto text-xs font-medium text-muted-foreground">{phone ? "02" : "01"} / 02</span>
        </div>
        <h1 className="text-3xl font-semibold">{phone ? "Verify your number" : "Welcome to Qless"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{phone ? `Enter the code sent to ${phone.slice(0, 3)} ${phone.slice(3)}.` : "Your next coffee is one step closer. Sign in with your mobile number."}</p>
        <form onSubmit={phone ? verify : sendCode} className="mt-8" noValidate>
          {!phone ? <>
            <Label htmlFor="mobile">Mobile number</Label>
            <div className="mt-2 flex h-14 items-center rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring">
              <span className="border-r px-4 text-sm font-semibold">+91</span>
              <Input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile number" value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "")); setError(""); }} disabled={busy} className="h-full min-w-0 border-0 bg-transparent text-base shadow-none focus-visible:ring-0" aria-describedby={error ? "auth-error" : undefined} />
            </div>
            <div className="mt-5"><Label htmlFor="display-name">Your name <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="display-name" autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-12 bg-card" disabled={busy} /></div>
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
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">New to Qless? Your account is created when you verify your number.</p>
          <Button variant="link" className="mt-4 h-auto px-0" onClick={() => { setTransition(!transition); setError(""); }}>Previously used email sign-in?</Button>
          {transition && <p role="status" className="mt-2 border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted-foreground">Contact your Qless administrator before continuing. They must verify your identity and link your number to your existing account so you keep your orders. Do not create a second account.</p>}
        </>}
        <Button asChild variant="ghost" className="mt-8 w-full text-muted-foreground"><Link to="/"><ArrowLeft className="size-4" />Back to cafés</Link></Button>
      </main>
    </div>
  );
}
