import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CreditCard, Minus, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart";
import { formatINR, formatTimeIST } from "@/lib/pricing";
import { createPaymentOrder, getPaymentStatus, verifyCheckoutPayment, cancelCheckoutPayment } from "@/lib/payments.functions";
import { Empty } from "@/components/CafeView";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Qless" },
      { name: "description", content: "Choose a pickup time and prepay for your order." },
      { property: "og:title", content: "Checkout — Qless" },
      { property: "og:description", content: "Choose a pickup time and prepay for your order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (event: string, handler: () => void) => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type PayState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "waiting"; attemptId: string; cancelled?: boolean }
  | { phase: "paid"; amount: number; trackingToken: string | null }
  | { phase: "failed"; reason: string };

function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const startPayment = useServerFn(createPaymentOrder);
  const pollStatus = useServerFn(getPaymentStatus);
  const verifyPayment = useServerFn(verifyCheckoutPayment);
  const cancelPayment = useServerFn(cancelCheckoutPayment);
  const polling = useRef(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState("");
  const [slot, setSlot] = useState<string | null>(null);
  const [pay, setPay] = useState<PayState>({ phase: "idle" });
  const sessionQ = useQuery({
    queryKey: ["session-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });

  const cafeQ = useQuery({
    enabled: !!cart.cafeId,
    queryKey: ["cafe-by-id", cart.cafeId],
    queryFn: async () => {
      if (!cart.cafeId) return null;
      return (await supabase.from("cafes").select("*").eq("id", cart.cafeId).single()).data;
    },
  });
  const slotsQ = useQuery({
    enabled: !!cart.cafeId,
    queryKey: ["slots", cart.cafeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!cart.cafeId) return [];
      const { data, error } = await supabase.rpc("get_available_slots", { p_cafe_id: cart.cafeId });
      if (error) throw error;
      return data;
    },
  });

  const waitForPayment = async (attemptId: string) => {
    if (polling.current) return;
    polling.current = true;
    try {
      for (let i = 0; i < 20; i++) {
        const res = await pollStatus({ data: { attemptId } });
        if (res.status === "paid") {
          sessionStorage.removeItem("qless-pending-payment");
          setPay({ phase: "paid", amount: res.amount, trackingToken: res.trackingToken });
          qc.invalidateQueries({ queryKey: ["slots"] });
          return;
        }
        if (res.status === "failed" || res.status === "expired") {
          sessionStorage.removeItem("qless-pending-payment");
          setPay({ phase: "failed", reason: res.status === "expired" ? "The test payment expired. Your pickup reservation was released." : "The test payment failed. No restaurant order was created." });
          qc.invalidateQueries({ queryKey: ["slots"] });
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch { toast.error("Couldn't check payment yet. Please check again."); }
    finally { polling.current = false; }
  };

  useEffect(() => {
    if (!sessionQ.data) return;
    const attemptId = sessionStorage.getItem("qless-pending-payment");
    if (attemptId) {
      setPay({ phase: "waiting", attemptId });
      void waitForPayment(attemptId);
    }
  }, [sessionQ.data?.id]);

  if (cart.lines.length === 0 && pay.phase !== "paid" && pay.phase !== "waiting") {
    return (
      <div className="mx-auto max-w-xl">
        <Empty title="Your cart is empty" body="Add a coffee or a snack to get started." />
        <div className="text-center"><Button asChild size="lg" className="rounded-full"><Link to="/">Browse restaurants</Link></Button></div>
      </div>
    );
  }

  if (sessionQ.data === null) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-16 text-center">
        <h1 className="text-3xl font-semibold">Sign in to place your order</h1>
        <p className="mt-2 text-muted-foreground">
          Your cart is saved. Sign in or create a free account to pay and track your order live.
        </p>
        <Button asChild size="lg" className="mt-6 h-12 rounded-full px-8 text-base">
          <Link to="/auth" search={{ redirect: "/checkout" }}>Sign in or create account</Link>
        </Button>
      </div>
    );
  }

  const onPay = async () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (!slot) { toast.error("Please choose a pickup time"); return; }
    if (!cart.cafeId) return;
    setPay({ phase: "starting" });
    try {
      const res = await startPayment({
        data: {
          cafeId: cart.cafeId,
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
        setPay({ phase: "idle" });
        return;
      }
      sessionStorage.setItem("qless-pending-payment", res.attemptId);
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setPay({ phase: "waiting", attemptId: res.attemptId, cancelled: true });
        void waitForPayment(res.attemptId);
        return;
      }
      setPay({ phase: "waiting", attemptId: res.attemptId });
      const rzp = new window.Razorpay({
        key: res.keyId,
        amount: res.amount,
        currency: "INR",
        name: "Qless",
        description: `TEST ONLY — ${cafeQ.data?.name ?? "Qless"}`,
        order_id: res.razorpayOrderId,
        prefill: { name: name.trim() },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verifyPayment({ data: { attemptId: res.attemptId, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature } });
          } catch { toast.error("Payment verification is pending. Checking securely…"); }
          void waitForPayment(res.attemptId);
        },
        modal: { ondismiss: () => {
          setPay({ phase: "waiting", attemptId: res.attemptId, cancelled: true });
          void cancelPayment({ data: { attemptId: res.attemptId } }).catch(() => {});
          void waitForPayment(res.attemptId);
        } },
      });
      rzp.on("payment.failed", () => {
        setPay({ phase: "waiting", attemptId: res.attemptId });
        void waitForPayment(res.attemptId);
      });
      rzp.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safeMessages = ["Test payments are not configured yet.", "Live payments are disabled. Configure Razorpay test credentials."];
      toast.error(safeMessages.includes(message) ? message : "Something went wrong. Please try again.");
      setPay({ phase: "idle" });
    }
  };

  const slots = (slotsQ.data ?? []).filter((s) => s.remaining > 0);
  const busy = pay.phase === "starting" || pay.phase === "waiting" || pay.phase === "paid" || !sessionQ.data;

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-36 pt-4">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to restaurants
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
            No pickup slots left today. The restaurant may be closed or fully booked.
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
          <Label htmlFor="notes">Notes for the kitchen (optional)</Label>
          <Textarea id="notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Extra hot, no lid…" className="mt-1.5 rounded-xl bg-card text-base" />
        </div>
        <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" aria-hidden name="website" />
      </section>

      <div className="mt-6 flex gap-3 rounded-2xl border border-accent/50 bg-secondary p-4 text-sm">
        <ShieldCheck className="size-5 shrink-0 text-primary" />
         <p><strong>Razorpay test checkout only.</strong> No real money, collection or settlement. Dohful remains a provisional demonstration outlet; verified captured test payments create labelled academic demo orders only. No real kitchen fulfillment or official partnership.</p>
      </div>

      {pay.phase === "waiting" && (
        <div className="mt-4 rounded-2xl border border-warning/60 bg-warning/20 p-4 text-sm">
          <p className="font-semibold">{pay.cancelled ? "Checkout closed — confirmation pending" : "Confirming test payment"}</p>
          <p className="mt-1 text-muted-foreground">
            We are checking captured payment status with Razorpay. Closing checkout does not confirm failure. Unpaid reservations expire after 15 minutes.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void waitForPayment(pay.attemptId)}>Check payment</Button>
          </div>
        </div>
      )}
      {pay.phase === "paid" && (
        <div className="mt-4 rounded-2xl border bg-card p-4 text-sm">
          <p className="font-semibold">Test payment captured and verified · {formatINR(pay.amount)}</p>
          <p className="mt-1 text-muted-foreground">
            Razorpay confirmed this test payment. No real money was charged. Dohful stays in demo mode; any order shown is for academic demonstration only.
          </p>
          {pay.trackingToken && <Button asChild size="sm" className="mt-3" onClick={() => cart.clear()}><Link to="/order/$token" params={{ token: pay.trackingToken }} search={{ new: 1 }}>Track demo order</Link></Button>}
          <Button size="sm" variant="outline" className="mt-3" onClick={() => { cart.clear(); navigate({ to: "/" }); }}>Back to restaurants</Button>
        </div>
      )}
      {pay.phase === "failed" && (
        <div className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Test payment not completed</p>
          <p className="mt-1 text-muted-foreground">
            {pay.reason}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => { setSlot(null); setPay({ phase: "idle" }); }}>Try again</Button>
        </div>
      )}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Total to pay now</span>
          <span className="font-semibold">{formatINR(cart.subtotal)}</span>
        </div>
        <Button size="lg" disabled={busy} onClick={onPay} className="h-14 w-full rounded-2xl text-base">
          <CreditCard className="size-5" />
           {pay.phase === "starting" ? "Starting test payment…" : pay.phase === "waiting" ? "Waiting for confirmation…" : pay.phase === "paid" ? "Test payment verified" : `Test pay ${formatINR(cart.subtotal)}`}
        </Button>
      </div>
    </div>
  );
}
