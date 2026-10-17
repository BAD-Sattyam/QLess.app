ALTER TABLE public.cafes ADD COLUMN demo_mode boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.cafes.demo_mode IS 'Demo outlet: orders are blocked until the café authorizes the pilot.';

CREATE OR REPLACE FUNCTION public.place_order(p_cafe_id uuid, p_customer_name text, p_notes text, p_pickup_at timestamptz, p_items jsonb, p_client_hash text, p_user_id uuid DEFAULT NULL)
RETURNS TABLE(tracking_token text, pickup_code text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
#variable_conflict use_column
declare
  c public.cafes; local_pick timestamp; local_today date; slot_count int; recent int;
  it jsonb; mi public.menu_items; qty int; total_qty int := 0; unit int; grp jsonb; chosen text; opt jsonb; found_opt boolean;
  chosen_opts jsonb; o_id uuid; o_total int := 0; v_code text; v_token text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  select * into c from public.cafes where id = p_cafe_id and is_active for update;
  if not found then raise exception 'Café not found'; end if;
  if c.demo_mode then raise exception 'This café is in demo mode and not taking real orders yet.'; end if;
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

  insert into public.orders(cafe_id, pickup_code, tracking_token, customer_name, notes, pickup_at, client_hash, user_id)
  values (c.id, v_code, v_token, p_customer_name, nullif(btrim(coalesce(p_notes,'')),''), p_pickup_at, p_client_hash, p_user_id)
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
end $function$;