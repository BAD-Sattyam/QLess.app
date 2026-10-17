import { supabase } from "@/integrations/supabase/client";
import { displayNameSchema } from "@/lib/phone-auth";

const PENDING_NAME_KEY = "qless-pending-name";

// Email signup has no session yet (confirmation is required first), so the name waits here.
export function savePendingDisplayName(value: string): void {
  const parsed = displayNameSchema.safeParse(value);
  if (!parsed.success || !parsed.data) return;
  try { sessionStorage.setItem(PENDING_NAME_KEY, parsed.data); } catch { /* storage unavailable */ }
}

// Owner-scoped RLS and the database length check apply; a name the customer already set is never overwritten.
export async function applyPendingDisplayName(userId: string): Promise<void> {
  let value: string | null = null;
  try {
    value = sessionStorage.getItem(PENDING_NAME_KEY);
    sessionStorage.removeItem(PENDING_NAME_KEY);
  } catch { return; }
  const parsed = displayNameSchema.safeParse(value ?? "");
  if (!parsed.success || !parsed.data) return;
  await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", userId).eq("display_name", "");
}
