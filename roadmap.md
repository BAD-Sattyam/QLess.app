# Homepage redesign
- [x] Update homepage presentation only, preserving discovery queries, routes, filters and demo state.
- [x] Verify mobile/desktop presentation, search, categories and restaurant navigation.

# Razorpay test checkout
- [x] Add atomic payment finalization, server signature/capture verification, and safe expiry.
- [x] Connect checkout callbacks and recover pending payments without changing layout.
- [x] Request test credentials and report webhook setup and payment test checklist.
- [x] Run payment regression tests and verify signed-in checkout opens Razorpay Test Mode and unsigned webhooks are rejected.
- [ ] Complete provider success/failure, duplicate delivery and 15-minute expiry acceptance tests — published webhook now rejects unsigned requests with HTTP 401; nine regression tests passed and signed-in ₹98 checkout opened Razorpay Test Mode. Provider payment completion and signed delivery remain unverified; five pending test attempts have no captured receipt and no preparation orders exist.