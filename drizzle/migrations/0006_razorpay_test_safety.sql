ALTER TABLE public.payment_attempts ADD COLUMN is_test boolean NOT NULL DEFAULT true, ADD COLUMN item_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN razorpay_payment_id text, ADD COLUMN captured_at timestamptz, ADD COLUMN checkout_cancelled_at timestamptz;
CREATE UNIQUE INDEX payment_attempts_payment_unique ON public.payment_attempts(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
COMMENT ON COLUMN public.payment_attempts.is_test IS 'Test payments are receipts only, never preparation orders or live settlement.';
CREATE OR REPLACE FUNCTION public.create_test_payment_attempt(p_cafe_id uuid,p_customer_name text,p_notes text,p_pickup_at timestamptz,p_items jsonb,p_client_hash text,p_user_id uuid DEFAULT NULL) RETURNS TABLE(attempt_id uuid,amount_paise integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_column
DECLARE c public.cafes; local_pick timestamp; slot_count int; recent int; it jsonb; mi public.menu_items; qty int; total_qty int:=0; unit int; grp jsonb; chosen text; opt jsonb; found_opt boolean; o_total int:=0; v_id uuid; snapshots jsonb:='[]'::jsonb; chosen_opts jsonb;
BEGIN
 SELECT * INTO c FROM public.cafes WHERE id=p_cafe_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant not found'; END IF;
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'Sign in to pay'; END IF;
 IF NOT c.accepting_orders THEN RAISE EXCEPTION 'This restaurant is not accepting orders right now'; END IF;
 p_customer_name:=btrim(coalesce(p_customer_name,''));
 IF length(p_customer_name)<1 OR length(p_customer_name)>60 THEN RAISE EXCEPTION 'Please enter your name (max 60 characters)'; END IF;
 IF length(coalesce(p_notes,''))>300 THEN RAISE EXCEPTION 'Notes too long'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>20 THEN RAISE EXCEPTION 'Your cart is empty or too large'; END IF;
 SELECT count(*) INTO recent FROM public.payment_attempts WHERE client_hash=p_client_hash AND created_at>now()-interval '10 minutes';
 IF recent>=5 THEN RAISE EXCEPTION 'Too many orders placed recently. Please wait a few minutes.'; END IF;
 local_pick:=p_pickup_at AT TIME ZONE 'Asia/Kolkata';
 IF p_pickup_at IS NULL OR extract(second FROM local_pick)<>0 OR extract(minute FROM local_pick)::int%5<>0 THEN RAISE EXCEPTION 'Invalid pickup time'; END IF;
 IF local_pick::date<>(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Pickup must be today'; END IF;
 IF local_pick::time<c.open_time OR local_pick::time>c.close_time-interval '5 minutes' THEN RAISE EXCEPTION 'Pickup time is outside opening hours'; END IF;
 IF p_pickup_at<now()+make_interval(mins=>c.lead_time_minutes) THEN RAISE EXCEPTION 'That pickup time is too soon. Please pick a later slot.'; END IF;
 SELECT (SELECT count(*) FROM public.orders o WHERE o.cafe_id=c.id AND o.pickup_at=p_pickup_at AND o.status<>'cancelled')+(SELECT count(*) FROM public.payment_attempts a WHERE a.cafe_id=c.id AND a.pickup_at=p_pickup_at AND a.status='pending' AND a.expires_at>now()) INTO slot_count;
 IF slot_count>=c.max_orders_per_slot THEN RAISE EXCEPTION 'That pickup slot just filled up. Please choose another.'; END IF;
 FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
 qty:=(it->>'quantity')::int;
 IF qty IS NULL OR qty<1 OR qty>10 THEN RAISE EXCEPTION 'Quantity must be between 1 and 10'; END IF;
 total_qty:=total_qty+qty; IF total_qty>30 THEN RAISE EXCEPTION 'Maximum 30 items per order'; END IF;
 SELECT * INTO mi FROM public.menu_items WHERE id=(it->>'menu_item_id')::uuid AND cafe_id=c.id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'An item in your cart no longer exists'; END IF;
 IF NOT mi.is_available THEN RAISE EXCEPTION '% is out of stock',mi.name; END IF;
 unit:=mi.price_paise; chosen_opts:='{}'::jsonb;
 FOR grp IN SELECT * FROM jsonb_array_elements(mi.customizations) LOOP
 chosen:=coalesce(it->'options'->>(grp->>'name'),grp->'options'->0->>'label'); found_opt:=false;
 FOR opt IN SELECT * FROM jsonb_array_elements(grp->'options') LOOP
 IF opt->>'label'=chosen THEN unit:=unit+coalesce((opt->>'price_paise')::int,0); found_opt:=true; END IF;
 END LOOP;
 IF NOT found_opt THEN RAISE EXCEPTION 'Invalid option for %',mi.name; END IF;
 chosen_opts:=chosen_opts||jsonb_build_object(grp->>'name',chosen);
 END LOOP;
 o_total:=o_total+unit*qty;
 snapshots:=snapshots||jsonb_build_array(jsonb_build_object('menu_item_id',mi.id,'name',mi.name,'quantity',qty,'unit_price_paise',unit,'options',chosen_opts));
 END LOOP;
 IF o_total<=0 THEN RAISE EXCEPTION 'Payment total must be positive'; END IF;
 INSERT INTO public.payment_attempts(cafe_id,user_id,customer_name,notes,pickup_at,items,amount_paise,client_hash,is_test,item_snapshot) VALUES(c.id,p_user_id,p_customer_name,nullif(btrim(coalesce(p_notes,'')),''),p_pickup_at,p_items,o_total,p_client_hash,true,snapshots) RETURNING id INTO v_id;
 RETURN QUERY SELECT v_id,o_total;
END $$;
REVOKE ALL ON FUNCTION public.create_test_payment_attempt(uuid,text,text,timestamptz,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_test_payment_attempt(uuid,text,text,timestamptz,jsonb,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.finalize_test_payment(p_attempt_id uuid,p_razorpay_order_id text,p_payment_id text,p_amount integer,p_currency text,p_captured_at timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.payment_attempts;
BEGIN
 SELECT * INTO a FROM public.payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR NOT a.is_test OR a.razorpay_order_id IS DISTINCT FROM p_razorpay_order_id OR a.amount_paise<>p_amount OR p_currency<>'INR' OR p_payment_id IS NULL THEN RAISE EXCEPTION 'Payment does not match checkout'; END IF;
 IF a.status='paid' THEN
 IF a.razorpay_payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION 'Checkout already paid'; END IF;
 RETURN jsonb_build_object('status','paid','test',true);
 END IF;
 IF p_captured_at IS NULL OR p_captured_at<a.created_at-interval '1 minute' OR p_captured_at>now()+interval '1 minute' THEN RAISE EXCEPTION 'Invalid capture time'; END IF;
 UPDATE public.payment_attempts SET status='paid',razorpay_payment_id=p_payment_id,captured_at=p_captured_at WHERE id=a.id;
 RETURN jsonb_build_object('status','paid','test',true);
END $$;
REVOKE ALL ON FUNCTION public.finalize_test_payment(uuid,text,text,integer,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_test_payment(uuid,text,text,integer,text,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.expire_payment_attempts() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ UPDATE public.payment_attempts SET status='expired' WHERE status='pending' AND expires_at<=now(); $$;
REVOKE ALL ON FUNCTION public.expire_payment_attempts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_payment_attempts() TO service_role;