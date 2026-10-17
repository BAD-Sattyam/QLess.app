import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyHmac } from "./payment-security";
import { testCredentials, razorpayRequest, confirmCapturedPayment, reconcilePayment } from "./razorpay.server";

const checkoutInput = z.object({
  cafeId: z.string().uuid(), customerName: z.string().trim().min(1).max(60),
  notes: z.string().max(300).optional(), pickupAt: z.string().datetime({ offset: true }),
  website: z.string().max(200).optional(),
  items: z.array(z.object({ menu_item_id: z.string().uuid(), quantity: z.number().int().min(1).max(10), options: z.record(z.string().max(60), z.string().max(80)).default({}) })).min(1).max(20),
});

export const createPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.website) throw new Error("Something went wrong");
    const { keyId } = testCredentials(); // Never create a reservation with absent or live credentials.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("expire_payment_attempts");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`qless:${context.userId}`));
    const { data: attempt, error } = await supabaseAdmin.rpc("create_test_payment_attempt", {
      p_cafe_id: data.cafeId, p_customer_name: data.customerName, p_notes: data.notes ?? "",
      p_pickup_at: data.pickupAt, p_items: data.items,
      p_client_hash: [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join(""),
      p_user_id: context.userId,
    });
    if (error) return { ok: false as const, error: error.message };
    const row = Array.isArray(attempt) ? attempt[0] : attempt;
    if (!row) return { ok: false as const, error: "Could not start checkout" };
    try {
      const rzOrder = z.object({ id: z.string().regex(/^order_[a-zA-Z0-9]+$/), amount: z.number().int(), currency: z.literal("INR") }).parse(
        await razorpayRequest("orders", { amount: row.amount_paise, currency: "INR", receipt: row.attempt_id, notes: { attempt_id: row.attempt_id, qless_mode: "test" } }),
      );
      if (rzOrder.amount !== row.amount_paise) throw new Error("Payment total mismatch");
      const { error: saveError } = await supabaseAdmin.from("payment_attempts").update({ razorpay_order_id: rzOrder.id }).eq("id", row.attempt_id);
      if (saveError) throw new Error("Could not save payment");
      return { ok: true as const, test: true as const, attemptId: row.attempt_id, amount: row.amount_paise, keyId, razorpayOrderId: rzOrder.id };
    } catch {
      await supabaseAdmin.from("payment_attempts").update({ status: "failed" }).eq("id", row.attempt_id).eq("status", "pending");
      return { ok: false as const, error: "Payment service is unavailable. Please try again." };
    }
  });

export const verifyCheckoutPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid(), paymentId: z.string().regex(/^pay_[a-zA-Z0-9]+$/), signature: z.string().regex(/^[a-fA-F0-9]{64}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: attempt } = await context.supabase.from("payment_attempts").select("razorpay_order_id").eq("id", data.attemptId).single();
    if (!attempt?.razorpay_order_id) throw new Error("Payment not found");
    const { keySecret } = testCredentials();
    if (!await verifyHmac(keySecret, `${attempt.razorpay_order_id}|${data.paymentId}`, data.signature)) throw new Error("Payment verification failed");
    return confirmCapturedPayment(data.attemptId, data.paymentId);
  });

export const cancelCheckoutPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: attempt } = await context.supabase.from("payment_attempts").select("id").eq("id", data.attemptId).single();
    if (!attempt) throw new Error("Payment not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Dismissal is not proof of failure: retain pending status until capture/failure/expiry.
    await supabaseAdmin.from("payment_attempts").update({ checkout_cancelled_at: new Date().toISOString() }).eq("id", attempt.id).eq("status", "pending");
    return { ok: true };
  });

export const getPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: attempt } = await context.supabase.from("payment_attempts").select("id,status,expires_at,razorpay_order_id,amount_paise,is_test").eq("id", data.attemptId).single();
    if (!attempt) throw new Error("Payment not found");
    if (attempt.status !== "paid" && attempt.razorpay_order_id) {
      try { await reconcilePayment(attempt.id, attempt.razorpay_order_id); } catch { /* Webhook may still confirm; never report provider outage as failed payment. */ }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("expire_payment_attempts");
    const { data: fresh } = await context.supabase.from("payment_attempts").select("status,amount_paise,is_test,order_id").eq("id", attempt.id).single();
    const { data: order } = fresh?.order_id ? await context.supabase.from("orders").select("tracking_token").eq("id", fresh.order_id).maybeSingle() : { data: null };
    return { trackingToken: order?.tracking_token ?? null, status: fresh?.status ?? attempt.status, test: fresh?.is_test ?? true, amount: fresh?.amount_paise ?? attempt.amount_paise };
  });
