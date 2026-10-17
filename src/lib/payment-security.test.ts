import { describe, expect, it } from "vitest";
import { assertCapturedPayment, verifyHmac } from "./payment-security";

const payment = { id: "pay_fixture", order_id: "order_fixture", amount: 9800, currency: "INR", status: "captured", captured: true, created_at: 1700000000 };
describe("Razorpay payment rules", () => {
  it("accepts only captured payments for the stored order and exact paise total", () => {
    expect(assertCapturedPayment(payment, "order_fixture", 9800)).toBe(true);
    expect(() => assertCapturedPayment(payment, "order_another", 9800)).toThrow();
    expect(() => assertCapturedPayment(payment, "order_fixture", 9801)).toThrow();
    expect(() => assertCapturedPayment({ ...payment, currency: "USD" }, "order_fixture", 9800)).toThrow();
  });
  it("never confirms merely authorized or failed payments", () => {
    expect(assertCapturedPayment({ ...payment, status: "authorized", captured: false }, "order_fixture", 9800)).toBe(false);
    expect(assertCapturedPayment({ ...payment, status: "failed", captured: false }, "order_fixture", 9800)).toBe(false);
    expect(assertCapturedPayment({ ...payment, captured: false }, "order_fixture", 9800)).toBe(false);
  });
  it("verifies the exact signed payload and rejects changed or malformed signatures", async () => {
    const fixture = "public-test-fixture-not-a-credential";
    const body = "order_fixture|pay_fixture";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(fixture), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
    const signature = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(await verifyHmac(fixture, body, signature)).toBe(true);
    expect(await verifyHmac(fixture, "order_tampered|pay_fixture", signature)).toBe(false);
    expect(await verifyHmac(fixture, body, "bad")).toBe(false);
  });
});