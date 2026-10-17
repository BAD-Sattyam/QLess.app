import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cartItem = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
  options: z.record(z.string(), z.string()).default({}),
});

const checkoutInput = z.object({
  cafeId: z.string().uuid(),
  customerName: z.string().max(60),
  notes: z.string().max(300).optional(),
  pickupAt: z.string(),
  website: z.string().optional(), // honeypot
  items: z.array(cartItem).min(1).max(20),
});

async function clientHash(userId: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`qless:${userId}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validates the cart server-side, reserves a pending payment attempt and
 * creates a Razorpay order (test mode). Returns demo:true when Razorpay
 * credentials are not configured — demo mode can never create a real order.
 */
export const createPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.website) throw new Error("Something went wrong"); // honeypot
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hash = await clientHash(context.userId);
    const { data: attempt, error } = await supabaseAdmin.rpc("create_payment_attempt", {
      p_cafe_id: data.cafeId,
      p_customer_name: data.customerName,
      p_notes: data.notes ?? "",
      p_pickup_at: data.pickupAt,
      p_items: data.items,
      p_client_hash: hash,
      p_user_id: context.userId,
    });
    if (error) return { ok: false as const, error: error.message };
    const row = Array.isArray(attempt) ? attempt[0] : attempt;
    if (!row) return { ok: false as const, error: "Could not start checkout" };

    const keyId = process.env["RAZORPAY_KEY_ID"];
    const keySecret = process.env["RAZORPAY_KEY_SECRET"];
    if (!keyId || !keySecret) {
      // Demo simulation: the attempt stays pending and expires; no order is ever created.
      return { ok: true as const, demo: true as const, attemptId: row.attempt_id, amount: row.amount_paise };
    }

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      },
      body: JSON.stringify({
        amount: row.amount_paise,
        currency: "INR",
        receipt: row.attempt_id,
        notes: { attempt_id: row.attempt_id },
      }),
    });
    if (!res.ok) {
      await supabaseAdmin.from("payment_attempts").update({ status: "failed" }).eq("id", row.attempt_id);
      return { ok: false as const, error: "Payment service is unavailable. Please try again." };
    }
    const rzOrder = (await res.json()) as { id: string };
    await supabaseAdmin.from("payment_attempts").update({ razorpay_order_id: rzOrder.id }).eq("id", row.attempt_id);

    return {
      ok: true as const,
      demo: false as const,
      attemptId: row.attempt_id,
      amount: row.amount_paise,
      keyId,
      razorpayOrderId: rzOrder.id,
    };
  });

/** Polls a payment attempt the signed-in customer owns; returns the tracking token once paid. */
export const getPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: attempt, error } = await context.supabase
      .from("payment_attempts")
      .select("id, status, expires_at, order_id")
      .eq("id", data.attemptId)
      .single();
    if (error || !attempt) throw new Error("Payment not found");

    let status = attempt.status as string;
    if (status === "pending" && new Date(attempt.expires_at) < new Date()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("payment_attempts").update({ status: "expired" }).eq("id", attempt.id).eq("status", "pending");
      status = "expired";
    }

    let token: string | null = null;
    if (status === "paid" && attempt.order_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: order } = await supabaseAdmin.from("orders").select("tracking_token").eq("id", attempt.order_id).single();
      token = order?.tracking_token ?? null;
    }
    return { status, token };
  });
