import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatClock } from "@/lib/pricing";
import { resolveLogoUrl } from "@/lib/logo";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qless — Pre-order and skip the queue" },
      { name: "description", content: "Discover restaurants near you, order ahead, prepay and pick up without waiting." },
      { property: "og:title", content: "Qless — Pre-order and skip the queue" },
      { property: "og:description", content: "Discover restaurants, order ahead, prepay and pick up without waiting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

type Cafe = Tables<"cafes">;

function isOpenNow(c: Cafe): boolean {
  const now = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).slice(0, 5);
  return c.open_time.slice(0, 5) <= now && now <= c.close_time.slice(0, 5);
}

function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const cafesQ = useQuery({
    queryKey: ["discover-cafes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cafes").select("*").eq("is_active", true).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const menuQ = useQuery({
    queryKey: ["discover-menu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("cafe_id, name, category").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
  const sessionQ = useQuery({
    queryKey: ["session-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });

  const categories = useMemo(() => [...new Set(menuQ.data?.map((m) => m.category) ?? [])].sort(), [menuQ.data]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (cafesQ.data ?? []).filter((c) => {
      if (category && !menuQ.data?.some((m) => m.cafe_id === c.id && m.category === category)) return false;
      if (!q) return true;
      if (c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q) || (c.cuisine ?? "").toLowerCase().includes(q)) return true;
      return menuQ.data?.some((m) => m.cafe_id === c.id && m.name.toLowerCase().includes(q)) ?? false;
    });
  }, [cafesQ.data, menuQ.data, search, category]);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16 pt-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-display text-2xl font-semibold text-primary">Qless</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" /> Gurugram</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={sessionQ.data ? "/orders" : "/auth"}
            className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-primary shadow-sm"
          >
            {sessionQ.data ? "My orders" : "Sign in"}
          </Link>
          <Link to="/auth" className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            Staff
          </Link>
        </div>
      </header>

      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight">Skip the queue.<br />Pick up on your time.</h1>

      <div className="relative mt-5">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search restaurants or dishes…"
          className="h-12 rounded-full bg-card pl-11 text-base shadow-sm"
        />
      </div>

      {categories.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory(null)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${category === null ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? null : cat)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${category === cat ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <section className="mt-6 space-y-4">
        {cafesQ.isLoading && (<><Skeleton className="h-40 w-full rounded-3xl" /><Skeleton className="h-40 w-full rounded-3xl" /></>)}
        {cafesQ.isError && <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">Couldn't load restaurants. Check your connection and refresh.</p>}
        {cafesQ.data && results.length === 0 && (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
            <SlidersHorizontal className="mx-auto mb-2 size-5" /> No restaurants match your search.
          </p>
        )}
        {results.map((c) => <RestaurantCard key={c.id} cafe={c} />)}
      </section>
    </div>
  );
}

function RestaurantCard({ cafe }: { cafe: Cafe }) {
  const logoQ = useQuery({
    enabled: !!cafe.logo_url,
    queryKey: ["cafe-logo", cafe.logo_url],
    queryFn: () => resolveLogoUrl(cafe.logo_url),
    staleTime: 60 * 60 * 1000,
  });
  const open = isOpenNow(cafe);
  const accepting = cafe.accepting_orders && !cafe.demo_mode;

  return (
    <Link to="/restaurant/$slug" params={{ slug: cafe.slug }} className="block overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="flex items-center gap-4 p-4">
        {logoQ.data ? (
          <img src={logoQ.data} alt={`${cafe.name} logo`} className="h-16 w-16 shrink-0 rounded-2xl border bg-background object-contain p-1.5" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary font-display text-2xl font-semibold text-primary">
            {cafe.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{cafe.name}</p>
            {cafe.demo_mode && <span className="shrink-0 rounded-full bg-warning/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">Demo</span>}
          </div>
          {cafe.cuisine && <p className="truncate text-sm text-muted-foreground">{cafe.cuisine}</p>}
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{cafe.address}</p>
          <p className="mt-1 flex items-center gap-1 text-xs">
            <Clock className="size-3 shrink-0" />
            {open ? (
              <span className="font-medium text-primary">Open · {formatClock(cafe.open_time)}–{formatClock(cafe.close_time)}</span>
            ) : (
              <span className="text-muted-foreground">Closed · opens {formatClock(cafe.open_time)}</span>
            )}
            <span className="text-muted-foreground">· ~{cafe.lead_time_minutes} min pickup</span>
          </p>
        </div>
      </div>
      <div className={`px-4 py-2 text-center text-xs font-semibold ${accepting ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        {accepting ? "Prepay & pick up — order ahead" : cafe.demo_mode ? "Demonstration outlet — not taking real orders" : "Not accepting orders right now"}
      </div>
    </Link>
  );
}
