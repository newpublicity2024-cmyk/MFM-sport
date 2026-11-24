# Web push notifications (OneSignal)

One notification per editorial article, sent when the article is published for
the first time. Readers subscribe through an Arabic prompt on the site.

## The OneSignal app

| | |
|---|---|
| App | `mfmsport.ma` — `a32a8dec-858d-40eb-98d2-b6e447b78a34` |
| Created | 2 June 2019, by the WordPress OneSignal plugin |
| Origin | `https://www.mfmsport.ma` |
| Reachable subscribers (24 Nov 2026) | 1,364 of 40,483 ever recorded |
| Dashboard integration type | still `wordpress` — the SDK honours options set in code for it, exactly as for "Custom Code" |

The same OneSignal organization also holds Attahadi, challenge.ma and MFM Radio.
Nothing here touches them.

## How a notification is sent

`Articles.afterChange` → `src/lib/push/notifyArticlePublished.ts`.

It sends only when **all** of these hold (`decideArticlePush`,
`src/lib/push/articleNotification.ts`):

1. the article is `published` and was not already published (first publish, or created as published);
2. `seoTier` is exactly `editorial` — archive imports never notify;
3. the save is not a bulk script (`context.disableRevalidate` / `context.disablePush`);
4. `VERCEL_ENV === "production"` — previews and local dev share the production database;
5. `ONESIGNAL_APP_API_KEY` is set;
6. `publishedAt` is less than 12 hours old.

Even then, OneSignal itself drops a second send for the same article for 30 days:
every request carries an idempotency key derived from the article id (UUID v5).
Unpublish → republish therefore does not notify twice.

The send runs in `after()`: once the editor's save has committed and the
response has gone out. It is bounded (5 s per attempt, one retry) and cannot
fail the save — at worst it writes `[push] article notification failed` to the
logs.

**Content:** title = article title; text = excerpt, or the opening of the body
(editors do not fill the excerpt); large image = the featured image (1200×630);
icon = `/apple-icon.png`; link = `https://www.mfmsport.ma/ar/articles/<slug>`.
Undelivered notifications expire after 24 h.

At the current publishing rate that is roughly **6–15 notifications a day**.

## How readers subscribe

`<OneSignalLoader>` in `[locale]/(site)/layout.tsx` (so never on a 404 or in the
admin). On `https://www.mfmsport.ma` only, after the page has loaded, it fetches
the OneSignal SDK and, **3 seconds after the SDK is ready** (`PROMPT_DELAY_MS`),
shows a slidedown:

> فعّل الإشعارات لتصلك أهم أخبار الرياضة فور نشرها. يمكنك إيقافها متى شئت.
> [اشترك] [لاحقًا]

**When it is shown** (owner's request, 24 Nov 2026: "whenever a user connects"):
on **every visit** until the reader decides in the browser — once per tab
session, not on every page. A reader who tapped «لاحقًا» is asked again on
their next visit (`promptPush({ force: true })` skips OneSignal's days-long
back-off). Never shown to a reader whose browser permission is already
`granted` (subscribed) or `denied` (blocked), nor where web push is unsupported.

The browser's own permission dialog appears only after «اشترك», so Chrome's
accept-rate heuristics (which can silence a site's prompts) see only readers who
already said yes. New subscribers get an Arabic welcome notification.

To make it less insistent, change the `sessionStorage` marker in
`src/lib/push/webSdk.ts` to a `localStorage` timestamp (e.g. once a day).

The worker is `public/OneSignalSDKWorker.js` at scope `/`: **the same scope the
WordPress plugin registered** (archived homepage, March 2025). A returning
WordPress-era subscriber's registration is updated in place rather than
duplicated, so they do not receive every article twice. Do not move the worker
or change its scope.

iPhone/iPad: Safari only delivers web push to sites added to the home screen
(a web app manifest). The site has no manifest today, so iOS readers cannot
subscribe from Safari.

## Configuration

| Variable | Where | Notes |
|---|---|---|
| `ONESIGNAL_APP_API_KEY` | Vercel (`newpublicitys-projects/mfm-sport`) → **Production only**, type Secret | App API key, `os_v2_app_…`. OneSignal → Settings → Keys & IDs: key `mfmsport-web-push (Vercel Production)`, `token_id e9a6b4c9-9689-4de7-a5e5-ea246b0d40da` (24 Nov 2026). Without it the site still collects subscribers but sends nothing. Env changes reach only new deployments — redeploy after setting it. |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | optional | Defaults to the app above (`src/lib/push/webSdk.ts`). |

Never put the **Organization** key (`os_v2_org_…`) in Vercel or the repo: it can
create apps and keys across the whole organization.

**To stop sending:** remove `ONESIGNAL_APP_API_KEY` from Vercel Production and
redeploy. **To stop asking readers:** remove `<OneSignalLoader>` from the layout.

## Verifying

```bash
pnpm exec tsx scripts/verify-push.ts decide|payload|hook|sender|loader|no-secret|static|suite
pnpm exec tsx scripts/verify-push.ts live                      # key + segment + payload accepted; sends to nobody
pnpm exec tsx scripts/verify-push.ts vercel-env                # key is Production-only, a Secret; no org key
pnpm exec tsx scripts/verify-push.ts served https://www.mfmsport.ma
# a preview is behind Vercel Authentication — wrap served/prompt in:
vercel env run --scope newpublicitys-projects --project mfm-sport -- pnpm exec tsx scripts/verify-push.ts served <preview-url>
pnpm exec tsx scripts/verify-push.ts prompt https://www.mfmsport.ma --no-route
pnpm exec tsx scripts/verify-push.ts prod-sent --since <deploy instant>   # one push per article published since
```

Runtime logs: search Vercel logs for `[push]`. A publish that did not notify
logs its reason (`not-production`, `not-configured`, `stale`, …).
