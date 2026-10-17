# Qless email verification redirects

## Inspected
- Canonical published website: https://pixel-perfect-pixie-640.lovable.app
- Existing provider: Lovable Cloud native authentication. Email/password enabled, email confirmation enabled, signup enabled, anonymous signup disabled. Phone disabled. No provider or role system changed.
- A deliberately invalid verification link with no redirect returned to the published website, establishing that the provider's effective Site URL is already the published origin.
- Explicit published `/auth/callback` and `/reset-password` destinations were accepted. An unrelated external destination was rejected and fell back to Site URL.
- These probes establish effective redirect behavior, not the complete hosted allowlist. Available managed configuration tools do not expose a Site URL/allowlist setter or a full settings read; no unverified configuration change is claimed.

## Return destinations
- Site URL: `https://pixel-perfect-pixie-640.lovable.app`
- Signup verification / staff invitation: `https://pixel-perfect-pixie-640.lovable.app/auth/callback`
- Password reset: `https://pixel-perfect-pixie-640.lovable.app/reset-password`
- When an invitation is created through managed tools, use the callback destination if a redirect field is offered. Default links landing on Site URL are also forwarded by the homepage.
- No public staff signup was added. Invited accounts receive a password-completion form but dashboard access still requires protected administrator roles or café memberships.
- Customers return to `/`, assigned staff to `/merchant`, administrators to `/admin`. URL parameters and email addresses cannot grant roles.
- Callback handles provider code exchange, token-hash verification, or the generated client's implicit token flow, revalidates identity, and removes credentials from browser history. Recovery remains subject to native Auth checks; ordinary sessions cannot bypass provider current-password requirements by changing browser storage.

## Manual completion
1. Publish/update the app. At inspection time the published callback, password reset and staff sign-in URLs all returned Qless's 404 page. The updated local pages work; they are not live until publication.
2. In Lovable Cloud → More → Users → Auth settings, inspect any available website/redirect settings. Keep Site URL as the published origin and permitted email returns on the published website. Do not use editor/preview destinations for newly issued verification, invitation or recovery emails. If website/allowlist controls are not exposed, request the managed setting adjustment through Lovable support; no supported agent setter is available in this session.
3. Existing emails cannot be rewritten. Request fresh verification/reset emails or issue a fresh staff invitation after publishing, rather than reuse an email containing an old preview destination.
4. Use a test account's inbox: verify signup, open an invitation and set its password, request and complete a reset, refresh to confirm session persistence, and confirm assigned staff/administrator routing. Keep original Auth IDs and assignments unchanged.
5. Test an expired/reused email, unrelated external redirect, and an unassigned customer attempting a staff dashboard. No external destination or customer privilege escalation should succeed.

## Verification limits
- 12 redirect/phone/staff regression tests passed.
- Browser checked updated callback rejection/error handling and removal of query credentials, reset request page, and unchanged staff login. No page errors occurred.
- Published pages were inspected and remain unavailable pending publication.
- Actual inbox-link completion, password update and post-verification authorized dashboard navigation remain unverified: no fresh email credential was supplied and the updated pages are not published. No account password or role was changed for testing.