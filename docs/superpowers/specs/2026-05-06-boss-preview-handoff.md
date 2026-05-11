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

## Known visual nits (not blockers)

- Ligue 1 + FIFA World Cup 2026 competition cards show a generic placeholder where API-Football's CDN doesn't host their crest at the expected ID. Other 10 competitions render correctly.
- Favicon at 32×32 is wordmark-shaped; the "MFM Sport" text is technically present but not legible at that size. Apple-icon at 180×180 reads cleanly.

## To swap to production content after approval

1. Run `pnpm seed:preview:reset` (deletes all `demo-` prefixed docs)
2. Follow [WP_MIGRATION_HANDOFF.md](../../../WP_MIGRATION_HANDOFF.md) to import the first 200 real articles
3. After WP import: real `featuredImage` uploads land in Vercel Blob; the `featuredImageUrl` URL fallback simply stays empty (no migration of preview data needed)

## Branch state

- 16 commits on `feat/boss-preview-polish` (including 1 controller fix-up for a Task 1 test regression)
- All 51 unit tests pass
- Production build succeeds (`pnpm build`)
- Lint command has a pre-existing ESLint 9 / config-next compatibility issue (not introduced by this branch) — does not block deploy

## Push status

The branch is **not yet pushed to GitHub** — current local git credentials don't have push access to `newpublicity2024-cmyk/MFM-sport`. To push:

```bash
# Configure credentials for the right GitHub account, then:
git push -u origin feat/boss-preview-polish
```

After push, opening a PR will give a clean diff for code review beyond what the deployed URL shows.
