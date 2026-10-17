import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStaffAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [roles, memberships] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase.from("merchant_memberships").select("cafe_id").eq("user_id", context.userId),
    ]);
    if (roles.error || memberships.error) throw new Error("Could not verify staff access");
    return { isAdmin: roles.data.some((r) => r.role === "admin"), cafeIds: memberships.data.map((m) => m.cafe_id) };
  });