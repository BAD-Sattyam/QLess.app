// ============= Full file contents =============

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { completeEmailReturn } from "@/lib/complete-email-return";
import { emailReturnDestination } from "@/lib/auth-return";
import { takeAuthReturn } from "@/lib/email-auth";
import { applyPendingDisplayName } from "@/lib/customer-name";
import { getStaffAccess } from "@/lib/staff-access.functions";

export const Route = createFileRoute("/auth_/callback")({
  head: () => ({ meta: [
    { title: "Complete sign in — Qless" },
    { name: "description", content: "Securely complete your Qless sign-in, email verification or staff invitation." },
    { property: "og:title", content: "Complete sign in — Qless" },
    { property: "og:description", content: "Secure Qless account verification." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: EmailCallback,
});

function EmailCallback() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    // Remove credentials from browser history immediately; never log the incoming URL.
    window.history.replaceState(window.history.state, "", "/auth/callback");
    void (async () => {
      try {
        let userId = "";
        if (url.search || url.hash) {
          const result = await completeEmailReturn(url);
          if (result.type === "recovery" || result.type === "invite") {
            sessionStorage.setItem("qless-email-password", JSON.stringify({ userId: result.userId, type: result.type }));
            await navigate({ to: "/reset-password", replace: true });
            return;
          }
          userId = result.userId;
        } else {
          // A provider sign-in (Google or Lovable) lands here with its session already established.
          const { data, error: authError } = await supabase.auth.getUser();
          if (authError || !data.user) throw new Error("Please sign in again.");
          userId = data.user.id;
        }
        await applyPendingDisplayName(userId);
        const access = await getStaffAccess();
        const destination = emailReturnDestination(access);
        // Staff land on their dashboard; customers return to the page they came from.
        await navigate({ to: destination === "/" ? takeAuthReturn("/") : destination, replace: true });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Sign-in could not be completed.");
      }
    })();
  }, [navigate]);
  return <main className="flex min-h-screen items-center justify-center px-4"><div className="w-full max-w-sm text-center">
    <p className="text-sm font-semibold text-accent">Qless</p>
    <h1 className="mt-2 text-2xl font-semibold">{error ? "Sign-in unavailable" : "Signing you in…"}</h1>
    {error && <><p role="alert" className="mt-4 text-sm text-destructive">{error}</p><Button asChild className="mt-6"><Link to="/auth">Back to sign in</Link></Button></>}
  </div></main>;
}
