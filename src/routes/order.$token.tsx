import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/CafeView";
import { STATUS_LABELS, formatINR, formatTimeIST } from "@/lib/pricing";
import { resolveLogoUrl } from "@/lib/logo";

type TrackedOrder = {
  pickup_code: string;
  customer_name: string;
  status: string;
  pickup_at: string;
  total_paise: number;
  notes: string | null;
  cancel_reason: string | null;
  cafe: { name: string; address: string; slug: string; logo_url: string | null };
  items: { name: string; quantity: number; options: Record<string, string>; line_total_paise: number }[];
};

export const Route = createFileRoute("/order/$token")({
  validateSearch: (s: Record<string, unknown>) => ({ new: s["new"] ? 1 : undefined }) as { new?: 1 },
  head: () => ({
    meta: [
      { title: "Track your order — Qless" },
      { name: "description", content: "Live status of your Qless pre-order." },
      { property: "og:title", content: "Track your order — Qless" },
      { property: "og:description", content: "Live status of your Qless pre-order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackPage,
});

const STEPS = ["pending", "accepted", "preparing", "ready", "collected"];

function TrackPage() {
  const { token } = Route.useParams();
  const { new: isNew } = Route.useSearch();
  const q = useQuery({
    queryKey: ["track", token],
    refetchInterval: (query) => {
      const s = (query.state.data as TrackedOrder | null)?.status;
      return s === "collected" || s === "cancelled" ? false : 8000;
    },
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_order_by_token", { p_token: token });
      if (error) throw error;
      return data as unknown as TrackedOrder | null;
    },
  });

  if (q.isLoading)
    return <div className="mx-auto max-w-xl space-y-4 p-4"><Skeleton className="h-48 w-full rounded-3xl" /><Skeleton className="h-32 w-full" /></div>;
  if (q.isError) return <Empty title="Couldn't load your order" body="Check your connection and refresh this page." />;
  const o = q.data;
  if (!o) return <Empty title="Order not found" body="This tracking link is invalid." />;

  const idx = STEPS.indexOf(o.status);
  const cancelled = o.status === "cancelled";

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-12 pt-6">
      {isNew && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-success p-4 font-semibold text-success-foreground">
          <Check className="size-5" /> Order placed! Bookmark this page to track it.
        </div>
      )}
      <section className="rounded-3xl bg-espresso p-6 text-center text-primary-foreground shadow-soft">
        <p className="text-sm uppercase tracking-widest opacity-80">Pickup code</p>
        <p className="mt-1 font-display text-6xl font-semibold tracking-[0.2em]">{o.pickup_code}</p>
        <p className="mt-3 opacity-90">for {o.customer_name} · ready by <strong>{formatTimeIST(o.pickup_at)}</strong></p>
        <p className="mt-1 text-sm opacity-75">{o.cafe.name}</p>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Status</p>
        <p className={`font-display text-2xl font-semibold ${cancelled ? "text-destructive" : "text-primary"}`}>{STATUS_LABELS[o.status]}</p>
        {cancelled && o.cancel_reason && <p className="mt-1 text-sm text-muted-foreground">Reason: {o.cancel_reason}</p>}
        {!cancelled && (
          <ol className="mt-4 grid grid-cols-5 gap-1">
            {STEPS.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`h-2 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
                <p className={`mt-1.5 text-[11px] leading-tight ${i <= idx ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{STATUS_LABELS[s]}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-4 rounded-2xl border bg-card p-5">
        <ul className="space-y-2">
          {o.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3 text-sm">
              <span>{it.quantity}× {it.name}{Object.values(it.options ?? {}).length > 0 && <span className="block text-muted-foreground">{Object.values(it.options).join(" · ")}</span>}</span>
              <span className="font-medium">{formatINR(it.line_total_paise)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-semibold"><span>Total to pay</span><span>{formatINR(o.total_paise)}</span></div>
      </section>

      <div className="mt-4 flex gap-3 rounded-2xl bg-secondary p-4 text-sm">
        <Wallet className="size-5 shrink-0 text-primary" />
        <p><strong>Pay at pickup.</strong> Show your code at the counter and pay the café directly. This order is not paid yet.</p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Button variant="outline" size="lg" className="h-12 rounded-full" onClick={() => { navigator.clipboard.writeText(window.location.origin + window.location.pathname); toast.success("Tracking link copied"); }}>
          <Copy className="size-4" /> Copy tracking link
        </Button>
        <Button asChild variant="ghost" size="lg" className="h-12 rounded-full"><Link to="/">Order something else</Link></Button>
      </div>
    </div>
  );
}
