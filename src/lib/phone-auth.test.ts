import { describe, expect, it } from "vitest";
import { indianMobileSchema, otpSchema, RESEND_SECONDS, safeAuthDestination } from "./phone-auth";

describe("customer phone rules", () => {
  it("uses +91 with valid 10-digit Indian numbers", () => {
    expect(indianMobileSchema.parse("9876543210")).toBe("+919876543210");
    expect(indianMobileSchema.safeParse("5876543210").success).toBe(false);
    expect(indianMobileSchema.safeParse("987654321").success).toBe(false);
    expect(indianMobileSchema.safeParse("98765432100").success).toBe(false);
  });
  it("requires exactly six numeric OTP digits", () => {
    expect(otpSchema.safeParse("123456").success).toBe(true);
    expect(otpSchema.safeParse("12345").success).toBe(false);
    expect(otpSchema.safeParse("1234567").success).toBe(false);
    expect(otpSchema.safeParse("12a456").success).toBe(false);
  });
  it("waits 60 seconds before resending", () => { expect(RESEND_SECONDS).toBe(60); });
  it("keeps sign-in redirects same origin", () => {
    expect(safeAuthDestination("/checkout")).toBe("/checkout");
    expect(safeAuthDestination("//evil.example")).toBe("/orders");
    expect(safeAuthDestination("/\\evil.example")).toBe("/orders");
  });
});