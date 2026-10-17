import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, single } = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
    rpc,
  },
}));
import { confirmCapturedPayment, reconcilePayment } from "./razorpay.server";

const payment = { id: "pay_demoFixture", order_id: "order_demoFixture", amount: 9800, currency: "INR", status: "captured", captured: true, created_at: 1792249000 };

beforeEach(() => {
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_publicfixture");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "public-fixture-not-a-credential");
  single.mockResolvedValue({ data: { id: "attempt", razorpay_order_id: "order_demoFixture", amount_paise: 9800, is_test: true }, error: null });
  rpc.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function provider(entity: typeof payment) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => entity }));
}
describe("verified test fulfillment boundary", () => {
  it("reports an unpaid provider order without creating fulfillment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    expect(await reconcilePayment("attempt", "order_demoFixture")).toEqual({ status: "pending", providerStatus: "no_payment" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports authorization as pending capture, not paid fulfillment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ ...payment, status: "authorized", captured: false }] }) }));
    expect(await reconcilePayment("attempt", "order_demoFixture")).toEqual({ status: "pending", providerStatus: "authorized" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("passes provider-confirmed ₹98 capture to atomic demo finalization", async () => {
    provider(payment);
    expect(await confirmCapturedPayment("attempt", payment.id)).toEqual({ status: "paid" });
    expect(rpc).toHaveBeenCalledWith("finalize_test_payment", {
      p_attempt_id: "attempt", p_razorpay_order_id: "order_demoFixture", p_payment_id: "pay_demoFixture",
      p_amount: 9800, p_currency: "INR", p_captured_at: new Date(1792249000 * 1000).toISOString(),
    });
  });
  it.each(["authorized", "failed"])("does not finalize %s payments", async (status) => {
    provider({ ...payment, status, captured: false });
    expect(await confirmCapturedPayment("attempt", payment.id)).toEqual({ status: "pending" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects tampered amount before fulfillment", async () => {
    provider({ ...payment, amount: 9801 });
    await expect(confirmCapturedPayment("attempt", payment.id)).rejects.toThrow("does not match");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects another provider order before fulfillment", async () => {
    provider({ ...payment, order_id: "order_another" });
    await expect(confirmCapturedPayment("attempt", payment.id)).rejects.toThrow("does not match");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects non-test attempts before calling the provider", async () => {
    provider(payment);
    single.mockResolvedValue({ data: { razorpay_order_id: "order_demoFixture", is_test: false }, error: null });
    await expect(confirmCapturedPayment("attempt", payment.id)).rejects.toThrow("Payment not found");
    expect(fetch).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});