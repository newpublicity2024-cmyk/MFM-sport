# Boss Preview — Handoff

**Preview URL:** https://mfm-sport.vercel.app
**Direct deploy URL:** https://mfm-sport-mk268ynhu-newpublicitys-projects.vercel.app
**Branch:** `feat/boss-preview-polish`
**Built from commit:** `68e6d0d`
**Date:** 2026-05-06

## What's in this preview

- Real SVG logo + inline social SVGs (Facebook, Instagram, X, YouTube glyphs) in the footer
- 18 demo articles with themed featured photos (royalty-free Pexels football imagery)
- 4 Moroccan clubs (Wydad AC, Raja CA, FAR Rabat, RS Berkane) with API-Football crests
- 12 competitions (Botola Pro 1, CAF CL, CAF CC, AFCON, FIFA WC 2026, Premier League, La Liga, Bundesliga, Serie A, Ligue 1, UEFA CL, UEFA EL) with logos
- Live match data via API-Football (today's fixtures, live polling, date strip, league filter)
- AR / FR / EN locales with full RTL on Arabic
- Category names localized in all 3 locales
- About / Contact / Legal / Privacy with real Arabic copy
- Newsletter signup form (functional via Resend if `RESEND_API_KEY` is set in Vercel env)
- Favicon, apple-touch-icon, default OG image
- Dark theme with Moroccan red brand accent (`#D92332`)

## Suggested boss-walkthrough order

1. https://mfm-sport.vercel.app/ar (RTL, primary surface)
2. https://mfm-sport.vercel.app/ar/articles/demo-botola-matchday-review (article detail)
3. https://mfm-sport.vercel.app/ar/club/wydad-ac (club hub with crest + news)
4. https://mfm-sport.vercel.app/ar/competition (12 competition crests)
5. https://mfm-sport.vercel.app/ar/matches (today's fixtures, date strip)
6. https://mfm-sport.vercel.app/fr (French homepage)
7. https://mfm-sport.vercel.app/en (English homepage)

## What's NOT in this preview (intentional, per project plan)

- WordPress migration content (deferred to post-approval — see [WP_MIGRATION_HANDOFF.md](../../../WP_MIGRATION_HANDOFF.md))
- French / English translations of static About/Contact/Legal/Privacy pages (Arabic primary)
- Real ad slots (`NEXT_PUBLIC_ADSENSE_CLIENT_ID` intentionally unset — awaiting AdSense approval)
- Full club hubs with squads / player profiles (Phase 2 per `PROJECT_MEMORY.md` §10)
- Live event timeline beyond the current scoreboard polling (already shipped on prior `feat/live-sports-surface`)

## Round 2 polish (2026-05-11)

Plan: [docs/superpowers/plans/2026-05-11-site-complete-polish.md](../plans/2026-05-11-site-complete-polish.md)

- ESLint 9 flat config repaired (`pnpm lint` now runs)
- FR + EN bodies seeded for About / Contact / Legal / Privacy — all three locale variants now render real copy
- Localized 404 page added for `/ar`, `/fr`, `/en` — unknown routes hit a polished, RTL-aware page instead of Next's default (verified at `/ar/this-route-does-not-exist`, etc.)
- Glyph-only favicon (32×32) replaces the unreadable scaled wordmark
- Ligue 1 + FIFA WC 2026 crests verified rendering correctly on current seed (handoff note about placeholders was stale — both render fine)

**Built from commit:** `2c7e6b8`
**Preview URL:** Push pending — auto-deploy will trigger once main is pushed to origin
**Push status:** failed: `Permission to newpublicity2024-cmyk/MFM-sport.git denied to Ben776ya` (HTTP 403) — same credentials issue noted below; user must configure correct GitHub account and push manually

## To swap to production content after approval

1. Run `pnpm seed:preview:reset` (deletes all `demo-` prefixed docs)
2. Follow [WP_MIGRATION_HANDOFF.md](../../../WP_MIGRATION_HANDOFF.md) to import the first 200 real articles
3. After WP import: real `featuredImage` uploads land in Vercel Blob; the `featuredImageUrl` URL fallback simply stays empty (no migration of preview data needed)

## Branch state (post Round 2)

- `feat/boss-preview-polish` merged into local `main` via merge commit `2c7e6b8`
- All 51 unit tests pass
- Production build succeeds (`pnpm build`)
- `pnpm lint` runs to completion (ESLint 9 flat config repaired in Round 2). One pre-existing hard error remains in `src/components/ads/StickyMobileAd.tsx` from the earlier ad-banners branch; out of scope for this milestone.

## Push status

Local `main` is ahead of `origin/main` by the merge commit + the Round 2 handoff commit. The remote push fails with HTTP 403 because the current git credentials authenticate as `Ben776ya`, which lacks write access to `newpublicity2024-cmyk/MFM-sport`. To push:

```bash
# Configure credentials for the right GitHub account, then:
git push origin main
```

Vercel will auto-deploy from `main` after push, refreshing the `https://mfm-sport.vercel.app` alias within a few minutes.
