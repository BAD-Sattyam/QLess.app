import { z } from "zod";

export const RESEND_SECONDS = 60;
export const indianMobileSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.").transform((value) => `+91${value}`);
export const otpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your SMS.");
export const displayNameSchema = z.string().trim().max(100, "Name must be 100 characters or fewer.");

export function safeAuthDestination(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return "/orders";
  return value;
}

export function phoneAuthError(error: { message: string; status?: number; code?: string }, verification = false) {
  if (error.status === 429 || error.code?.includes("rate_limit")) return "Too many attempts. Please wait before trying again.";
  if (/provider|disabled|not enabled|configuration|sms.*fail|unsupported/i.test(error.message)) return "SMS sign-in isn't available yet. Please try again after SMS setup is complete.";
  if (verification && /expired|invalid|otp/i.test(error.message)) return "That code is invalid or expired. Try again or request a new code.";
  return verification ? "Couldn't verify the code. Please try again." : "Couldn't send your code. Please check your number and try again.";
}