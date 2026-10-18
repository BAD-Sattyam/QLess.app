import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUpRight, Check, Clock, Coffee, Cookie, Grid2X2, MapPin, Search, ShieldCheck, SlidersHorizontal, UserRound, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import homeCoffee from "@/assets/qless-home-coffee.jpg";
import cafePhoto from "@/assets/hero-coffee.jpg";
import { formatClock } from "@/lib/pricing";
import { resolveLogoUrl } from "@/lib/logo";
import { useDisplayName } from "@/hooks/use-display-name";
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
    <div className="qless-home min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5">
        <Link to="/" aria-label="Qless home" className="flex items-center gap-1 text-[32px] font-extrabold leading-none">
          Qless<span className="text-primary">.</span>
        </Link>
        <div className="hidden items-center gap-2 text-sm font-semibold sm:flex"><MapPin className="size-4 text-primary" /> Gurugram</div>
        <nav aria-label="Account" className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="h-10 rounded-full px-3 text-muted-foreground">
            <Link to="/staff/login"><ShieldCheck />Partner  Login</Link>
          </Button>
          <Button asChild size="sm" className="h-10 rounded-full px-4 font-bold">
            <Link to={sessionQ.data ? "/orders" : "/auth"}><UserRound />{sessionQ.data ? "My orders" : "Sign in"}</Link>
          </Button>
        </nav>
      </header>

      <section className="home-hero relative isolate overflow-hidden bg-home-hero">
        <img src={homeCoffee} alt="Cappuccino and chocolate cookies — demonstration image" width={1536} height={1024} fetchPriority="high" className="home-hero-photo absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="relative mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-12">
          <div className="mb-5 flex items-center gap-1.5 text-xs font-bold sm:mb-7 sm:text-sm"><MapPin className="size-3.5 sm:hidden" /><span className="sm:hidden">Gurugram</span><span className="mx-1 sm:hidden">/</span><Zap className="size-3.5" /> GOOD FOOD. NO WAIT.</div>
          <h1 className="max-w-[250px] text-[40px] font-extrabold leading-[1.05] sm:max-w-md sm:text-6xl">Skip the<br />queue<span className="text-home-highlight">.</span></h1>
          <p className="mt-3 max-w-[210px] text-lg font-bold leading-tight sm:mt-5 sm:max-w-sm sm:text-2xl">Pick up on your time.</p>
          <p className="mt-2 max-w-[205px] text-xs font-medium leading-relaxed sm:max-w-[320px] sm:text-sm">Your café favourites, ordered ahead.<br />Less waiting. More living.</p>
          <div className="mt-6 flex items-center gap-2 text-xs font-bold sm:mt-8"><span className="flex size-7 items-center justify-center rounded-full bg-home-highlight"><ArrowDown className="size-4" /></span>Find your next favourite</div>
        </div>
        <span className="absolute bottom-2 right-3 text-[9px] font-medium text-home-photo-label">Demonstration image</span>
      </section>

      <main className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
      <div className="home-search relative z-10 -mt-1.5 rounded-2xl bg-card p-1.5 shadow-home-search sm:-mt-6">
        <span className="pointer-events-none absolute left-3.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl bg-primary/10 text-primary"><Search className="size-5" /></span>
        <Input
          aria-label="Search restaurants or dishes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search restaurants or dishes…"
          className="h-14 rounded-xl border-transparent bg-card pl-14 pr-12 text-sm font-medium shadow-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {search && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 size-8 -translate-y-1/2 rounded-full"><X /></Button>}
      </div>

      {categories.length > 0 && (
        <div aria-label="Food categories" className="mt-5 flex gap-2.5 overflow-x-auto pb-2 sm:mt-6">
          <Button
            variant={category === null ? "default" : "outline"}
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
            className="home-category h-11 shrink-0 rounded-full px-5 font-bold"
          >
            <Grid2X2 />All
          </Button>
          {categories.map((cat) => {
            const Icon = cat.toLowerCase() === "coffee" ? Coffee : cat.toLowerCase() === "cookies" ? Cookie : SlidersHorizontal;
            return <Button
              key={cat}
              variant={category === cat ? "default" : "outline"}
              aria-pressed={category === cat}
              onClick={() => setCategory(category === cat ? null : cat)}
              className="home-category h-11 shrink-0 rounded-full px-5 font-bold"
            >
              <Icon />{cat}
            </Button>;
          })}
        </div>
      )}

      <section aria-labelledby="restaurants-heading" className="mt-6 sm:mt-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">YOUR NEXT STOP</p><h2 id="restaurants-heading" className="text-2xl font-extrabold">Good things nearby</h2></div>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">{cafesQ.data ? `${results.length} ${results.length === 1 ? "spot" : "spots"}` : ""}</span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cafesQ.isLoading && (<><Skeleton className="h-80 w-full rounded-lg" /><Skeleton className="h-80 w-full rounded-lg" /></>)}
        {cafesQ.isError && <p role="alert" className="col-span-full py-10 text-center text-sm text-muted-foreground">Couldn't load restaurants. Check your connection and refresh.</p>}
        {cafesQ.data && results.length === 0 && (
          <p role="status" className="col-span-full py-10 text-center text-sm text-muted-foreground">
            <SlidersHorizontal className="mx-auto mb-2 size-5" /> No restaurants match your search.
          </p>
        )}
        {results.map((c) => <RestaurantCard key={c.id} cafe={c} />)}
        </div>
      </section>
      <footer className="mt-9 flex items-center justify-between gap-4 border-t py-5 text-[11px] text-muted-foreground"><span className="font-bold">A little less queue. A lot more you.</span><span className="font-extrabold text-foreground">Qless.</span></footer>
      </main>
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
    <Link to="/restaurant/$slug" params={{ slug: cafe.slug }} className="home-restaurant group block overflow-hidden rounded-lg border border-border bg-card shadow-home-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="relative h-40 overflow-hidden bg-muted sm:h-44">
        <img src={cafe.cover_url || cafePhoto} alt={cafe.cover_url ? `${cafe.name} café` : "Coffee — demonstration image"} width={1280} height={768} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[10px] font-extrabold text-foreground">{cafe.demo_mode ? <><span className="size-1.5 rounded-full bg-primary" />PRIVATE DEMO</> : <><Coffee className="size-3" />ORDER AHEAD</>}</div>
        {!cafe.cover_url && <span className="absolute bottom-2 right-3 rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">Demonstration image</span>}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-home-highlight px-3 py-1.5 text-xs font-bold text-foreground"><Zap className="size-3.5" />~{cafe.lead_time_minutes} min pickup</div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
        {logoQ.data ? (
          <img src={logoQ.data} alt={`${cafe.name} logo`} width={56} height={56} className="size-14 shrink-0 rounded-lg border bg-card object-contain p-1" />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-2xl font-bold text-primary">
            {cafe.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold leading-snug">{cafe.name}</h3>
          {cafe.cuisine && <p className="mt-1 text-xs font-medium text-muted-foreground">{cafe.cuisine}</p>}
        </div>
        <ArrowUpRight className="ml-auto size-5 shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
          <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{cafe.address}</p>
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
            <Clock className="size-3.5 shrink-0 text-muted-foreground" />
            {open ? (
              <><span className="text-success">Open now</span><span className="text-muted-foreground">· {formatClock(cafe.open_time)}–{formatClock(cafe.close_time)}</span></>
            ) : (
              <span className="text-muted-foreground">Closed · opens {formatClock(cafe.open_time)}</span>
            )}
            {cafe.demo_mode && <span className="text-muted-foreground">· Hours provisional</span>}
          </p>
      </div>
      <div className={`flex items-center gap-2 border-t px-4 py-3 text-[11px] font-semibold sm:px-5 ${accepting ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}>
        {accepting ? <Check className="size-3.5 shrink-0" /> : <ShieldCheck className="size-3.5 shrink-0" />}
        {accepting ? "Prepay & pick up — order ahead" : cafe.demo_mode ? "Explore the menu · Real orders disabled" : "Not accepting orders right now"}
      </div>
      {cafe.demo_mode && <p className="px-4 py-2 text-[9px] leading-relaxed text-muted-foreground sm:px-5">Pilot pending café approval. No official partnership.</p>}
    </Link>
  );
}
