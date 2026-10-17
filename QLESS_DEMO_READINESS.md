# Qless academic demonstration readiness

## Where to open
- Current preview: https://id-preview--948c9f6a-55a2-48ae-814f-7ca3371e3836.lovable.app
- Existing published site: https://pixel-perfect-pixie-640.lovable.app
- This turn did not publish. Publish the current changes before demonstrating the updated version at the published address.

## Customer demonstration steps
1. Open the homepage and select Dohful Cookies & Coffee.
2. Select products/options, add them to the cart and open checkout.
3. Sign in using a genuinely verified existing customer session. New phone sign-in requires the existing hosted Phone configuration; no fixed OTP or fake session exists.
4. Choose an available pickup slot today, within the provisional 08:00–21:30 IST demo hours, and enter a name.
5. Select Test pay. Confirm Razorpay displays Test Mode; never use live keys or real card/bank credentials.
6. Complete Razorpay's sandbox payment with a contact accepted by the provider. The automated placeholder number was rejected; completion is not verified.
7. Only provider-confirmed capture for the stored order ID and exact INR paise amount can create a labelled demo order. Select Track demo order and refresh to check persistence.
8. Assigned staff simulate Confirmed → Preparing → Ready → Collected. Tracking polls every eight seconds. No actual products, settlement or official Dohful partnership are implied.

If the payment is pending, failed or cancelled, do not claim it was paid. Closing Checkout leaves confirmation pending; pending reservations expire after 15 minutes. Capture after reservation expiry or after pickup only produces a test receipt, not demo fulfillment. Missing/non-test keys block checkout rather than fabricate paid orders; existing keys are configured, so no local simulation was introduced.

## Secure administrator and partner access
1. Open Lovable Cloud → More → Users → Add user. Securely create or invite **sattyam.khandelwal2028@mastersunion.org**. Never send a password in chat.
2. The owner-designated email must be verified. A serialized Auth lifecycle trigger grants the first administrator role only to that email; changing another account's email is not a bootstrap path. This account does not exist yet and this provisioning trigger remains UNVERIFIED until creation/confirmation.
3. Sign in at `/staff/login?redirect=/admin`, then open `/admin` to manage restaurants, prices, menus, availability and assignments.
4. Create the demonstration staff account in the same secure Users screen. No staff email was provided and no account/password was invented.
5. In `/admin` → Merchants, assign the staff email to Dohful Cyber Park.
6. Staff open `/partner/login`; it reuses the staff login. `/partner/dashboard` verifies access and redirects to the existing `/merchant` dashboard without rebuilding it.
7. Customer accounts without assignments are rejected by server-verified staff checks. Data access remains enforced by owner/member RLS and member-only status/stock/pause RPCs.

## Checked in this turn
- Signed-out administrator navigation redirected to customer auth via the existing managed auth gate.
- `/partner/login` reached the secure staff sign-in page; public staff signup and public first-admin claiming were removed.
- A real existing signed-in customer without membership was denied merchant access and redirected to staff sign-in.
- Dohful menu → Cappuccino → cart → checkout worked with the real existing session; available slots and ₹98 appeared.
- Razorpay Standard Checkout opened in Test Mode with Qless branding and the ₹98 provider order.
- RLS is enabled for orders, items, payment attempts, memberships, roles and profiles.
- Authenticated first-admin claim execution is denied; direct order/payment/role/membership writes were explicitly revoked.
- Automated tests cover number/OTP validation, role access, test-only credentials, signature integrity, capture status, stored-order/amount checks and the provider-confirmed finalizer boundary.
- Latest recorded preview build was clean at the time of the report; no manual build was run.

## UNVERIFIED / incomplete for tomorrow
- Administrator creation/confirmation and designated-email trigger execution; staff provisioning and real assigned-staff dashboard access.
- Actual SMS delivery, successful OTP verification and hosted throttling: the prior hosted settings read showed Phone disabled; no new SMS service was added. This turn did not reconfigure or establish that Phone delivery is enabled.
- Razorpay payment completion: provider rejected a dummy contact number. Use your provider-approved sandbox recipient/contact; no real bank credentials.
- Captured test payment → persisted demo order → merchant transitions → customer tracking end-to-end, duplicate capture delivery, real provider failure and timed expiry. These are implemented but not established by mocked tests or interface visibility.
- Existing customer's verified phone linking to the original user ID remains an administrator-assisted manual task.
- Dohful authorization, closing time, menu prices and substitutions remain provisional. Demo mode and unapproved pilot flags are unchanged.

## Razorpay secure settings
Keep `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in secure project configuration only. The published webhook is:

`https://pixel-perfect-pixie-640.lovable.app/api/public/razorpay-webhook`

Use Test Mode events `payment.captured` and `payment.failed`, matching the stored webhook secret. Publish the current app before testing this updated behavior. Existing expiry callback authentication is preserved.