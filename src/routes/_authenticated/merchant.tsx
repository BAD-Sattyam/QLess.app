import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, useStaff } from "@/components/StaffShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LABELS, formatINR, formatTimeIST, istDayStart } from "@/lib/pricing";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["order_status"];

export const Route = createFileRoute("/_authenticated/merchant")({
  head: () => ({
    meta: [
      { title: "Orders — CoffeeSkip staff" },
      { name: "description", content: "Manage incoming pre-orders." },
      { property: "og:title", content: "Orders — CoffeeSkip staff" },
      { property: "og:description", content: "Manage incoming pre-orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerchantPage,
});

function MerchantPage() {
  const me = useStaff();
  const qc = useQueryClient();
  const cafesQ = useQuery({
    enabled: !!me.data,
    queryKey: ["staff-cafes", me.data?.isAdmin, me.data?.cafeIds],
    queryFn: async () => {
      let q = supabase.from("cafes").select("*").order("name");
      if (!me.data!.isAdmin) q = q.in("id", me.data!.cafeIds.length ? me.data!.cafeIds : ["00000000-0000-0000-0000-000000000000"]);
      return (await q).data ?? [];
    },
  });
  const [cafeId, setCafeId] = useState<string | null>(null);
  useEffect(() => {
    if (!cafeId && cafesQ.data?.[0]) setCafeId(cafesQ.data[0].id);
  }, [cafesQ.data, cafeId]);

  if (me.isLoading || cafesQ.isLoading)
    return <StaffShell active="orders"><Skeleton className="h-40 w-full" /></StaffShell>;

  if (!cafesQ.data?.length) {
    return (
      <StaffShell active="orders">
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="text-2xl font-semibold">No café access yet</h1>
          <p className="mt-2 text-muted-foreground">Signed in as {me.data?.email}. Ask the CoffeeSkip admin to assign you to a café.</p>
          {me.data && !me.data.adminExists && (
            <Button className="mt-6 rounded-full" size="lg" onClick={async () => {
              const { error } = await supabase.rpc("claim_first_admin");
              if (error) { toast.error(error.message); return; }
              toast.success("You are now the admin");
              qc.invalidateQueries();
            }}>Set me up as the first admin</Button>
          )}
        </div>
      </StaffShell>
    );
  }

  const cafe = cafesQ.data.find((c) => c.id === cafeId) ?? cafesQ.data[0]!;
  return (
    <StaffShell active="orders">
      {cafesQ.data.length > 1 && (
        <select value={cafe.id} onChange={(e) => setCafeId(e.target.value)} className="mb-4 h-11 w-full rounded-xl border bg-card px-3 font-semibold">
          {cafesQ.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <CafeOrders cafe={cafe} />
    </StaffShell>
  );
}

function CafeOrders({ cafe }: { cafe: Database["public"]["Tables"]["cafes"]["Row"] }) {
  const qc = useQueryClient();
  const ordersKey = ["orders", cafe.id];
  const ordersQ = useQuery({
    queryKey: ordersKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("cafe_id", cafe.id)
        .gte("pickup_at", istDayStart().toISOString())
        .order("pickup_at");
      if (error) throw error;
      return data;
    },
  });
  const menuQ = useQuery({
    queryKey: ["staff-menu", cafe.id],
    queryFn: async () => (await supabase.from("menu_items").select("*").eq("cafe_id", cafe.id).eq("is_active", true).order("sort_order")).data ?? [],
  });

  useEffect(() => {
    const ch = supabase
      .channel(`orders-${cafe.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafe.id}` }, (p) => {
        if (p.eventType === "INSERT") toast.success(`New order ${(p.new as { pickup_code: string }).pickup_code}`);
        qc.invalidateQueries({ queryKey: ["orders", cafe.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cafe.id, qc]);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [accepting, setAccepting] = useState(cafe.accepting_orders);
  useEffect(() => setAccepting(cafe.accepting_orders), [cafe.accepting_orders]);

  const act = async (id: string, status: Status, r?: string) => {
    const { error } = await supabase.rpc("update_order_status", { p_order_id: id, p_status: status, ...(r ? { p_reason: r } : {}) });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ordersKey });
  };

  const orders = ordersQ.data ?? [];
  const active = orders.filter((o) => ["pending", "accepted", "preparing", "ready"].includes(o.status));
  const done = orders.filter((o) => !active.includes(o));

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled");
    const preps = valid
      .filter((o) => o.ready_at && (o.preparing_at || o.accepted_at))
      .map((o) => (new Date(o.ready_at!).getTime() - new Date((o.preparing_at ?? o.accepted_at)!).getTime()) / 60000);
    return {
      count: valid.length,
      value: valid.reduce((n, o) => n + o.total_paise, 0),
      avgPrep: preps.length ? Math.round(preps.reduce((a, b) => a + b, 0) / preps.length) : null,
    };
  }, [orders]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{cafe.name}</h1>
        <label className={`flex min-h-12 items-center gap-3 rounded-full px-4 font-semibold ${accepting ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
          {accepting ? "Accepting orders" : "Orders paused"}
          <Switch checked={accepting} onCheckedChange={async (v) => {
            setAccepting(v);
            const { error } = await supabase.rpc("set_cafe_accepting", { p_cafe_id: cafe.id, p_accepting: v });
            if (error) { setAccepting(!v); { toast.error(error.message); return; } }
            qc.invalidateQueries({ queryKey: ["staff-cafes"] });
          }} />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Orders today" value={String(stats.count)} />
        <Stat label="Order value" value={formatINR(stats.value)} />
        <Stat label="Avg prep" value={stats.avgPrep == null ? "—" : `${stats.avgPrep} min`} />
      </div>

      <Tabs defaultValue="active" className="mt-5">
        <TabsList className="h-12 w-full">
          <TabsTrigger value="active" className="h-10 flex-1">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="done" className="h-10 flex-1">Done ({done.length})</TabsTrigger>
          <TabsTrigger value="stock" className="h-10 flex-1">Stock</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {ordersQ.isLoading && <Skeleton className="h-32 w-full" />}
          {ordersQ.isError && <p className="py-8 text-center text-destructive">Couldn't load orders.</p>}
          {!ordersQ.isLoading && active.length === 0 && <p className="py-12 text-center text-muted-foreground">No active orders. New orders appear here instantly.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((o) => <OrderCard key={o.id} o={o} act={act} onCancel={() => { setCancelId(o.id); setReason(""); }} />)}
          </div>
        </TabsContent>
        <TabsContent value="done">
          {done.length === 0 && <p className="py-12 text-center text-muted-foreground">Nothing completed yet today.</p>}
          <div className="grid gap-3 md:grid-cols-2">{done.map((o) => <OrderCard key={o.id} o={o} act={act} onCancel={() => {}} />)}</div>
        </TabsContent>
        <TabsContent value="stock">
          <ul className="divide-y rounded-2xl border bg-card">
            {(menuQ.data ?? []).map((m) => (
              <li key={m.id} className="flex min-h-14 items-center justify-between px-4">
                <span className={m.is_available ? "font-medium" : "font-medium text-muted-foreground line-through"}>{m.name}</span>
                <label className="flex items-center gap-2 text-sm">
                  {m.is_available ? "In stock" : "Out of stock"}
                  <Switch checked={m.is_available} onCheckedChange={async (v) => {
                    const { error } = await supabase.rpc("set_item_availability", { p_item_id: m.id, p_available: v });
                    if (error) { toast.error(error.message); return; }
                    qc.invalidateQueries({ queryKey: ["staff-menu", cafe.id] });
                  }} />
                </label>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel order</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">
            {["Item out of stock", "Café closing early", "Customer request"].map((r) => (
              <button key={r} onClick={() => setReason(r)} className="min-h-10 rounded-full border px-3 text-sm">{r}</button>
            ))}
          </div>
          <Textarea value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the customer" />
          <DialogFooter>
            <Button variant="destructive" size="lg" disabled={reason.trim().length < 2} onClick={async () => { await act(cancelId!, "cancelled", reason); setCancelId(null); }}>
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold sm:text-2xl">{value}</p>
    </div>
  );
}

type OrderRow = Database["public"]["Tables"]["orders"]["Row"] & { order_items: Database["public"]["Tables"]["order_items"]["Row"][] };

const NEXT: Partial<Record<Status, { to: Status; label: string }>> = {
  pending: { to: "accepted", label: "Accept" },
  accepted: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "collected", label: "Mark collected" },
};

function OrderCard({ o, act, onCancel }: { o: OrderRow; act: (id: string, s: Status) => void; onCancel: () => void }) {
  const next = NEXT[o.status];
  const tone =
    o.status === "pending" ? "border-accent bg-accent/10" : o.status === "ready" ? "border-success bg-success/10" : "bg-card";
  return (
    <article className={`rounded-2xl border-2 p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-3xl font-semibold tracking-widest">{o.pickup_code}</p>
          <p className="text-sm text-muted-foreground">{o.customer_name}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{formatTimeIST(o.pickup_at)}</p>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{STATUS_LABELS[o.status]}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {o.order_items.map((i) => (
          <li key={i.id}>
            <strong>{i.quantity}×</strong> {i.name}
            {Object.values((i.options as Record<string, string>) ?? {}).length > 0 && (
              <span className="text-muted-foreground"> — {Object.values(i.options as Record<string, string>).join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
      {o.notes && <p className="mt-2 rounded-lg bg-warning/25 p-2 text-sm"><strong>Note:</strong> {o.notes}</p>}
      {o.cancel_reason && <p className="mt-2 text-sm text-destructive">Cancelled: {o.cancel_reason}</p>}
      <p className="mt-2 text-sm font-semibold">Collect {formatINR(o.total_paise)} at pickup</p>
      {next && (
        <div className="mt-3 flex gap-2">
          <Button size="lg" className="h-12 flex-1 rounded-xl text-base" onClick={() => act(o.id, next.to)}>{next.label}</Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </article>
  );
}
