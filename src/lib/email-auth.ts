import { z } from "zod";

// Intended destination after a full-page provider redirect (Google / Lovable).
export const AUTH_RETURN_KEY = "qless-auth-return";

export const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .min(3, "Enter a valid email address.")
  .max(254, "Enter a valid email address.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address.");

// Leaked-password protection runs server-side; this is the minimum the form enforces.
export const passwordSchema = z.string().min(8, "Choose a password of at least 8 characters.").max(200);

// Only same-origin app paths are ever used as a post-sign-in destination.
export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return fallback;
  return value;
}

export function saveAuthReturn(value: string | null | undefined, fallback = "/"): string {
  const safe = safeReturnPath(value, fallback);
  try { sessionStorage.setItem(AUTH_RETURN_KEY, safe); } catch { /* storage unavailable: fall through to default */ }
  return safe;
}

export function takeAuthReturn(fallback = "/"): string {
  let value: string | null = null;
  try {
    value = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch { return fallback; }
  return safeReturnPath(value, fallback);
}

// Email links and provider callbacks must land on whatever origin the customer is actually using.
export function sameOriginUrl(path: string): string {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return origin ? `${origin}${path}` : path;
}

// Raw auth messages are never shown to customers: they leak provider detail and read as jargon.
export function emailAuthError(error: { message: string; status?: number | undefined; code?: string | undefined }, signup = false): string {
  const message = error.message.toLowerCase();
  if (error.status === 429 || message.includes("rate_limit") || message.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (message.includes("invalid login credentials")) return "That email and password don't match. Try again, or reset your password.";
  if (message.includes("not confirmed") || message.includes("not yet verified") || message.includes("confirm your email")) return "Confirm your email first — we sent a link to your inbox.";
  if (message.includes("already registered") || message.includes("already exists") || message.includes("already been registered")) return "An account with this email already exists. Sign in instead.";
  if (message.includes("not allowed") || message.includes("placeholder") || message.includes("reserved") || message.includes("mistyped") || message.includes("cannot receive email")) return "That email address can't receive mail. Please use a different one.";
  if (message.includes("password")) return "That password doesn't meet the requirements. Use at least 8 characters.";
  if (message.includes("invalid email") || message.includes("email address")) return "Check the email address and try again.";
  return signup ? "Couldn't create your account. Please try again." : "Couldn't sign you in. Please try again.";
}
