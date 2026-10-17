import { describe, expect, it } from "vitest";
import { emailReturnDestination, emailReturnType, QLESS_AUTH_CALLBACK, QLESS_PASSWORD_RESET } from "./auth-return";

describe("Qless email returns", () => {
  it("keeps email destinations on the published Qless website", () => {
    expect(QLESS_AUTH_CALLBACK).toBe("https://pixel-perfect-pixie-640.lovable.app/auth/callback");
    expect(QLESS_PASSWORD_RESET).toBe("https://pixel-perfect-pixie-640.lovable.app/reset-password");
  });
  it("returns customers to the homepage", () => expect(emailReturnDestination({ isAdmin: false, cafeIds: [] })).toBe("/"));
  it("returns assigned staff to their protected dashboard", () => expect(emailReturnDestination({ isAdmin: false, cafeIds: ["dohful"] })).toBe("/merchant"));
  it("returns administrators to their protected dashboard", () => expect(emailReturnDestination({ isAdmin: true, cafeIds: ["dohful"] })).toBe("/admin"));
  it("does not accept arbitrary provider action types", () => {
    expect(emailReturnType("recovery")).toBe("recovery");
    expect(emailReturnType("invite")).toBe("invite");
    expect(emailReturnType("admin")).toBeUndefined();
  });
});