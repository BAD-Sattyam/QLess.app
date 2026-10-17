import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Minus, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart";
import { formatINR, formatTimeIST } from "@/lib/pricing";
import { placeOrder } from "@/lib/orders.functions";
import { Empty } from "@/components/CafeView";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Your cart — CoffeeSkip" },
      { name: "description", content: "Choose a pickup time and place your pre-order." },
      { property: "og:title", content: "Your cart — CoffeeSkip" },
      { property: "og:description", content: "Choose a pickup time and place your pre-order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(placeOrder);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cafeQ = useQuery({
    enabled: !!cart.cafeId,
    queryKey: ["cafe-by-id", cart.cafeId],
    queryFn: async () => (await supabase.from("cafes").select("*").eq("id", cart.cafeId!).single()).data,
  });
  const slotsQ = useQuery({
    enabled: !!cart.cafeId,
    queryKey: ["slots", cart.cafeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_slots", { p_cafe_id: cart.cafeId! });
      if (error) throw error;
      return data;
    },
  });

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <Empty title="Your cart is empty" body="Add a coffee or a snack to get started." />
        <div className="text-center"><Button asChild size="lg" className="rounded-full"><Link to="/">Browse menu</Link></Button></div>
      </div>
    );
  }

  const onSubmit = async () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (!slot) { toast.error("Please choose a pickup time"); return; }
    setBusy(true);
    try {
      const res = await submit({
        data: {
          cafeId: cart.cafeId!,
          customerName: name,
          notes,
          pickupAt: slot,
          website: hp,
          items: cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity, options: l.options })),
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        qc.invalidateQueries({ queryKey: ["slots"] });
        return;
      }
      cart.clear();
      navigate({ to: "/order/$token", params: { token: res.token }, search: { new: 1 }, replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? "Please check your details and try again." : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const slots = (slotsQ.data ?? []).filter((s) => s.remaining > 0);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-36 pt-4">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to menu
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">Your order</h1>
      {cafeQ.data && <p className="text-muted-foreground">{cafeQ.data.name}</p>}

      <ul className="mt-5 divide-y rounded-2xl border bg-card">
        {cart.lines.map((l) => (
          <li key={l.key} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{l.name}</p>
              {Object.values(l.options).length > 0 && (
                <p className="text-sm text-muted-foreground">{Object.values(l.options).join(" · ")}</p>
              )}
              <p className="mt-1 text-sm font-semibold text-primary">{formatINR(l.unit_price_paise * l.quantity)}</p>
            </div>
            <div className="flex items-center rounded-full border">
              <button aria-label="Decrease" className="flex size-11 items-center justify-center" onClick={() => cart.setQty(l.key, l.quantity - 1)}><Minus className="size-4" /></button>
              <span className="w-5 text-center font-semibold">{l.quantity}</span>
              <button aria-label="Increase" className="flex size-11 items-center justify-center" onClick={() => cart.setQty(l.key, l.quantity + 1)}><Plus className="size-4" /></button>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Pickup time (today)</h2>
        {slotsQ.isLoading && <Skeleton className="mt-3 h-24 w-full" />}
        {slotsQ.isError && <p className="mt-2 text-sm text-destructive">Couldn't load pickup times. Pull to refresh.</p>}
        {slotsQ.data && slots.length === 0 && (
          <p className="mt-2 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            No pickup slots left today. The café may be closed or fully booked.
          </p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.slice(0, 36).map((s) => (
            <button
              key={s.slot}
              onClick={() => setSlot(s.slot)}
              className={`min-h-12 rounded-xl border text-sm font-semibold transition-colors ${
                slot === s.slot ? "border-primary bg-primary text-primary-foreground" : "bg-card"
              }`}
            >
              {formatTimeIST(s.slot)}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" className="mt-1.5 h-12 rounded-xl bg-card text-base" />
        </div>
        <div>
          <Label htmlFor="notes">Notes for the barista (optional)</Label>
          <Textarea id="notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Extra hot, no lid…" className="mt-1.5 rounded-xl bg-card text-base" />
        </div>
        <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" aria-hidden name="website" />
      </section>

      <div className="mt-6 flex gap-3 rounded-2xl border border-accent/50 bg-secondary p-4 text-sm">
        <Wallet className="size-5 shrink-0 text-primary" />
        <p><strong>Pay at pickup.</strong> No online payment — pay the café directly (cash or UPI) when you collect your order.</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Estimated total (confirmed by café)</span>
          <span className="font-semibold">{formatINR(cart.subtotal)}</span>
        </div>
        <Button size="lg" disabled={busy} onClick={onSubmit} className="h-14 w-full rounded-2xl text-base">
          {busy ? "Placing order…" : "Place order · Pay at pickup"}
        </Button>
      </div>
    </div>
  );
}
