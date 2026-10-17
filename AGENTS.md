<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Qless architecture
- Email verification returns use public `/auth/callback` and `/reset-password`, verify provider identity before navigation, and derive destinations from protected roles/memberships; canonical email links never use editor or preview origins. Why: email links must establish a session on the published origin without granting privileges from URL claims.
- Customer `/auth` uses native Cloud Auth phone OTP; staff email authentication lives at `/staff/login`, partner entry points reuse it and the existing merchant dashboard; staff/admin routes check server-verified assignments/roles under the managed auth gate. Why: preserve existing screens while denying customers staff access.
- Customer profile fields live in owner-scoped `public.profiles`, automatically created for new Auth users and backfilled for existing IDs. Why: preserve order ownership and keep privileges exclusively in the protected roles table.
- Existing email-to-phone transitions require administrator identity verification and linking on the existing Auth ID before phone signup; never auto-merge by phone/name. Why: prevent account takeover and duplicate ownership.
- OTP resend UI is a convenience only; native Auth controls issue/verification limits and SMS credentials. Why: bypassable browser timers must not be presented as security throttling.
- Legacy `placeOrder` and `place_order` creation paths are blocked in the test-only integration. Why: directly callable legacy RPCs must not bypass payment verification or create unpaid preparation orders.
- Guests read orders only via `get_order_by_token` (48-hex token); the pickup code never grants access. Why: private tracking links.
- Merchant writes (status, stock, pause) go through SECURITY DEFINER RPCs that check `is_cafe_member`; orders tables have no direct write grants. Why: staff must not edit totals or other cafés' data.
- Money is stored as integer paise; times are timestamptz, displayed in Asia/Kolkata.
- Customers must sign in to place orders: `placeOrder` uses requireSupabaseAuth and stamps orders.user_id; guests can browse but checkout shows a sign-in gate. Why: customer accounts with order history at /orders.
- Customers read their own orders via RLS (orders.user_id = auth.uid()); the token-based get_order_by_token path still works for tracking links. Why: private order data, shareable tracking.
- Cafés have a demo_mode flag: place_order rejects demo cafés and the café page shows a provisional-details badge. Why: demo outlets must not take real orders until the merchant confirms menu, hours and staff.
- Checkout uses service-only `create_test_payment_attempt` for validated, expiring reservations; `finalize_test_payment` locks each attempt and records a unique captured receipt atomically, creating an `is_demo` order only for a demo outlet, timely capture and future pickup; ordinary test receipts stay order-free. Why: retries cannot duplicate demonstration fulfillment and no live orders are created.
- Razorpay provider calls live in `razorpay.server.ts`, shared signature/capture rules in `payment-security.ts`, and authenticated RPC wrappers in `payments.functions.ts`. Why: private credentials stay server-only and browser callbacks are never trusted alone.
- Missing or non-test Razorpay credentials block checkout before reserving slots; demo order labels must appear in staff, history and tracking surfaces. Why: prevent unintended live collection and confusion with real restaurant fulfillment.
- Initial administrator assignment uses a lifecycle trigger for the owner's explicitly designated verified email, serialized before assigning the first role; `claim_first_admin` is disabled and staff login has no public signup. Why: managed Add user can securely bootstrap the owner without permitting arbitrary customers to promote themselves.
- Managed payment expiry callbacks reconcile a bounded batch and expire pending attempts; slot queries independently exclude elapsed reservations. Why: abandoned checkouts release capacity even if scheduled delivery is delayed.
- Restaurant pages live at /restaurant/$slug; /cafe/$slug redirects. Homepage / is the discovery list; demo/unapproved cafés are badged and cannot take orders.
- Scope discovery-page theme overrides under `.qless-home` in the global stylesheet; why: homepage visual changes must not restyle restaurant, checkout, or staff screens.
