
create type public.app_role as enum ('admin');
create type public.order_status as enum ('pending','accepted','preparing','ready','collected','cancelled');

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- CAFES
create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  address text not null,
  open_time time not null default '08:00',
  close_time time not null default '20:00',
  lead_time_minutes int not null default 10 check (lead_time_minutes between 0 and 240),
  avg_prep_minutes int not null default 8 check (avg_prep_minutes between 1 and 120),
  max_orders_per_slot int not null default 6 check (max_orders_per_slot between 1 and 100),
  accepting_orders boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.cafes to anon, authenticated;
grant insert, update, delete on public.cafes to authenticated;
grant all on public.cafes to service_role;
alter table public.cafes enable row level security;
create policy "public read active cafes" on public.cafes for select to anon, authenticated using (is_active or public.has_role(auth.uid(),'admin'));
create policy "admin insert cafes" on public.cafes for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update cafes" on public.cafes for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete cafes" on public.cafes for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- MENU
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'Coffee',
  price_paise int not null check (price_paise >= 0 and price_paise <= 10000000),
  customizations jsonb not null default '[]'::jsonb,
  is_available boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.menu_items(cafe_id);
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "public read menu" on public.menu_items for select to anon, authenticated using (is_active or public.has_role(auth.uid(),'admin'));
create policy "admin insert menu" on public.menu_items for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update menu" on public.menu_items for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete menu" on public.menu_items for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- MEMBERSHIPS
create table public.merchant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, cafe_id)
);
grant select on public.merchant_memberships to authenticated;
grant all on public.merchant_memberships to service_role;
alter table public.merchant_memberships enable row level security;
create policy "own or admin memberships" on public.merchant_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.is_cafe_member(_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.merchant_memberships where cafe_id = _cafe_id and user_id = auth.uid())
      or public.has_role(auth.uid(),'admin')
$$;

-- ORDERS
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete restrict,
  pickup_code text not null,
  tracking_token text not null unique,
  customer_name text not null,
  notes text,
  pickup_at timestamptz not null,
  status public.order_status not null default 'pending',
  total_paise int not null default 0,
  cancel_reason text,
  client_hash text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  collected_at timestamptz,
  cancelled_at timestamptz
);
create index on public.orders(cafe_id, pickup_at);
create index on public.orders(client_hash, created_at);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "members read cafe orders" on public.orders for select to authenticated using (public.is_cafe_member(cafe_id));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  quantity int not null check (quantity between 1 and 10),
  unit_price_paise int not null,
  options jsonb not null default '{}'::jsonb,
  line_total_paise int not null
);
create index on public.order_items(order_id);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "members read order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.is_cafe_member(o.cafe_id)));

alter publication supabase_realtime add table public.orders;

-- AVAILABLE SLOTS (today, IST)
create or replace function public.get_available_slots(p_cafe_id uuid)
returns table(slot timestamptz, remaining int)
language plpgsql stable security definer set search_path = public as $$
declare c public.cafes; local_now timestamp; first_local timestamp; last_local timestamp;
begin
  select * into c from public.cafes where id = p_cafe_id and is_active;
  if not found or not c.accepting_orders then return; end if;
  local_now := (now() at time zone 'Asia/Kolkata') + make_interval(mins => c.lead_time_minutes);
  first_local := date_trunc('hour', local_now) + make_interval(mins => (ceil(extract(minute from local_now)::numeric / 5) * 5)::int);
  if first_local < (current_date at time zone 'Asia/Kolkata')::date + c.open_time then
    first_local := ((now() at time zone 'Asia/Kolkata')::date + c.open_time);
  end if;
  last_local := (now() at time zone 'Asia/Kolkata')::date + c.close_time - interval '5 minutes';
  return query
    select (g at time zone 'Asia/Kolkata') as slot,
      (c.max_orders_per_slot - (select count(*) from public.orders o
         where o.cafe_id = c.id and o.pickup_at = (g at time zone 'Asia/Kolkata') and o.status <> 'cancelled'))::int
    from generate_series(greatest(first_local, (now() at time zone 'Asia/Kolkata')::date + c.open_time), last_local, interval '5 minutes') g;
end $$;
grant execute on function public.get_available_slots(uuid) to anon, authenticated;

-- PLACE ORDER (server only)
create or replace function public.place_order(
  p_cafe_id uuid, p_customer_name text, p_notes text, p_pickup_at timestamptz, p_items jsonb, p_client_hash text)
returns table(tracking_token text, pickup_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  c public.cafes; local_pick timestamp; local_today date; slot_count int; recent int;
  it jsonb; mi public.menu_items; qty int; total_qty int := 0; unit int; grp jsonb; chosen text; opt jsonb; found_opt boolean;
  chosen_opts jsonb; o_id uuid; o_total int := 0; v_code text; v_token text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  select * into c from public.cafes where id = p_cafe_id and is_active for update;
  if not found then raise exception 'Café not found'; end if;
  if not c.accepting_orders then raise exception 'This café is not accepting orders right now'; end if;
  p_customer_name := btrim(coalesce(p_customer_name,''));
  if length(p_customer_name) < 1 or length(p_customer_name) > 60 then raise exception 'Please enter your name (max 60 characters)'; end if;
  if p_notes is not null and length(p_notes) > 300 then raise exception 'Notes too long'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then raise exception 'Your cart is empty or too large'; end if;

  select count(*) into recent from public.orders where client_hash = p_client_hash and created_at > now() - interval '10 minutes';
  if recent >= 5 then raise exception 'Too many orders placed recently. Please wait a few minutes.'; end if;

  local_pick := p_pickup_at at time zone 'Asia/Kolkata';
  local_today := (now() at time zone 'Asia/Kolkata')::date;
  if extract(second from local_pick) <> 0 or (extract(minute from local_pick)::int % 5) <> 0 then raise exception 'Invalid pickup time'; end if;
  if local_pick::date <> local_today then raise exception 'Pickup must be today'; end if;
  if local_pick::time < c.open_time or local_pick::time > c.close_time - interval '5 minutes' then raise exception 'Pickup time is outside opening hours'; end if;
  if p_pickup_at < now() + make_interval(mins => c.lead_time_minutes) then raise exception 'That pickup time is too soon. Please pick a later slot.'; end if;
  select count(*) into slot_count from public.orders where cafe_id = c.id and pickup_at = p_pickup_at and status <> 'cancelled';
  if slot_count >= c.max_orders_per_slot then raise exception 'That pickup slot just filled up. Please choose another.'; end if;

  loop
    v_code := '';
    for i in 1..4 loop v_code := v_code || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.orders where cafe_id = c.id and pickup_code = v_code and created_at > now() - interval '1 day');
  end loop;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.orders(cafe_id, pickup_code, tracking_token, customer_name, notes, pickup_at, client_hash)
  values (c.id, v_code, v_token, p_customer_name, nullif(btrim(coalesce(p_notes,'')),''), p_pickup_at, p_client_hash)
  returning id into o_id;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it->>'quantity')::int;
    if qty is null or qty < 1 or qty > 10 then raise exception 'Quantity must be between 1 and 10'; end if;
    total_qty := total_qty + qty;
    if total_qty > 30 then raise exception 'Maximum 30 items per order'; end if;
    select * into mi from public.menu_items where id = (it->>'menu_item_id')::uuid and cafe_id = c.id and is_active;
    if not found then raise exception 'An item in your cart no longer exists'; end if;
    if not mi.is_available then raise exception '% is out of stock', mi.name; end if;
    unit := mi.price_paise; chosen_opts := '{}'::jsonb;
    for grp in select * from jsonb_array_elements(mi.customizations) loop
      chosen := coalesce(it->'options'->>(grp->>'name'), grp->'options'->0->>'label');
      found_opt := false;
      for opt in select * from jsonb_array_elements(grp->'options') loop
        if opt->>'label' = chosen then unit := unit + coalesce((opt->>'price_paise')::int,0); found_opt := true; end if;
      end loop;
      if not found_opt then raise exception 'Invalid option for %', mi.name; end if;
      chosen_opts := chosen_opts || jsonb_build_object(grp->>'name', chosen);
    end loop;
    insert into public.order_items(order_id, menu_item_id, name, quantity, unit_price_paise, options, line_total_paise)
    values (o_id, mi.id, mi.name, qty, unit, chosen_opts, unit*qty);
    o_total := o_total + unit*qty;
  end loop;
  update public.orders set total_paise = o_total where id = o_id;
  return query select v_token, v_code;
end $$;
revoke execute on function public.place_order(uuid,text,text,timestamptz,jsonb,text) from public, anon, authenticated;
grant execute on function public.place_order(uuid,text,text,timestamptz,jsonb,text) to service_role;

-- GUEST TRACKING
create or replace function public.get_order_by_token(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when length(p_token) <> 48 then null else (
    select jsonb_build_object(
      'pickup_code', o.pickup_code, 'customer_name', o.customer_name, 'status', o.status,
      'pickup_at', o.pickup_at, 'total_paise', o.total_paise, 'notes', o.notes,
      'cancel_reason', o.cancel_reason, 'created_at', o.created_at,
      'cafe', jsonb_build_object('name', c.name, 'address', c.address, 'slug', c.slug),
      'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'options', i.options, 'line_total_paise', i.line_total_paise)) from public.order_items i where i.order_id = o.id), '[]'::jsonb))
    from public.orders o join public.cafes c on c.id = o.cafe_id where o.tracking_token = p_token) end
$$;
grant execute on function public.get_order_by_token(text) to anon, authenticated;

-- MERCHANT ACTIONS
create or replace function public.update_order_status(p_order_id uuid, p_status public.order_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or not public.is_cafe_member(o.cafe_id) then raise exception 'Not allowed'; end if;
  if not (
    (o.status = 'pending' and p_status in ('accepted','cancelled')) or
    (o.status = 'accepted' and p_status in ('preparing','cancelled')) or
    (o.status = 'preparing' and p_status in ('ready','cancelled')) or
    (o.status = 'ready' and p_status in ('collected','cancelled'))
  ) then raise exception 'Cannot move order from % to %', o.status, p_status; end if;
  if p_status = 'cancelled' and length(btrim(coalesce(p_reason,''))) < 2 then raise exception 'A cancellation reason is required'; end if;
  update public.orders set status = p_status,
    accepted_at = case when p_status='accepted' then now() else accepted_at end,
    preparing_at = case when p_status='preparing' then now() else preparing_at end,
    ready_at = case when p_status='ready' then now() else ready_at end,
    collected_at = case when p_status='collected' then now() else collected_at end,
    cancelled_at = case when p_status='cancelled' then now() else cancelled_at end,
    cancel_reason = case when p_status='cancelled' then left(btrim(p_reason),200) else cancel_reason end
  where id = p_order_id;
end $$;
revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;

create or replace function public.set_item_availability(p_item_id uuid, p_available boolean)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select cafe_id into cid from public.menu_items where id = p_item_id;
  if cid is null or not public.is_cafe_member(cid) then raise exception 'Not allowed'; end if;
  update public.menu_items set is_available = p_available where id = p_item_id;
end $$;
revoke execute on function public.set_item_availability(uuid, boolean) from public, anon;
grant execute on function public.set_item_availability(uuid, boolean) to authenticated;

create or replace function public.set_cafe_accepting(p_cafe_id uuid, p_accepting boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_cafe_member(p_cafe_id) then raise exception 'Not allowed'; end if;
  update public.cafes set accepting_orders = p_accepting where id = p_cafe_id;
end $$;
revoke execute on function public.set_cafe_accepting(uuid, boolean) from public, anon;
grant execute on function public.set_cafe_accepting(uuid, boolean) to authenticated;

-- ADMIN
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.user_roles where role = 'admin') then return false; end if;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'admin');
  return true;
end $$;
revoke execute on function public.claim_first_admin() from public, anon;
grant execute on function public.claim_first_admin() to authenticated;

create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;
grant execute on function public.admin_exists() to authenticated;

create or replace function public.admin_list_merchants()
returns table(id uuid, user_id uuid, email text, cafe_id uuid, cafe_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Not allowed'; end if;
  return query select m.id, m.user_id, u.email::text, m.cafe_id, c.name, m.created_at
    from public.merchant_memberships m join auth.users u on u.id = m.user_id join public.cafes c on c.id = m.cafe_id
    order by m.created_at desc;
end $$;
revoke execute on function public.admin_list_merchants() from public, anon;
grant execute on function public.admin_list_merchants() to authenticated;

create or replace function public.admin_add_merchant(p_email text, p_cafe_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Not allowed'; end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email));
  if uid is null then raise exception 'No account with that email. Create the user first in Lovable Cloud → Users.'; end if;
  insert into public.merchant_memberships(user_id, cafe_id) values (uid, p_cafe_id) on conflict do nothing;
end $$;
revoke execute on function public.admin_add_merchant(text, uuid) from public, anon;
grant execute on function public.admin_add_merchant(text, uuid) to authenticated;

create or replace function public.admin_remove_merchant(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Not allowed'; end if;
  delete from public.merchant_memberships where id = p_id;
end $$;
revoke execute on function public.admin_remove_merchant(uuid) from public, anon;
grant execute on function public.admin_remove_merchant(uuid) to authenticated;

-- SEED
insert into public.cafes (slug, name, tagline, address, open_time, close_time, lead_time_minutes, avg_prep_minutes, max_orders_per_slot)
values ('third-shift', 'Third Shift Coffee', 'Skip the queue. Grab and go.', 'Ground Floor, Tower B, Embassy Tech Village, Outer Ring Road, Bengaluru 560103', '07:30', '21:00', 10, 8, 6);

with c as (select id from public.cafes where slug = 'third-shift'),
size_milk as (select '[{"name":"Size","options":[{"label":"Regular","price_paise":0},{"label":"Large","price_paise":4000}]},{"name":"Milk","options":[{"label":"Dairy","price_paise":0},{"label":"Oat","price_paise":5000},{"label":"Almond","price_paise":5000}]},{"name":"Sugar","options":[{"label":"No sugar","price_paise":0},{"label":"Less sugar","price_paise":0},{"label":"Regular sugar","price_paise":0}]}]'::jsonb j),
size_only as (select '[{"name":"Size","options":[{"label":"Regular","price_paise":0},{"label":"Large","price_paise":4000}]},{"name":"Sugar","options":[{"label":"No sugar","price_paise":0},{"label":"Less sugar","price_paise":0},{"label":"Regular sugar","price_paise":0}]}]'::jsonb j),
bread as (select '[{"name":"Bread","options":[{"label":"White","price_paise":0},{"label":"Multigrain","price_paise":2000}]}]'::jsonb j)
insert into public.menu_items (cafe_id, name, description, category, price_paise, customizations, sort_order)
select c.id, v.name, v.descr, v.cat, v.price, v.cust, v.ord from c, (values
  ('Cappuccino','Double shot espresso, velvety steamed milk, thick foam.','Coffee',18000,(select j from size_milk),1),
  ('Café Latte','Smooth espresso with silky milk and a thin layer of foam.','Coffee',19000,(select j from size_milk),2),
  ('Americano','Espresso lengthened with hot water. Bold and clean.','Coffee',15000,(select j from size_only),3),
  ('Cold Coffee','Classic blended iced coffee, creamy and sweet.','Cold',20000,(select j from size_milk),4),
  ('Masala Chai','Assam tea brewed with ginger, cardamom and spices.','Tea',8000,(select j from size_only),5),
  ('Veg Grilled Sandwich','Cheese, capsicum, onion, tomato and mint chutney.','Food',16000,(select j from bread),6),
  ('Chicken Tikka Sandwich','Smoky tikka, onions and mayo on toasted bread.','Food',22000,(select j from bread),7),
  ('Butter Croissant','Flaky, all-butter croissant baked fresh every morning.','Breakfast',12000,'[]'::jsonb,8),
  ('Poha','Flattened rice with peanuts, curry leaves and lemon.','Breakfast',9000,'[]'::jsonb,9),
  ('Blueberry Muffin','Soft muffin loaded with blueberries.','Breakfast',11000,'[]'::jsonb,10)
) as v(name, descr, cat, price, cust, ord);
