ALTER TABLE public.cafes ADD COLUMN cuisine text, ADD COLUMN cover_url text, ADD COLUMN approved boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.cafes.approved IS 'Approved pilot restaurant. Demo/unapproved cafés are labelled and cannot take real orders.';

ALTER TABLE public.orders ADD COLUMN payment_ref text;
COMMENT ON COLUMN public.orders.payment_ref IS 'Razorpay payment id that paid for this order. Orders only exist after payment is captured.';

CREATE TABLE public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id),
  user_id uuid,
  customer_name text not null,
  notes text,
  pickup_at timestamptz not null,
  items jsonb not null,
  amount_paise integer not null,
  razorpay_order_id text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed','expired')),
  order_id uuid references public.orders(id),
  client_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read own payment attempts" ON public.payment_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Validates a cart exactly like place_order, but reserves a pending payment
-- attempt instead of creating an order. The real order is created only after
-- the payment webhook confirms capture.
CREATE OR REPLACE FUNCTION public.create_payment_attempt(p_cafe_id uuid, p_customer_name text, p_notes text, p_pickup_at timestamptz, p_items jsonb, p_client_hash text, p_user_id uuid DEFAULT NULL)
 RETURNS TABLE(attempt_id uuid, amount_paise integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  c public.cafes; local_pick timestamp; local_today date; slot_count int; recent int;
  it jsonb; mi public.menu_items; qty int; total_qty int := 0; unit int; grp jsonb; chosen text; opt jsonb; found_opt boolean;
  o_total int := 0; v_id uuid;
begin
  select * into c from public.cafes where id = p_cafe_id and is_active for update;
  if not found then raise exception 'Restaurant not found'; end if;
  if c.demo_mode then raise exception 'This restaurant is in demo mode and not taking real orders yet.'; end if;
  if not c.accepting_orders then raise exception 'This restaurant is not accepting orders right now'; end if;
  p_customer_name := btrim(coalesce(p_customer_name,''));
  if length(p_customer_name) < 1 or length(p_customer_name) > 60 then raise exception 'Please enter your name (max 60 characters)'; end if;
  if p_notes is not null and length(p_notes) > 300 then raise exception 'Notes too long'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then raise exception 'Your cart is empty or too large'; end if;

  select count(*) into recent from public.payment_attempts where client_hash = p_client_hash and created_at > now() - interval '10 minutes';
  if recent >= 5 then raise exception 'Too many orders placed recently. Please wait a few minutes.'; end if;

  local_pick := p_pickup_at at time zone 'Asia/Kolkata';
  local_today := (now() at time zone 'Asia/Kolkata')::date;
  if extract(second from local_pick) <> 0 or (extract(minute from local_pick)::int % 5) <> 0 then raise exception 'Invalid pickup time'; end if;
  if local_pick::date <> local_today then raise exception 'Pickup must be today'; end if;
  if local_pick::time < c.open_time or local_pick::time > c.close_time - interval '5 minutes' then raise exception 'Pickup time is outside opening hours'; end if;
  if p_pickup_at < now() + make_interval(mins => c.lead_time_minutes) then raise exception 'That pickup time is too soon. Please pick a later slot.'; end if;
  select (select count(*) from public.orders o where o.cafe_id = c.id and o.pickup_at = p_pickup_at and o.status <> 'cancelled')
       + (select count(*) from public.payment_attempts a where a.cafe_id = c.id and a.pickup_at = p_pickup_at and a.status = 'pending' and a.expires_at > now())
    into slot_count;
  if slot_count >= c.max_orders_per_slot then raise exception 'That pickup slot just filled up. Please choose another.'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it->>'quantity')::int;
    if qty is null or qty < 1 or qty > 10 then raise exception 'Quantity must be between 1 and 10'; end if;
    total_qty := total_qty + qty;
    if total_qty > 30 then raise exception 'Maximum 30 items per order'; end if;
    select * into mi from public.menu_items where id = (it->>'menu_item_id')::uuid and cafe_id = c.id and is_active;
    if not found then raise exception 'An item in your cart no longer exists'; end if;
    if not mi.is_available then raise exception '% is out of stock', mi.name; end if;
    unit := mi.price_paise;
    for grp in select * from jsonb_array_elements(mi.customizations) loop
      chosen := coalesce(it->'options'->>(grp->>'name'), grp->'options'->0->>'label');
      found_opt := false;
      for opt in select * from jsonb_array_elements(grp->'options') loop
        if opt->>'label' = chosen then unit := unit + coalesce((opt->>'price_paise')::int,0); found_opt := true; end if;
      end loop;
      if not found_opt then raise exception 'Invalid option for %', mi.name; end if;
    end loop;
    o_total := o_total + unit*qty;
  end loop;

  insert into public.payment_attempts(cafe_id, user_id, customer_name, notes, pickup_at, items, amount_paise, client_hash)
  values (c.id, p_user_id, p_customer_name, nullif(btrim(coalesce(p_notes,'')),''), p_pickup_at, p_items, o_total, p_client_hash)
  returning id into v_id;
  return query select v_id, o_total;
end $function$;
REVOKE ALL ON FUNCTION public.create_payment_attempt(uuid, text, text, timestamptz, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_attempt(uuid, text, text, timestamptz, jsonb, text, uuid) TO service_role;

-- Slot availability now also subtracts pending (unexpired) payment attempts
CREATE OR REPLACE FUNCTION public.get_available_slots(p_cafe_id uuid)
 RETURNS TABLE(slot timestamptz, remaining integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      (c.max_orders_per_slot
        - (select count(*) from public.orders o where o.cafe_id = c.id and o.pickup_at = (g at time zone 'Asia/Kolkata') and o.status <> 'cancelled')
        - (select count(*) from public.payment_attempts a where a.cafe_id = c.id and a.pickup_at = (g at time zone 'Asia/Kolkata') and a.status = 'pending' and a.expires_at > now()))::int
    from generate_series(greatest(first_local, (now() at time zone 'Asia/Kolkata')::date + c.open_time), last_local, interval '5 minutes') g;
end $function$;