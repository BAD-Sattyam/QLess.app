# Qless Razorpay Test Checkout

## Secure settings
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` are configured securely; never copy them into source or chat.
- Select **Test Mode** in Razorpay and use its API key pair. Non-test configuration is rejected before slot reservation.
- Enable automatic capture in Razorpay Test Mode. Authorized-only payments remain pending; Qless does not assume authorization is capture.
- Set the Test Mode webhook to:
  `https://pixel-perfect-pixie-640.lovable.app/api/public/razorpay-webhook`
- Subscribe to `payment.captured` and `payment.failed`, using the identical webhook secret saved securely in Qless.
- This production URL serves the handler only after this version is published. The app was not published automatically.
- Current preview callback URL:
  `https://project--948c9f6a-55a2-48ae-814f-7ca3371e3836-dev.lovable.app/api/public/razorpay-webhook`

## Safety and states
- Cart prices/options, stock, pickup date, hours, lead time, capacity and rate limits are enforced by a service-only transaction. Totals are integer INR paise and item prices are snapshotted.
- Pending-payment orders are represented by the existing `payment_attempts` records, not by preparation orders.
- The checkout callback signature is verified using the stored provider order ID; captured status, provider order ID, amount and currency are independently checked via Razorpay before atomic receipt finalization.
- Captured receipts are locked and deduplicated by attempt/payment ID. Signed capture webhooks use the same finalization path. Browser success alone never confirms payment.
- Closing checkout means confirmation pending, not proof of failure. Failed and expired attempts release reservations; pending reservations stop counting after 15 minutes independently of the five-minute cleanup job.
- Refreshing checkout restores the same-tab pending attempt and checks status again. Cleanup also reconciles a bounded recent batch; webhooks retry unavailable confirmations.
- This integration is test-only: captured payments create test receipts, not kitchen orders. Dohful remains `demo_mode` and unapproved. No real-money collection or settlement is enabled, no partnership or authorization is claimed, and legacy unpaid order creation is blocked.

## Exact acceptance tests
1. Sign in, add one Cappuccino without surcharge, choose a valid slot and enter a name. Checkout must open Razorpay **Test Mode**, show **Qless** and **₹98 (9800 paise)**. No kitchen order should appear.
2. Complete a payment using Razorpay's documented test instrument and success outcome. Expect **Test payment captured and verified**, one paid test attempt, and no merchant preparation order. Refresh before confirmation and verify recovery.
3. Select the provider's test failure outcome. Expect failure (or pending until a signed failure arrives), no preparation order, and released slot capacity.
4. Close the checkout window. Expect **Checkout closed — confirmation pending**, not a success/failure claim. With no payment, wait 15 minutes; refresh/check payment and verify expiry and released capacity.
5. Deliver the same signed `payment.captured` webhook twice, including concurrently. Expect successful acknowledgements, one paid receipt, unchanged receipt identity and no duplicate preparation order.
6. Send a capture/failure request without a valid signature. Expect HTTP 401 and no payment state change. Validly signed malformed payloads must return 400.
7. Tamper with the browser callback payment ID/signature or provider order ID. Expect verification failure; no confirmed receipt. A mismatched amount or non-INR payment must not finalize.
8. Use a past/too-soon/unaligned/out-of-hours pickup slot, another café's item, invalid customization, or an out-of-stock item. Expect server rejection before opening Razorpay.
9. Fill a slot with unexpired attempts; another checkout must be rejected. After failure/expiry, the slot must become available again.
10. Sign out and try checkout/payment status/private dashboards; checkout must require sign-in and payment RPCs must reject unauthenticated access. Another customer must not read the first customer's attempt.
11. Deliver a failed event after capture; the paid receipt must remain paid. Deliver a delayed valid capture after expiry; record a paid test receipt without reclaiming a slot or creating a kitchen order.
12. Confirm menus, customer history, tracking, stock/status controls and staff/admin screens remain unchanged; test receipts must never appear as preparation orders.

## Checks performed
- Seven automated pricing, routing and signature/capture regression tests passed.
- Signed-in real cart/slot checkout opened Razorpay Test Mode with Qless and ₹98; no page errors.
- Unsigned webhook returned HTTP 401.
- Full provider success/failure, duplicate delivery and 15-minute expiry acceptance tests remain unverified; the provider contact step did not complete in the automated browser run.