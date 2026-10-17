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
- Guest orders go only through the `placeOrder` server function, which calls the `place_order` SQL function with the admin client; anon/authenticated cannot execute it. Why: prices, slots, hours and rate limits must be enforced server-side atomically.
- Guests read orders only via `get_order_by_token` (48-hex token); the pickup code never grants access. Why: private tracking links.
- Merchant writes (status, stock, pause) go through SECURITY DEFINER RPCs that check `is_cafe_member`; orders tables have no direct write grants. Why: staff must not edit totals or other cafés' data.
- Money is stored as integer paise; times are timestamptz, displayed in Asia/Kolkata.
