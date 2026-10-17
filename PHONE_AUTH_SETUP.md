# Qless customer SMS sign-in

## Required hosted setup

Customer `/auth` now uses Cloud Auth `signInWithOtp` and `verifyOtp` with Indian +91 numbers. Staff email/password sign-in remains at `/staff/login`; email auth stays enabled. Public signup remains enabled and anonymous signup stays disabled. Successful phone verification uses the existing persisted Auth session and owner-scoped order access. Sending a code is not treated as a signed-in session.

Open **More → Users → Auth settings → Phone settings**:

1. Enable Phone sign-in and configure a supported SMS provider such as **Twilio** or **Twilio Verify**. Provider account credentials must be entered only in this secure settings screen, never in chat, the browser application or source code. A workspace Twilio connector does not configure the Auth SMS sender.
2. Set the SMS code length to **6 digits**. Review expiry and minimum resend interval; use a minimum **60-second** interval. The SMS template must use `{{ .Code }}`, not `{{variable_1}}`.
3. Review hosted Auth SMS send and verification limits. Native Auth throttles requests and verification and returns HTTP 429; the interface handles that error. Its 60-second resend timer is not a security boundary. Exact hosted quotas/settings have not been read or changed by this implementation. If these limits are not exposed in your settings, ask Lovable support to confirm their configuration before production use; do not replace them with a browser-only attempt counter.
4. For India, complete the provider's required registration/routing setup. TRAI DLT requirements can include Principal Entity registration, sender header and approved OTP template. Confirm the provider's India delivery route and template IDs. Enable SMS Pumping Protection and restrict Geo Permissions to intended countries.
5. Publish after configuration and test a verified recipient permitted by your provider account. The provider bills SMS usage separately.

References: https://docs.lovable.dev/features/phone-auth ; https://supabase.com/docs/guides/auth/phone-login ; https://supabase.com/docs/guides/auth/rate-limits ; https://www.twilio.com/en-us/guidelines/in/sms ; https://www.trai.gov.in/advice-to-senders

## Test mode

No mock OTP, fixed fallback code, or fabricated session exists. Twilio test credentials simulate SMS API results but do not deliver a real verification SMS. A test/trial provider may restrict recipients. If using Auth/provider-supported test numbers, configure them in the hosted provider settings, label that environment **SMS TEST MODE**, keep it private and remove that setup before production. This implementation does not configure or expose test codes and does not claim test-mode verification is available. Until the provider is configured, users see an honest SMS-unavailable error, not a simulated success.

## Existing accounts: admin-assisted transition

No accounts, order owners, or existing IDs are removed or rewritten. Existing email users must contact an administrator before using phone signup. The customer screen offers this warning and disables signup while it is open. The app cannot infer an email account from an unlinked phone number.

An administrator must independently verify both the existing account identity and control of the requested phone number, ensure the number is not assigned to another Auth account, and link the phone on the **existing Auth user ID** through a privileged managed Auth process. Do not create a new user, copy orders, auto-confirm an unverified phone, or choose users by display name. This task does not add an admin identity-proofing console or modify staff permissions. If the hosted Users screen lacks verified phone linking, obtain a supported secure linking workflow from Lovable support before transitioning existing customers. Existing email accounts remain accessible through email auth; customer email/password UI is no longer advertised.

## Profiles

The new owner-only profile contains optional `display_name` (maximum 100 characters). Existing users have a blank profile without overwriting account data. Auth's signup trigger creates profiles on the same user ID. Roles are not profile fields. An optional name collected before OTP is saved only after provider verification; profile-write failure does not discard the verified Auth session.

## Acceptance checks

- Reject a number starting with 0–5, fewer/more than 10 digits; normalize valid numbers to +91.
- Accept only six numeric verification digits; never accept any local fixed OTP.
- New permitted recipient: send SMS, verify, read `/orders`, refresh and confirm same Auth ID/session.
- Existing linked customer: verify phone and confirm original orders remain accessible under the original ID.
- Existing unlinked email customer: use admin-assisted transition first, never signup a duplicate.
- Wrong/expired code: remain signed out and show error; resend only after countdown.
- Bypass the UI timer and repeatedly call the native Auth request/verification endpoints in a controlled private test: confirm hosted HTTP 429 limits. SMS costs may apply.
- Provider unavailable/network failure: no signed-in session or invented verification step.
- Sign out: cancel requests, clear protected cache, replace navigation; Back must not reveal protected orders.
- Customer A cannot read customer B's profiles/orders; customers cannot assign roles.
- Staff email sign-in and merchant/admin authorization continue unchanged.

Actual delivery, valid/invalid provider OTP verification, hosted throttling quotas and admin-assisted linking require completed provider setup and an approved test recipient; they are not verified merely by the interface or unit tests.