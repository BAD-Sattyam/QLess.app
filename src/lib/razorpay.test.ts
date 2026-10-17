import { afterEach, expect, it, vi } from "vitest";
import { testCredentials } from "./razorpay.server";

afterEach(() => vi.unstubAllEnvs());
it("blocks non-test credentials before reserving or charging", () => {
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_publicfixture");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "public-fixture-not-a-credential");
  expect(() => testCredentials()).toThrow("Live payments are disabled");
});
it("blocks absent credentials", () => {
  vi.stubEnv("RAZORPAY_KEY_ID", "");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "");
  expect(() => testCredentials()).toThrow("Test payments are not configured");
});