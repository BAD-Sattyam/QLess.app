import { beforeEach, describe, expect, it } from "vitest";
import { emailAuthError, emailSchema, passwordSchema, sameOriginUrl, safeReturnPath, saveAuthReturn, takeAuthReturn } from "./email-auth";

// The suite may run without a DOM: give the helpers a storage stub so the round trip is real.
if (typeof (globalThis as Record<string, unknown>)["sessionStorage"] === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      setItem: (key: string, value: string) => store.set(key, String(value)),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  });
}

beforeEach(() => sessionStorage.clear());

describe("emailSchema", () => {
  it("trims and lowercases a valid address", () => {
    expect(emailSchema.safeParse("  User@Example.COM ").data).toBe("user@example.com");
  });

  it("rejects addresses that cannot receive mail", () => {
    expect(emailSchema.safeParse("plainaddress").success).toBe(false);
    expect(emailSchema.safeParse("user@localhost").success).toBe(false);
    expect(emailSchema.safeParse("user@example").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires at least 8 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });
});

describe("safeReturnPath", () => {
  it("accepts same-origin app paths only", () => {
    expect(safeReturnPath("/checkout")).toBe("/checkout");
    expect(safeReturnPath("//evil.example/steal")).toBe("/");
    expect(safeReturnPath("https://evil.example/steal")).toBe("/");
    expect(safeReturnPath("/orders?tab=1")).toBe("/orders?tab=1");
    expect(safeReturnPath(undefined, "/orders")).toBe("/orders");
  });
});

describe("auth return storage", () => {
  it("remembers the page the customer came from, then forgets it", () => {
    expect(saveAuthReturn("/checkout")).toBe("/checkout");
    expect(takeAuthReturn("/orders")).toBe("/checkout");
    // Consumed: a later visit cannot reuse a stale destination.
    expect(takeAuthReturn("/orders")).toBe("/orders");
  });

  it("never stores an off-site destination", () => {
    expect(saveAuthReturn("//evil.example/steal", "/orders")).toBe("/orders");
    expect(takeAuthReturn("/orders")).toBe("/orders");
  });
});

describe("sameOriginUrl", () => {
  it("builds the callback on the site the customer is actually using", () => {
    const url = sameOriginUrl("/auth/callback");
    expect(url === "/auth/callback" || /^https?:\/\/[^/]+\/auth\/callback$/.test(url)).toBe(true);
  });
});

describe("emailAuthError", () => {
  it("explains wrong credentials without leaking provider detail", () => {
    expect(emailAuthError({ message: "Invalid login credentials" })).toBe("That email and password don't match. Try again, or reset your password.");
  });

  it("points an unconfirmed customer at their inbox", () => {
    expect(emailAuthError({ message: "Email not confirmed" })).toBe("Confirm your email first — we sent a link to your inbox.");
  });

  it("explains throttling and duplicate signups", () => {
    expect(emailAuthError({ message: "rate limit exceeded", status: 429 })).toBe("Too many attempts. Please wait a minute and try again.");
    expect(emailAuthError({ message: "User already registered" })).toBe("An account with this email already exists. Sign in instead.");
  });

  it("asks for a stronger password and hides anything unrecognised", () => {
    expect(emailAuthError({ message: "Password should be at least 8 characters" })).toBe("That password doesn't meet the requirements. Use at least 8 characters.");
    expect(emailAuthError({ message: "unexpected provider failure" })).toBe("Couldn't sign you in. Please try again.");
  });
});
