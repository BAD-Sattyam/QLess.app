import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function useStaff() {
  return useQuery({
    queryKey: ["staff-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sign in first");
      const [{ data: roles }, { data: mems }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("merchant_memberships").select("cafe_id").eq("user_id", uid),
      ]);
      return {
        email: u.user?.email ?? "",
        isAdmin: !!roles?.some((r) => r.role === "admin"),
        cafeIds: (mems ?? []).map((m) => m.cafe_id),
      };
    },
  });
}

export function StaffShell({ children, active }: { children: ReactNode; active: "orders" | "admin" }) {
  const me = useStaff();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/staff/login", replace: true });
  };
  const tab = (on: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-primary-foreground text-primary" : "text-primary-foreground/80"}`;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-espresso text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <span className="mr-auto font-display text-lg font-semibold">Qless</span>
          <Link to="/merchant" className={tab(active === "orders")}>Orders</Link>
          {me.data?.isAdmin && <Link to="/admin" className={tab(active === "admin")}>Admin</Link>}
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut} className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  );
}
