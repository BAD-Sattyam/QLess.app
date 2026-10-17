import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Minus, Plus, ShoppingBag, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart";
import { estimateUnitPrice, formatClock, formatINR, parseGroups } from "@/lib/pricing";
import { resolveLogoUrl } from "@/lib/logo";
import type { Tables } from "@/integrations/supabase/types";
import hero from "@/assets/hero-coffee.jpg";

type MenuItem = Tables<"menu_items">;

export function CafeView({ slug }: { slug?: string }) {
  const cafeQ = useQuery({
    queryKey: ["cafe", slug ?? "__first"],
    queryFn: async () => {
      let q = supabase.from("cafes").select("*").eq("is_active", true);
      q = slug ? q.eq("slug", slug) : q.order("created_at");
      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const cafe = cafeQ.data;
  const menuQ = useQuery({
    enabled: !!cafe,
    queryKey: ["menu", cafe?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafe!.id)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const cart = useCart();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const sessionQ = useQuery({
    queryKey: ["session-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const m of menuQ.data ?? []) map.set(m.category, [...(map.get(m.category) ?? []), m]);
    return [...map.entries()];
  }, [menuQ.data]);

  if (cafeQ.isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (cafeQ.isError) return <Empty title="Couldn't load the café" body="Check your connection and refresh." />;
  if (!cafe) return <Empty title="No café yet" body="This café isn't available right now." />;

  const cartCount = cart.cafeId === cafe.id ? cart.count : 0;

  return (
    <div className="mx-auto min-h-screen max-w-xl pb-32">
      <header className="relative">
        <img src={hero} alt="" width={1280} height={768} className="h-56 w-full object-cover sm:rounded-b-3xl" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-card/90 px-3 py-1 text-sm font-semibold text-primary backdrop-blur">
            Qless
          </span>
          <div className="flex gap-2">
            <Link
              to={sessionQ.data ? "/orders" : "/auth"}
              className="rounded-full bg-card/90 px-3 py-1 text-xs font-medium text-primary backdrop-blur"
            >
              {sessionQ.data ? "My orders" : "Sign in"}
            </Link>
            <Link to="/auth" className="rounded-full bg-card/90 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              Staff
            </Link>
          </div>
        </div>
      </header>

      <section className="relative -mt-10 mx-4 rounded-3xl bg-card p-5 shadow-soft">
        <h1 className="text-3xl font-semibold text-foreground">{cafe.name}</h1>
        {cafe.demo_mode && (
          <p className="mt-2 rounded-xl border border-accent/50 bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground">
            Demonstration outlet on Qless — menu, prices and hours are provisional and pending the café's confirmation. Ordering is disabled in demo mode.
          </p>
        )}
        {cafe.tagline && <p className="mt-1 text-muted-foreground">{cafe.tagline}</p>}
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-accent" />{cafe.address}</p>
          <p className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-accent" />
            Open {formatClock(cafe.open_time)} – {formatClock(cafe.close_time)} · Ready in ~{cafe.lead_time_minutes} min
          </p>
          <p className="flex gap-2"><Wallet className="mt-0.5 size-4 shrink-0 text-accent" />Pay at pickup — cash or UPI at the counter</p>
        </div>
        {!cafe.accepting_orders && (
          <div className="mt-4 rounded-xl bg-warning/30 p-3 text-sm font-medium text-warning-foreground">
            Pre-orders are paused right now. Please check back shortly.
          </div>
        )}
      </section>

      <main className="mt-6 space-y-8 px-4">
        {menuQ.isLoading && <Skeleton className="h-40 w-full" />}
        {menuQ.data?.length === 0 && <Empty title="Menu coming soon" body="No items have been added yet." />}
        {grouped.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-3 text-xl font-semibold">{cat}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    disabled={!m.is_available || !cafe.accepting_orders}
                    onClick={() => setSelected(m)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-muted disabled:opacity-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{m.name}</p>
                      {m.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
                      <p className="mt-1 font-semibold text-primary">
                        {formatINR(m.price_paise)}
                        {!m.is_available && <span className="ml-2 text-xs font-medium text-destructive">Out of stock</span>}
                      </p>
                    </div>
                    {m.is_available && cafe.accepting_orders && (
                      <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
                        <Plus className="size-5" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            to="/checkout"
            className="flex h-16 items-center justify-between rounded-2xl bg-espresso px-5 text-primary-foreground shadow-bar"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="size-5" /> {cartCount} item{cartCount > 1 ? "s" : ""}
            </span>
            <span className="font-semibold">View cart · {formatINR(cart.subtotal)}</span>
          </Link>
        </div>
      )}

      <ItemDrawer
        item={selected}
        onClose={() => setSelected(null)}
        onAdd={(line) => {
          if (cart.cafeId && cart.cafeId !== cafe.id && cart.count > 0) toast.message("Started a new cart for this café");
          cart.add(cafe.id, line);
          toast.success(`${line.name} added`);
          setSelected(null);
        }}
      />
    </div>
  );
}

function ItemDrawer({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (l: { menu_item_id: string; name: string; unit_price_paise: number; options: Record<string, string>; quantity: number }) => void;
}) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const groups = parseGroups(item?.customizations);
  const unit = item ? estimateUnitPrice(item.price_paise, groups, chosen) : 0;

  return (
    <Drawer
      open={!!item}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setChosen({});
          setQty(1);
        }
      }}
    >
      <DrawerContent className="mx-auto max-w-xl">
        {item && (
          <div className="max-h-[80vh] overflow-y-auto px-5 pb-6">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="font-display text-2xl">{item.name}</DrawerTitle>
              {item.description && <DrawerDescription>{item.description}</DrawerDescription>}
            </DrawerHeader>
            {groups.map((g) => {
              const current = chosen[g.name] ?? g.options[0]?.label;
              return (
                <div key={g.name} className="mb-5">
                  <p className="mb-2 text-sm font-semibold text-muted-foreground">{g.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((o) => (
                      <button
                        key={o.label}
                        onClick={() => setChosen((c) => ({ ...c, [g.name]: o.label }))}
                        className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                          current === o.label ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                        }`}
                      >
                        {o.label}
                        {o.price_paise > 0 && <span className="ml-1 opacity-75">+{formatINR(o.price_paise)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="mt-2 flex items-center gap-4">
              <div className="flex items-center rounded-full border bg-card">
                <button aria-label="Decrease" className="flex size-12 items-center justify-center" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus className="size-4" />
                </button>
                <span className="w-6 text-center font-semibold">{qty}</span>
                <button aria-label="Increase" className="flex size-12 items-center justify-center" onClick={() => setQty((q) => Math.min(10, q + 1))}>
                  <Plus className="size-4" />
                </button>
              </div>
              <Button
                size="lg"
                className="h-12 flex-1 rounded-full text-base"
                onClick={() => {
                  const options: Record<string, string> = {};
                  for (const g of groups) options[g.name] = chosen[g.name] ?? g.options[0]?.label ?? "";
                  onAdd({ menu_item_id: item.id, name: item.name, unit_price_paise: unit, options, quantity: qty });
                  setChosen({});
                  setQty(1);
                }}
              >
                Add · {formatINR(unit * qty)}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-20 text-center">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}
