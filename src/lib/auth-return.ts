export const QLESS_SITE_URL = "https://pixel-perfect-pixie-640.lovable.app";
export const QLESS_AUTH_CALLBACK = `${QLESS_SITE_URL}/auth/callback`;
export const QLESS_PASSWORD_RESET = `${QLESS_SITE_URL}/reset-password`;

export type EmailReturnType = "signup" | "invite" | "recovery" | "email" | "email_change" | "magiclink";
export function emailReturnType(value: string | null): EmailReturnType | undefined {
  if (value === "signup" || value === "invite" || value === "recovery" || value === "email" || value === "email_change" || value === "magiclink") return value;
}

// Destinations are determined by protected role/membership reads, never email or URL claims.
export function emailReturnDestination(access: { isAdmin: boolean; cafeIds: string[] }): "/" | "/admin" | "/merchant" {
  if (access.isAdmin) return "/admin";
  if (access.cafeIds.length) return "/merchant";
  return "/";
}