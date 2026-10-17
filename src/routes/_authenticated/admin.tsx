import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, useStaff } from "@/components/StaffShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/pricing";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — CoffeeSkip" },
      { name: "description", content: "Manage cafés, menus and merchant access." },
      { property: "og:title", content: "Admin — CoffeeSkip" },
      { property: "og:description", content: "Manage cafés, menus and merchant access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const me = useStaff();
  const cafesQ = useQuery({
    queryKey: ["admin-cafes"],
    queryFn: async () => (await supabase.from("cafes").select("*").order("created_at")).data ?? [],
  });
  if (me.isLoading) return <StaffShell active="admin"><Skeleton className="h-40" /></StaffShell>;
  if (!me.data?.isAdmin)
    return <StaffShell active="admin"><p className="py-16 text-center text-muted-foreground">Admins only.</p></StaffShell>;
  return (
    <StaffShell active="admin">
      <Tabs defaultValue="cafes">
        <TabsList className="h-12 w-full">
          <TabsTrigger value="cafes" className="h-10 flex-1">Cafés</TabsTrigger>
          <TabsTrigger value="menu" className="h-10 flex-1">Menu</TabsTrigger>
          <TabsTrigger value="merchants" className="h-10 flex-1">Merchants</TabsTrigger>
        </TabsList>
        <TabsContent value="cafes"><CafesTab cafes={cafesQ.data ?? []} /></TabsContent>
        <TabsContent value="menu"><MenuTab cafes={cafesQ.data ?? []} /></TabsContent>
        <TabsContent value="merchants"><MerchantsTab cafes={cafesQ.data ?? []} /></TabsContent>
      </Tabs>
    </StaffShell>
  );
}

type Cafe = Tables<"cafes">;
const emptyCafe = { slug: "", name: "", tagline: "", address: "", open_time: "08:00", close_time: "20:00", lead_time_minutes: 10, avg_prep_minutes: 8, max_orders_per_slot: 6, accepting_orders: true, is_active: true };

function CafesTab({ cafes }: { cafes: Cafe[] }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<(Partial<Cafe> & typeof emptyCafe) | null>(null);
  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.address.trim() || !/^[a-z0-9-]+$/.test(edit.slug)) return toast.error("Name, address and a lowercase slug (a-z, 0-9, -) are required");
    const payload = {
      slug: edit.slug, name: edit.name.trim(), tagline: edit.tagline || null, address: edit.address.trim(),
      open_time: edit.open_time, close_time: edit.close_time,
      lead_time_minutes: Number(edit.lead_time_minutes), avg_prep_minutes: Number(edit.avg_prep_minutes),
      max_orders_per_slot: Number(edit.max_orders_per_slot), accepting_orders: edit.accepting_orders, is_active: edit.is_active,
    };
    const { error } = edit.id ? await supabase.from("cafes").update(payload).eq("id", edit.id) : await supabase.from("cafes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Café saved");
    setEdit(null);
    qc.invalidateQueries();
  };
  return (
    <div className="space-y-3">
      <Button size="lg" className="rounded-full" onClick={() => setEdit({ ...emptyCafe })}>Add café</Button>
      {cafes.map((c) => (
        <button key={c.id} onClick={() => setEdit({ ...c, tagline: c.tagline ?? "", open_time: c.open_time.slice(0, 5), close_time: c.close_time.slice(0, 5) })} className="block w-full rounded-2xl border bg-card p-4 text-left">
          <p className="font-semibold">{c.name} {!c.is_active && <span className="text-xs text-destructive">(hidden)</span>}</p>
          <p className="text-sm text-muted-foreground">{c.open_time.slice(0, 5)}–{c.close_time.slice(0, 5)} · lead {c.lead_time_minutes} min · {c.max_orders_per_slot}/slot</p>
        </button>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit café" : "New café"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <F label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></F>
              <F label="URL slug"><Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase() })} /></F>
              <F label="Tagline"><Input value={edit.tagline ?? ""} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} /></F>
              <F label="Address"><Textarea value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Opens (IST)"><Input type="time" value={edit.open_time} onChange={(e) => setEdit({ ...edit, open_time: e.target.value })} /></F>
                <F label="Closes (IST)"><Input type="time" value={edit.close_time} onChange={(e) => setEdit({ ...edit, close_time: e.target.value })} /></F>
                <F label="Lead time (min)"><Input type="number" min={0} value={edit.lead_time_minutes} onChange={(e) => setEdit({ ...edit, lead_time_minutes: Number(e.target.value) })} /></F>
                <F label="Avg prep (min)"><Input type="number" min={1} value={edit.avg_prep_minutes} onChange={(e) => setEdit({ ...edit, avg_prep_minutes: Number(e.target.value) })} /></F>
                <F label="Max orders / 5-min slot"><Input type="number" min={1} value={edit.max_orders_per_slot} onChange={(e) => setEdit({ ...edit, max_orders_per_slot: Number(e.target.value) })} /></F>
              </div>
              <label className="flex items-center justify-between">Accepting orders <Switch checked={edit.accepting_orders} onCheckedChange={(v) => setEdit({ ...edit, accepting_orders: v })} /></label>
              <label className="flex items-center justify-between">Visible to customers <Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /></label>
            </div>
          )}
          <DialogFooter><Button size="lg" onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Item = Tables<"menu_items">;
type ItemDraft = { id?: string; name: string; description: string; category: string; price: string; customizations: string; is_available: boolean; is_active: boolean; sort_order: number };

function MenuTab({ cafes }: { cafes: Cafe[] }) {
  const qc = useQueryClient();
  const [cafeId, setCafeId] = useState<string>("");
  useEffect(() => { if (!cafeId && cafes[0]) setCafeId(cafes[0].id); }, [cafes, cafeId]);
  const itemsQ = useQuery({
    enabled: !!cafeId,
    queryKey: ["admin-menu", cafeId],
    queryFn: async () => (await supabase.from("menu_items").select("*").eq("cafe_id", cafeId).order("sort_order")).data ?? [],
  });
  const [edit, setEdit] = useState<ItemDraft | null>(null);
  const open = (m?: Item) =>
    setEdit(m ? { id: m.id, name: m.name, description: m.description ?? "", category: m.category, price: String(m.price_paise / 100), customizations: JSON.stringify(m.customizations, null, 2), is_available: m.is_available, is_active: m.is_active, sort_order: m.sort_order }
      : { name: "", description: "", category: "Coffee", price: "", customizations: "[]", is_available: true, is_active: true, sort_order: (itemsQ.data?.length ?? 0) + 1 });

  const save = async () => {
    if (!edit) return;
    const rupees = Number(edit.price);
    if (!edit.name.trim() || !Number.isFinite(rupees) || rupees < 0) return toast.error("Name and a valid price are required");
    let cust: unknown;
    try {
      cust = JSON.parse(edit.customizations || "[]");
      if (!Array.isArray(cust)) throw new Error();
    } catch { return toast.error("Customizations must be a JSON list"); }
    const payload = { cafe_id: cafeId, name: edit.name.trim(), description: edit.description || null, category: edit.category.trim() || "Other", price_paise: Math.round(rupees * 100), customizations: cust as never, is_available: edit.is_available, is_active: edit.is_active, sort_order: Number(edit.sort_order) };
    const { error } = edit.id ? await supabase.from("menu_items").update(payload).eq("id", edit.id) : await supabase.from("menu_items").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Item saved");
    setEdit(null);
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={cafeId} onChange={(e) => setCafeId(e.target.value)} className="h-11 flex-1 rounded-xl border bg-card px-3">
          {cafes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button size="lg" className="rounded-full" onClick={() => open()} disabled={!cafeId}>Add item</Button>
      </div>
      {itemsQ.isLoading && <Skeleton className="h-32" />}
      {itemsQ.data?.length === 0 && <p className="py-8 text-center text-muted-foreground">No menu items yet.</p>}
      <ul className="divide-y rounded-2xl border bg-card">
        {itemsQ.data?.map((m) => (
          <li key={m.id}>
            <button onClick={() => open(m)} className="flex min-h-14 w-full items-center justify-between px-4 py-2 text-left">
              <span><span className="font-medium">{m.name}</span> <span className="text-xs text-muted-foreground">{m.category}{!m.is_active && " · hidden"}{!m.is_available && " · out of stock"}</span></span>
              <span className="font-semibold">{formatINR(m.price_paise)}</span>
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <F label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></F>
              <F label="Description"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></F>
              <div className="grid grid-cols-3 gap-3">
                <F label="Price (₹)"><Input inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></F>
                <F label="Category"><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></F>
                <F label="Order"><Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></F>
              </div>
              <F label='Customizations (JSON, surcharges in paise) e.g. [{"name":"Size","options":[{"label":"Regular","price_paise":0}]}]'>
                <Textarea className="min-h-32 font-mono text-xs" value={edit.customizations} onChange={(e) => setEdit({ ...edit, customizations: e.target.value })} />
              </F>
              <label className="flex items-center justify-between">In stock <Switch checked={edit.is_available} onCheckedChange={(v) => setEdit({ ...edit, is_available: v })} /></label>
              <label className="flex items-center justify-between">Show on menu <Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /></label>
            </div>
          )}
          <DialogFooter className="gap-2">
            {edit?.id && (
              <Button variant="outline" onClick={async () => {
                const { error } = await supabase.from("menu_items").delete().eq("id", edit.id!);
                if (error) return toast.error(error.message);
                setEdit(null); qc.invalidateQueries();
              }}>Delete</Button>
            )}
            <Button size="lg" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MerchantsTab({ cafes }: { cafes: Cafe[] }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [cafeId, setCafeId] = useState("");
  useEffect(() => { if (!cafeId && cafes[0]) setCafeId(cafes[0].id); }, [cafes, cafeId]);
  const listQ = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_merchants");
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <p className="font-semibold">Grant café access</p>
        <p className="mt-1 text-sm text-muted-foreground">First create the staff account in Lovable Cloud → Users → Add user, then enter their email here.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Input type="email" placeholder="staff@cafe.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          <select value={cafeId} onChange={(e) => setCafeId(e.target.value)} className="h-11 rounded-md border bg-card px-3">
            {cafes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button size="lg" onClick={async () => {
            if (!email.includes("@")) return toast.error("Enter a valid email");
            const { error } = await supabase.rpc("admin_add_merchant", { p_email: email, p_cafe_id: cafeId });
            if (error) return toast.error(error.message);
            toast.success("Access granted"); setEmail(""); qc.invalidateQueries({ queryKey: ["admin-merchants"] });
          }}>Grant</Button>
        </div>
      </div>
      {listQ.isLoading && <Skeleton className="h-20" />}
      {listQ.data?.length === 0 && <p className="py-6 text-center text-muted-foreground">No merchant accounts yet.</p>}
      <ul className="divide-y rounded-2xl border bg-card">
        {listQ.data?.map((m) => (
          <li key={m.id} className="flex min-h-14 items-center justify-between px-4">
            <span><span className="font-medium">{m.email}</span> <span className="text-sm text-muted-foreground">· {m.cafe_name}</span></span>
            <Button variant="ghost" size="icon" aria-label="Remove access" onClick={async () => {
              const { error } = await supabase.rpc("admin_remove_merchant", { p_id: m.id });
              if (error) return toast.error(error.message);
              qc.invalidateQueries({ queryKey: ["admin-merchants"] });
            }}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
