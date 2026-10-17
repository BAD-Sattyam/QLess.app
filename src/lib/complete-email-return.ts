import { supabase } from "@/integrations/supabase/client";
import { emailReturnType } from "./auth-return";

export async function completeEmailReturn(url: URL, defaultType?: "recovery") {
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has("error") || hash.has("error")) throw new Error("This email link is invalid or expired. Request a new link.");
  const type = emailReturnType(url.searchParams.get("type") ?? hash.get("type")) ?? defaultType;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash) {
    if (!type) throw new Error("This email link is incomplete. Request a new link.");
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw new Error("This email link is invalid or expired. Request a new link.");
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error("This email link could not be verified. Open it in the browser that requested it, or request a new link.");
  } else if (!hash.get("access_token") || !hash.get("refresh_token")) {
    throw new Error("No verification link was supplied. Request a new email link.");
  }
  // The generated client handles implicit hash tokens. Await initialization and revalidate
  // the resulting identity with the provider before navigating or accepting a password.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error("Sign-in could not be completed. Request a new email link.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sign-in could not be verified. Request a new email link.");
  return { userId: data.user.id, type };
}