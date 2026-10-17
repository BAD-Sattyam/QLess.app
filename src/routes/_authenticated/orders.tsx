import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABELS, formatINR } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My orders — Qless" },
      { name: "description", content: "Your Qless order history and live order status." },
      { property: "og:title", content: "My orders — Qless" },
      { property: "og:description", content: "Your Qless order history and live order status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyOrders,
});

function MyOrders() {
  const ordersQ = useQuery({
    queryKey: ["my-orders"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, tracking_token, pickup_code, status, total_paise, pickup_at, created_at, cafes(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16 pt-4">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to menu
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">My orders</h1>

      {ordersQ.isLoading && (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {ordersQ.data?.length === 0 && (
        <div className="mt-16 text-center">
          <Package className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Your orders will appear here once you place one.</p>
          <Button asChild size="lg" className="mt-6 rounded-full"><Link to="/">Browse menu</Link></Button>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {ordersQ.data?.map((o) => (
          <li key={o.id}>
            <Link
              to="/order/$token"
              params={{ token: o.tracking_token }}
              className="block rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{(o.cafes as { name: string } | null)?.name ?? "Café"}</p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Pickup {new Date(o.pickup_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  {" · "}Code {o.pickup_code}
                </span>
                <span className="font-semibold text-foreground">{formatINR(o.total_paise)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
