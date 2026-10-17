import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { reconcilePayment } from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/payments-expire")({
  server: { handlers: {
    POST: async ({ request }) => {
      const authFailure = await authenticateCronRequest(request);
      if (authFailure) return authFailure;
      try { z.object({ kind: z.literal("expire") }).parse(await request.json()); }
      catch { return new Response("Invalid request", { status: 400 }); }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Reconcile a bounded batch first; released reservations are time-filtered independently of this job.
      const { data: attempts } = await supabaseAdmin.from("payment_attempts")
        .select("id,razorpay_order_id").eq("is_test", true).in("status", ["pending", "failed", "expired"])
        .not("razorpay_order_id", "is", null).gt("created_at", new Date(Date.now() - 86400000).toISOString())
        .order("created_at", { ascending: false }).limit(5);
      await Promise.all((attempts ?? []).map(async (attempt) => {
        if (!attempt.razorpay_order_id) return;
        try { await reconcilePayment(attempt.id, attempt.razorpay_order_id); } catch { /* Webhook retries remain authoritative. */ }
      }));
      const { error } = await supabaseAdmin.rpc("expire_payment_attempts");
      return error ? new Response("Please retry", { status: 503 }) : Response.json({ ok: true });
    },
  } },
});