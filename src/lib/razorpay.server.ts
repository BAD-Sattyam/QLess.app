import { z } from "zod";
import { assertCapturedPayment, paymentEntity } from "./payment-security";

export function testCredentials() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Test payments are not configured yet.");
  if (!keyId.startsWith("rzp_test_")) throw new Error("Live payments are disabled. Configure Razorpay test credentials.");
  return { keyId, keySecret };
}

export async function razorpayRequest(path: string, body?: unknown) {
  const { keyId, keySecret } = testCredentials();
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Payment service is unavailable. Please try again.");
  return response.json() as Promise<unknown>;
}

export async function confirmCapturedPayment(attemptId: string, paymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: attempt, error } = await supabaseAdmin.from("payment_attempts")
    .select("id, razorpay_order_id, amount_paise, is_test").eq("id", attemptId).single();
  if (error || !attempt?.razorpay_order_id || !attempt.is_test) throw new Error("Payment not found");
  const payment = paymentEntity.parse(await razorpayRequest(`payments/${encodeURIComponent(paymentId)}`));
  if (!assertCapturedPayment(payment, attempt.razorpay_order_id, attempt.amount_paise)) return { status: "pending" as const };
  const { error: finalError } = await supabaseAdmin.rpc("finalize_test_payment", {
    p_attempt_id: attemptId, p_razorpay_order_id: attempt.razorpay_order_id, p_payment_id: payment.id,
    p_amount: payment.amount, p_currency: payment.currency,
    p_captured_at: new Date(payment.created_at * 1000).toISOString(),
  });
  if (finalError) throw new Error("Could not confirm payment. Please check again.");
  return { status: "paid" as const };
}

export async function reconcilePayment(attemptId: string, orderId: string) {
  const result = z.object({ items: z.array(paymentEntity).max(100) }).parse(
    await razorpayRequest(`orders/${encodeURIComponent(orderId)}/payments`),
  );
  for (const payment of result.items) {
    if (payment.status === "captured" && payment.captured) return confirmCapturedPayment(attemptId, payment.id);
  }
  return { status: "pending" as const };
}