import { z } from "zod";

export const paymentEntity = z.object({
  id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
  order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
  amount: z.number().int().positive(),
  currency: z.string().max(8),
  status: z.string().max(30),
  captured: z.boolean(),
  created_at: z.number().int().positive(),
});
export type PaymentEntity = z.infer<typeof paymentEntity>;

export function assertCapturedPayment(payment: PaymentEntity, orderId: string, amount: number) {
  if (payment.order_id !== orderId || payment.amount !== amount || payment.currency !== "INR") {
    throw new Error("Payment does not match checkout");
  }
  return payment.status === "captured" && payment.captured;
}

export async function verifyHmac(secret: string, message: string, signature: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.match(/.{2}/g) ?? [], (v) => parseInt(v, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(message));
}