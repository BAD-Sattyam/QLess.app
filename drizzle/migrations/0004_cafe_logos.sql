ALTER TABLE public.cafes ADD COLUMN logo_url text;
COMMENT ON COLUMN public.cafes.logo_url IS 'Path of the café logo in the cafe-logos storage bucket (or absolute URL).';

CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when length(p_token) <> 48 then null else (
    select jsonb_build_object(
      'pickup_code', o.pickup_code, 'customer_name', o.customer_name, 'status', o.status,
      'pickup_at', o.pickup_at, 'total_paise', o.total_paise, 'notes', o.notes,
      'cancel_reason', o.cancel_reason, 'created_at', o.created_at,
      'cafe', jsonb_build_object('name', c.name, 'address', c.address, 'slug', c.slug, 'logo_url', c.logo_url),
      'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'options', i.options, 'line_total_paise', i.line_total_paise)) from public.order_items i where i.order_id = o.id), '[]'::jsonb))
    from public.orders o join public.cafes c on c.id = o.cafe_id where o.tracking_token = p_token) end
$function$;

-- Anyone can read café logos (needed for signed URLs on the private bucket)
CREATE POLICY "public read cafe logos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'cafe-logos');
-- Only admins can upload/change/delete logos
CREATE POLICY "admin write cafe logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cafe-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update cafe logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cafe-logos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete cafe logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cafe-logos' AND public.has_role(auth.uid(), 'admin'));