# Operations and integrations

[Back to the illustrated guide](../README.md)

## Database and admin

Apply the existing `drizzle/` migrations in order. Migration 0017 preserves explicit zero-calorie totals in `daily_stats`; days without meals still have null calories. Gym check-ins/lifts do not affect nutrition totals.

Accounts use bcrypt hashes and signed HTTP-only cookies. Set a private random `AUTH_SECRET` of at least 32 characters. Admins use a separate login/cookie; regular accounts never grant admin access. No accounts are seeded.

```sh
node --env-file=.env scripts/create-admin.mjs
```

This saves credentials to `Downloads/roblox-site-admin-login.txt` without printing the password, and refuses to overwrite an existing credential file/account. Change passwords in `/admin`; doing so invalidates previous admin sessions. Admin sessions last 8 hours and login attempts are rate-limited in Postgres.

Admin tools manage ticker text, meals, gym posts/notes, comments, calorie/step/weight/height/lift logs and shop state. Destructive actions ask for confirmation; moderation actions are audited. Admin photo previews require authentication.

## Content and retention

Leaderboards, meal images, gym photos/blogs and comments are public. The repository contains none of the production database records. Photos have **no automatic expiry**. The legacy `/api/cron/purge` route returns 410; there is no purge cron.

Authors/admins can remove content. Removing a meal removes its calorie log, votes and comments. Removing a gym post removes attached lifts; the day's separate check-in remains unless explicitly removed from Recent logs/admin.

The gallery shows the latest 60 retained meals, the gym blog the latest 30 posts. Comments allow 240 characters and 30 posts per account per hour. Workout posts allow 20 lifts and 1,500 characters of notes, with a 6-post rolling daily cap. Photos are resized to JPEG in the browser.

## AI

Configure an OpenAI-compatible `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`, or `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`. Choose a vision-capable model for photos. Without a provider, manual calorie and step entry remain available.

Explicit calories, including **0**, skip estimation. Blank calories request AI. Step screenshots are read when AI is enabled and are not retained. Estimates are bounded before saving. Image requests and coach messages have per-user daily limits.

The coach receives the signed-in person's logs/goals and anonymous community averages, not other people's private chats. It is not medical advice. Stored coach messages can be cleared from its page.

## Web Push and reminders

Generate VAPID keys locally once:

```sh
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and a public contact `VAPID_SUBJECT` (`mailto:` or HTTPS). Reuse the pair across deployments; changing it requires devices to opt in again. Enable notifications and use **Send test** on each physical phone.

Activity categories, reminders and updates are controlled per device. Activity payloads omit health values, photos and notes; a person's own activity does not alert their devices. The service worker handles display/clicks and does not cache private pages.

Vercel schedules are UTC in `vercel.json`. Corresponding Singapore times:

| Reminder | Time | Eligible people |
| --- | --- | --- |
| Gym | 08:00 daily | No check-in today |
| Breakfast | 10:00 daily | No meal today |
| Lunch | 14:00 daily | Fewer than 2 meals today |
| Dinner | 20:00 daily | Fewer than 3 meals today |
| Steps | 21:00 daily | No step log today |
| Streak | 18:00 daily | Last check-in was 2 days ago; streak resets tomorrow |
| Weigh-in | 09:00 Monday | Has weighed in before, but not in the last 7 days |

Jobs may run within their scheduled hour. Set `CRON_SECRET` for authenticated Vercel calls. Reminder claims are deduplicated per user/kind/day. Delivery retries transient failures once and removes expired subscriptions; phone settings and push-provider delivery still apply.

The first cron after a production deployment announces it once. To announce immediately:

```sh
node --env-file=.env scripts/announce-update.mjs dpl_YOUR_DEPLOYMENT_ID
```

This sends real alerts to opted-in devices and shares a deployment deduplication record with cron.

## Ko-fi and shop credit

Set your own `KOFI_URL` and private `KOFI_VERIFICATION_TOKEN`. Save `https://YOUR_PUBLIC_DOMAIN/api/kofi` in Ko-fi's API webhook settings. That endpoint must be reachable without a Vercel login.

Customers send a **one-time SGD tip**, including their **LEAN-XXXXXX** account code in its message. Verified supported payments with matching codes credit the wallet once per transaction. Missing codes/other currencies enter the admin unmatched queue. Payer names, emails and messages are not published.

| Item | SGD price |
| --- | --- |
| Ticker message | S$0.10 |
| Another user's profile photo swap | S$0.30 |
| Meal photo swap | S$0.50 |
| Shared app name/icon makeover | S$2.00 |
| Huge revamp or troll request | **S$25**, discounted from S$50 |
| Crown / ownership request | S$100 |

The catalog is `src/lib/shop.ts`. Revamp/crown requests require manual fulfilment and never grant admin permissions. Voting, comments and your own profile photo are free. There is no prank shield. Original swapped photos are preserved for restoration.

Debits and instant effects share atomic SQL operations. Admin tools grant receipt-backed credit, match payments, fulfil/refund requests once and restore photos/branding. Refunds use each order's **saved price**, so discounts do not alter old refunds. Refunds restore **shop credit**; cash refunds are separate provider actions. The spending leaderboard counts purchases minus refunds, not top-ups.

Web makeovers update the header, metadata, manifest and notification branding. Existing installs may refresh later or need reinstalling. Packaged native icons/names are unchanged.

## Native companion and assets

Follow [native/README.md](../native/README.md) for builds, health permissions and sync behavior. Source is included; signed APK/TestFlight builds are not. Verify reads and permission revocation on physical iPhone/Android devices before distributing. The companion adds no native APNs/FCM push; Home Screen PWA Web Push is separate.

The icon master is `public/assets/lean-master.png`. Regenerate sizes with `node scripts/generate-app-icons.mjs`. Forks should update the hosted URLs before `npm run mobile:sync`.

`robots.txt` and `llms.txt` ask automated visitors to leave people's content alone. They are voluntary notices, not authentication or enforced access control.
