# Email verification redirects
- [x] Fix stalled checkout confirmation: Razorpay returned no payment for four recent attempts; signed-in actual pending attempt now shows unpaid state and Return to checkout. 13 payment tests passed; database remains pending/order-free.
- [x] Inspect hosted provider and canonical URL; published origin is already effective Site URL, both callback/reset destinations accepted; full allowlist editing unavailable through supported tools, documented in QLESS_EMAIL_REDIRECTS.md.
- [x] Add secure email callback and recovery completion without changing existing sign-in screens or roles; forward legacy Site URL email returns.
- [x] Test 12 callback/phone/staff rules and published availability; updated local return pages work, published callback/reset/staff pages return 404.
- [ ] Complete fresh signup/invitation/reset inbox flows — blocked: publish updated app and open fresh provider emails; complete allowlist audit requires managed website settings not exposed by agent tools.

# Academic demonstration completion
- [x] Add partner entry points and secure staff/admin access; remove public first-admin claiming and staff signup.
- [x] Implement atomic captured-test-payment → labelled demo order and tracking; preserve demo/unapproved flags and live-key rejection.
- [x] Run 22 regression tests; verify real signed-in customer denial, menu/cart/slots and Razorpay Test Mode opening. Recheck grants/RLS and document blockers in QLESS_DEMO_READINESS.md.
- [ ] Verify captured payment → persisted demo order → assigned staff transitions → tracking and duplicate/expiry provider tests — blocked: Razorpay requires an accepted sandbox contact; no captured payments or assigned staff exist.
- [ ] Provision requested initial administrator and assigned demonstration staff — blocked: owner must create/confirm the designated email in secure Users → Add user; no separate staff email supplied. Verified-email bootstrap implemented but not exercised.

# Customer email and Google sign-in
- [x] Enable email/password, Google and Lovable providers; give customer /auth email sign-in and sign-up with a confirmation state, forgot-password link and provider buttons, keeping mobile OTP as a third method.
- [x] Verify in a real browser: invalid input, wrong credentials, new-account confirmation state, password sign-in reaching My orders, session held across reload, provider-return callback landing a signed-in customer, Google handing off to the sign-in broker; 21 regression checks passed and the build is clean.
- [ ] Verify Google account selection and inbox confirmation-link completion on the published site — blocked: needs a real Google account interaction and a fresh inbox click, and the updated app must be published first.

# Customer mobile sign-in
- [x] Add Indian phone / six-digit OTP interface with resend/error states and native Auth calls (no local OTP fallback).
- [x] Preserve staff email sign-in and add owner-only customer profiles; both existing Auth IDs have profiles, no IDs or order owners changed.
- [x] Verify validation, mobile layout and staff screen; 13 regression checks passed and current build is clean. Document setup and transition in PHONE_AUTH_SETUP.md.
- [ ] Verify real OTP delivery, verification, persistent phone session and hosted request/verification throttling — blocked: hosted Phone sign-in is disabled and SMS provider/test recipient setup is required.
- [ ] Verify existing email customer's phone transition retains the same ID/history — blocked: administrator identity-proofing and supported verified linking workflow must be completed before that customer's phone signup.

# Homepage redesign
- [x] Update homepage presentation only, preserving discovery queries, routes, filters and demo state.
- [x] Verify mobile/desktop presentation, search, categories and restaurant navigation.

# Razorpay test checkout
- [x] Add atomic payment finalization, server signature/capture verification, and safe expiry.
- [x] Connect checkout callbacks and recover pending payments without changing layout.
- [x] Request test credentials and report webhook setup and payment test checklist.
- [x] Run payment regression tests and verify signed-in checkout opens Razorpay Test Mode and unsigned webhooks are rejected.
- [ ] Complete provider success/failure, duplicate delivery and 15-minute expiry acceptance tests — published webhook now rejects unsigned requests with HTTP 401; nine regression tests passed and signed-in ₹98 checkout opened Razorpay Test Mode. Provider payment completion and signed delivery remain unverified; five pending test attempts have no captured receipt and no preparation orders exist.