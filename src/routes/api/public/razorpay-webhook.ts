import { createFileRoute } from "@tanstack/react-router";

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Razorpay webhook. Verifies the signature, then creates the real order only
 * after payment is captured. Idempotent: a repeated event for an attempt that
 * is already paid is a no-op.
 */
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const body = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const expected = await hmacSha256Hex(secret, body);
        if (!timingSafeEqual(signature, expected)) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(body) as {
          event: string;
          payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
        };
        const payment = event.payload?.payment?.entity;
        if (!payment?.order_id) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: attempt } = await supabaseAdmin
          .from("payment_attempts")
          .select("*")
          .eq("razorpay_order_id", payment.order_id)
          .maybeSingle();
        if (!attempt) return Response.json({ ok: true }); // unknown order, ignore

        if (event.event === "payment.failed") {
          if (attempt.status === "pending") {
            await supabaseAdmin.from("payment_attempts").update({ status: "failed" }).eq("id", attempt.id).eq("status", "pending");
          }
          return Response.json({ ok: true });
        }

        if (event.event !== "payment.captured") return Response.json({ ok: true });
        if (attempt.status === "paid") return Response.json({ ok: true }); // idempotent

        // Create the real order now that money is captured.
        const { data: placed, error } = await supabaseAdmin.rpc("place_order", {
          p_cafe_id: attempt.cafe_id,
          p_customer_name: attempt.customer_name,
          p_notes: attempt.notes ?? undefined,
          p_pickup_at: attempt.pickup_at,
          p_items: attempt.items,
          p_client_hash: attempt.client_hash ?? "",
          p_user_id: attempt.user_id ?? undefined,
        });
        if (error) {
          // Paid but order creation failed (e.g. slot filled while paying).
          // Keep the attempt pending-paid for manual refund handling.
          console.error("place_order after capture failed", error);
          return new Response("Order creation failed", { status: 500 });
        }
        const row = Array.isArray(placed) ? placed[0] : placed;
        if (!row) return new Response("Order creation failed", { status: 500 });
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("tracking_token", row.tracking_token)
          .single();
        if (order) {
          await supabaseAdmin.from("orders").update({ payment_ref: payment.id ?? null }).eq("id", order.id);
          await supabaseAdmin
            .from("payment_attempts")
            .update({ status: "paid", order_id: order.id })
            .eq("id", attempt.id)
            .neq("status", "paid");
        }
        return Response.json({ ok: true });
      },
    },
  },
});
