REVOKE INSERT, UPDATE, DELETE ON public.orders,public.order_items,public.payment_attempts,public.user_roles,public.merchant_memberships FROM anon,authenticated;
GRANT SELECT ON public.orders,public.order_items,public.payment_attempts,public.user_roles,public.merchant_memberships TO authenticated;
GRANT ALL ON public.orders,public.order_items,public.payment_attempts,public.user_roles,public.merchant_memberships TO service_role;
CREATE OR REPLACE FUNCTION public.provision_designated_demo_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF lower(NEW.email) IS DISTINCT FROM 'sattyam.khandelwal2028@mastersunion.org' OR NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(832017);
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') THEN
  INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'admin') ON CONFLICT(user_id,role) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.provision_designated_demo_admin() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER qless_designated_demo_admin AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.provision_designated_demo_admin();