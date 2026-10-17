ALTER TABLE public.orders ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.orders.is_demo IS 'Academic demonstration fulfillment only; no real payment, settlement, or kitchen obligation.';
CREATE UNIQUE INDEX orders_payment_ref_unique ON public.orders(payment_ref) WHERE payment_ref IS NOT NULL;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO service_role;
CREATE OR REPLACE FUNCTION public.claim_first_admin() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Initial admin access must be provisioned by the app owner through secure managed tools'; END $$;
CREATE OR REPLACE FUNCTION public.finalize_test_payment(p_attempt_id uuid,p_razorpay_order_id text,p_payment_id text,p_amount integer,p_currency text,p_captured_at timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.payment_attempts; c public.cafes; v_order uuid; v_token text; v_code text; it jsonb;
BEGIN
 SELECT * INTO a FROM public.payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR NOT a.is_test OR a.razorpay_order_id IS DISTINCT FROM p_razorpay_order_id OR a.amount_paise<>p_amount OR p_currency IS DISTINCT FROM 'INR' OR p_payment_id IS NULL OR p_payment_id !~ '^pay_[a-zA-Z0-9]+$' THEN RAISE EXCEPTION 'Payment does not match checkout'; END IF;
 IF a.status='paid' THEN
  IF a.razorpay_payment_id IS DISTINCT FROM p_payment_id THEN RAISE EXCEPTION 'Checkout already paid'; END IF;
  SELECT tracking_token INTO v_token FROM public.orders WHERE id=a.order_id;
  RETURN jsonb_build_object('status','paid','test',true,'tracking_token',v_token);
 END IF;
 IF p_captured_at IS NULL OR p_captured_at<a.created_at-interval '1 minute' OR p_captured_at>now()+interval '1 minute' THEN RAISE EXCEPTION 'Invalid capture time'; END IF;
 SELECT * INTO c FROM public.cafes WHERE id=a.cafe_id;
 IF c.demo_mode AND a.user_id IS NOT NULL AND p_captured_at<=a.expires_at AND a.pickup_at>now() AND jsonb_array_length(a.item_snapshot)>0 THEN
  v_token:=encode(extensions.gen_random_bytes(24),'hex');
  v_code:='D-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  INSERT INTO public.orders(cafe_id,pickup_code,tracking_token,customer_name,notes,pickup_at,status,total_paise,user_id,payment_ref,accepted_at,is_demo)
  VALUES(a.cafe_id,v_code,v_token,a.customer_name,a.notes,a.pickup_at,'accepted',a.amount_paise,a.user_id,p_payment_id,now(),true) RETURNING id INTO v_order;
  FOR it IN SELECT * FROM jsonb_array_elements(a.item_snapshot) LOOP
   INSERT INTO public.order_items(order_id,menu_item_id,name,quantity,unit_price_paise,options,line_total_paise)
   VALUES(v_order,(it->>'menu_item_id')::uuid,it->>'name',(it->>'quantity')::integer,(it->>'unit_price_paise')::integer,it->'options',(it->>'quantity')::integer*(it->>'unit_price_paise')::integer);
  END LOOP;
 END IF;
 UPDATE public.payment_attempts SET status='paid',razorpay_payment_id=p_payment_id,captured_at=p_captured_at,order_id=v_order WHERE id=a.id;
 RETURN jsonb_build_object('status','paid','test',true,'tracking_token',v_token);
END $$;
REVOKE ALL ON FUNCTION public.finalize_test_payment(uuid,text,text,integer,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_test_payment(uuid,text,text,integer,text,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT CASE WHEN p_token !~ '^[a-f0-9]{48}$' THEN NULL ELSE (
 SELECT jsonb_build_object('pickup_code',o.pickup_code,'customer_name',o.customer_name,'status',o.status,'pickup_at',o.pickup_at,'total_paise',o.total_paise,'notes',o.notes,'cancel_reason',o.cancel_reason,'created_at',o.created_at,'is_demo',o.is_demo,'payment_verified',o.payment_ref IS NOT NULL,'cafe',jsonb_build_object('name',c.name,'address',c.address,'slug',c.slug,'logo_url',c.logo_url),'items',coalesce((SELECT jsonb_agg(jsonb_build_object('name',i.name,'quantity',i.quantity,'options',i.options,'line_total_paise',i.line_total_paise)) FROM public.order_items i WHERE i.order_id=o.id),'[]'::jsonb)) FROM public.orders o JOIN public.cafes c ON c.id=o.cafe_id WHERE o.tracking_token=p_token) END $$;
REVOKE ALL ON FUNCTION public.get_order_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_token(text) TO anon,authenticated,service_role;