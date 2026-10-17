# Qless — Order Ahead. Skip the Queue.

Qless is a mobile-first food and beverage pre-ordering application designed for corporate office areas. Customers can discover restaurants, browse menus, choose a pickup time and track their order. Restaurant partners can manage fulfillment through a dedicated dashboard.

## Project status

Academic MVP / demonstration in progress. **Do not assume that live payments, merchant authorization, real SMS OTP delivery or full end-to-end testing are complete.** Verify the deployed functionality before using it for real customer orders.

The Dohful Cookies & Coffee Cyber Park storefront is a demonstration based on publicly researched information; it does not imply a commercial partnership.

## Links

- Lovable-hosted application: https://pixel-perfect-pixie-640.lovable.app
- Lovable project editor: https://lovable.dev/projects/948c9f6a-55a2-48ae-814f-7ca3371e3836
- GitHub repository: https://github.com/BAD-Sattyam/pixel-perfect-pixie-640
- Custom production domain: **Not yet verified**

## Intended core user journey

1. Discover the demo café and browse its menu.
2. Add an item to the cart and select a pickup slot.
3. Use the labelled test/sandbox checkout (no live payment should be required for the first submission).
4. View the order confirmation and tracking page.
5. Using an authorized partner demonstration account, view the order and progress its status through accepted, preparing, ready for pickup and collected.

**Verification note:** The above is the intended test journey, not a claim that every step has passed independent end-to-end testing. Describe only confirmed-working steps in the Shipped.money submission.

## Technical stack

Lovable-generated application using React, TypeScript, Tailwind CSS, TanStack and Supabase-compatible services. Refer to `package.json` for the authoritative dependency list.

## Run locally

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run build
npm run lint
npm test
```

The deployment may require environment variables for its connected backend. Configure those in hosting settings; do not commit secret API keys or server-side payment credentials.

## Ship It — Submission 1 checklist

- [ ] Publicly accessible working demo tested in an incognito browser
- [x] Product code synced to GitHub
- [ ] Custom HTTPS domain (default lovable.app domain is not eligible)
- [ ] Shipped.money repository connection and owner-created read-only GitHub key
- [ ] One verified core task and expected result written in submission notes
- [ ] Save submission receipt ID and check connection statuses

Submission portal: https://shipped.money/submit

Submission 2 (separate): Microsoft Clarity, Google Search Console and supported live payment-provider connection.

## Safety and operations

Use Razorpay test credentials during development; never commit or disclose live API secrets. The previously exposed live Razorpay secret must be rotated before any live integration. Real restaurant orders should not be accepted until the merchant authorizes the pilot, payments and settlement are configured, and security checks pass.

Built with [Lovable](https://lovable.dev).
