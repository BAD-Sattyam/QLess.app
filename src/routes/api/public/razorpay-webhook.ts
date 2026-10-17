import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyHmac } from "@/lib/payment-security";
import { confirmCapturedPayment, testCredentials } from "@/lib/razorpay.server";

const webhookSchema = z.object({
  event: z.string().max(80),
  payload: z.object({ payment: z.object({ entity: z.object({
    id: z.string().regex(/^pay_[a-zA-Z0-9]+$/), order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/).nullable().optional(),
  }) }).optional() }).optional(),
});

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
      if (!secret) return new Response("Webhook not configured", { status: 503 });
      const body = await request.text();
      if (body.length > 100000) return new Response("Payload too large", { status: 413 });
      if (!await verifyHmac(secret, body, request.headers.get("x-razorpay-signature") ?? "")) return new Response("Invalid signature", { status: 401 });
      let event: z.infer<typeof webhookSchema>;
      try { event = webhookSchema.parse(JSON.parse(body)); } catch { return new Response("Invalid payload", { status: 400 }); }
      if (!["payment.captured", "payment.failed"].includes(event.event)) return Response.json({ ok: true });
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id) return new Response("Missing payment order", { status: 400 });
      try {
        testCredentials();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: attempt, error } = await supabaseAdmin.from("payment_attempts").select("id,status,is_test")
          .eq("razorpay_order_id", payment.order_id).maybeSingle();
        if (error) return new Response("Please retry", { status: 503 });
        if (!attempt) return Response.json({ ok: true });
        if (!attempt.is_test) return new Response("Live payments disabled", { status: 403 });
        if (event.event === "payment.captured") {
          const result = await confirmCapturedPayment(attempt.id, payment.id);
          if (result.status !== "paid") return new Response("Capture not confirmed", { status: 503 });
        } else {
          const { error: updateError } = await supabaseAdmin.from("payment_attempts").update({ status: "failed" }).eq("id", attempt.id).eq("status", "pending");
          if (updateError) return new Response("Please retry", { status: 503 });
        }
        return Response.json({ ok: true });
      } catch { return new Response("Payment confirmation unavailable", { status: 503 }); }
    },
  } },
});
