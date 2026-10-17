import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a café logo to a displayable URL.
 * Stored values are either an absolute URL or a path in the private
 * `cafe-logos` storage bucket (signed for 24h; reads are cached by react-query).
 */
export async function resolveLogoUrl(logo: string | null | undefined): Promise<string | null> {
  if (!logo) return null;
  if (logo.startsWith("http") || logo.startsWith("/__l5e/")) return logo;
  const { data } = await supabase.storage.from("cafe-logos").createSignedUrl(logo, 86400);
  return data?.signedUrl ?? null;
}
