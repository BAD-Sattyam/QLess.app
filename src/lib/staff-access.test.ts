import { describe, expect, it } from "vitest";
import { canAccessStaff } from "./staff-access";

describe("staff permissions", () => {
  it("denies customers without a restaurant assignment", () => {
    expect(canAccessStaff({ isAdmin: false, cafeIds: [] })).toBe(false);
  });
  it("allows assigned staff but not administrator access", () => {
    const staff = { isAdmin: false, cafeIds: ["restaurant-a"] };
    expect(canAccessStaff(staff)).toBe(true);
    expect(canAccessStaff(staff, true)).toBe(false);
  });
  it("allows a server-verified administrator", () => {
    expect(canAccessStaff({ isAdmin: true, cafeIds: [] }, true)).toBe(true);
  });
});