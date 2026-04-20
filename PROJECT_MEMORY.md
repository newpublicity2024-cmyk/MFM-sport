# MFM Sport — Rebuild Project Memory

> **Living document.** This is the single source of truth for the project. It is updated as decisions are made, features are built, and the vision evolves. Sections below with `🔄` are expected to change often.

---

## 0. Quick Reference

| Field | Value |
|---|---|
| Source site | https://mfmsport.ma/ |
| Language | Arabic (RTL) — primary |
| Current stack | WordPress (detected via `/wp-content/uploads/` paths, shortcodes, gravatar author images) |
| Content scale | ~2,055 pages of articles × ~21 per page ≈ **~43,000 articles** |
| Domain focus | Moroccan football (primary) + African + European coverage |
| Target framework | **Next.js** (decided 2026-04-20) |
| Hosting | **Vercel** (decided 2026-04-20) |
| CMS | **Payload 3.0** (self-hosted, installed into Next.js app, Neon Postgres on Vercel, Vercel Blob for media) — decided 2026-04-20 |
| Football data source | **API-Football (near-live tier)** — decided 2026-04-20 |
| Languages | **Arabic + French + English** (decided 2026-04-20) |
| Content migration | **Yes — full migration of ~43K articles** |
| Team | User + 5-6 people (journalists, presenters, hosts) |
| Deadline | **~50 days (before FIFA World Cup 2026, 11 June 2026)** |
| Scope | Football only (for now) |
| Monetization | Light ad placements |
| Design inspiration | beIN Sports, ESPN (Korean/Arabic) — to detail later |

---

## 1. Executive Summary of Current Site

MFM Sport is an Arabic-language Moroccan football news portal. It behaves like a classic WordPress news/magazine site with a few custom football-specific widgets layered on top (standings, match program). The information architecture is clean but the visual design is dated, the "Teams" section is broken (points to `/under-construction`), and the site leans heavily on editorial content with minimal real data tooling (no live scores, no player profiles, no statistics dashboards). There is a clear opportunity to rebuild it as a modern, data-rich sports platform closer to beIN Sports / ESPN in ambition while preserving the Arabic/RTL editorial identity that is its core strength.

---

## 2. Site Map & URL Structure

```
/                                          → Homepage (featured grid + latest + team blocks)
/articles/                                 → Paginated news feed (2,055 pages)
/articles/page/{n}/                        → Pagination
/tournaments/                              → League standings (shortcode-driven)
/matchs/                                   → Full match program (shortcode-driven)
/under-construction                        → "Teams" menu item currently leads here (broken)

/category/{parent}/{child}/                → Category archive pages
  ├─ /category/el-botola/                  → Moroccan Botola (umbrella)
  │   └─ /category/el-botola/botola-pro-1/ → Botola Inwi 1 (top flight)
  ├─ /category/continental/
  │   ├─ /nations/world-cup/               → World Cup
  │   ├─ /nations/africa-cup-of-nations/   → AFCON
  │   ├─ /equipes/coupe-de-la-confederation/       → CAF Confederation Cup
  │   ├─ /equipes/ligue-des-champions-de-la-caf/   → CAF Champions League
  │   └─ /equipes/uefa-champions-league/   → UEFA Champions League
  └─ /category/europe/
      ├─ /laliga-santander/                → La Liga
      └─ /bundesliga/                      → Bundesliga
      (likely also Premier League, Serie A, Ligue 1 — to verify)

/club/{slug}/                              → Club-specific news archive
  ├─ /club/wydad-athletic-club/            → Wydad AC (217 pages of news)
  ├─ /club/raja-club-athletic/             → Raja CA
  ├─ /club/armee/                          → FAR / Jaish
  └─ /club/alahli/                         → Al Ahly

/tag/{slug}/                               → Tag archives (e.g., /tag/maroc/)
/{article-slug}/                           → Individual article (slug is URL-encoded Arabic)
/إشعار-قانوني/                            → Legal notice
```

**Navigation (top menu, only 4 items):**
1. أخبار (News) → `/articles/`
2. مسابقات (Competitions) → `/tournaments/`
3. مباريات (Matches) → `/matchs/`
4. فرق (Teams) → `/under-construction` *(broken)*

---

## 3. Data Model (Inferred)

### 3.1 Article
| Field | Example / Notes |
|---|---|
| `id` / slug | Arabic slug, URL-encoded |
| `title` | Arabic headline |
| `featured_image` | `/wp-content/uploads/YYYY/MM/*.jpg`, typical size 778×460 |
| `category` | One primary category (shown as badge above title) |
| `tags[]` | Multiple free-form tags (e.g., أولمبيك أسفي, المغرب) |
| `body` | Arabic HTML body, includes inline "related article" cards mid-text |
| `published_at` | Display format: "19 أبريل 2026" + separate time "20:34" |
| `author` | Name + Gravatar-based avatar (e.g., "عبد الإله الدهوي") |
| `view_count` | Small integer shown on page (e.g., "25") |
| `related_articles[]` | Sidebar "أخبار ذات صلة" — appears to be same-category recent |

### 3.2 Category (hierarchical, 2 levels)
```
el-botola
  └─ botola-pro-1
continental
  ├─ nations
  │   ├─ world-cup
  │   └─ africa-cup-of-nations
  └─ equipes
      ├─ coupe-de-la-confederation
      ├─ ligue-des-champions-de-la-caf
      └─ uefa-champions-league
europe
  ├─ laliga-santander
  └─ bundesliga
```

### 3.3 Club
| Field | Example |
|---|---|
| `slug` | `wydad-athletic-club` |
| `name_ar` | الوداد الرياضي |
| `logo` | `/wp-content/uploads/2021/02/wydad-athletic-club.png` |
| `articles[]` | Reverse-chronological feed (paginated, ~217 pages for top clubs) |

### 3.4 Match (served via shortcode, not a visible public model yet)
Likely fields based on the match program context: home team, away team, competition, round/week, kickoff datetime, venue, status (scheduled/live/finished), score, broadcaster.

### 3.5 Standings row (shortcode)
Standard league table: position, team, P, W, D, L, GF, GA, GD, Pts.

### 3.6 Tag
Free-form taxonomy, flat, Arabic + some French/English slugs (`maroc`, etc.).

### 3.7 Author
| Field | Notes |
|---|---|
| `name` | Display name in Arabic |
| `avatar` | Gravatar URL |
| *(likely `bio`, `role`, article archive — not confirmed)* |

---

## 4. Page-by-Page Analysis

### 4.1 Homepage (`/`)
**Purpose:** News aggregator + league table shortcut.
**Sections (top → bottom):**
1. Header: logo + 4-item nav
2. **Matches program widget** (shortcode `mfm_sport_football_matches_program`) — currently not rendering in the scraped HTML (likely JS-hydrated)
3. **Featured grid** — ~9 recent articles, each card: category badge + headline (image hidden in text-scrape but visually likely present)
4. **"أهم الأخبار" (Top News)** section — repeated grid, larger cards with title + summary excerpt + category
5. **"المزيد" (More)** section — extended list
6. **Club spotlight blocks** — one per major club (Wydad, Raja shown), each with a header linking to the club page + ~20 article cards
7. Footer: social links + legal notice + "أخر الأخبار" (latest news list)

**Observations:**
- Heavy redundancy: the same article appears in the featured grid, "Top News," and "More" — suggests zero curation, just latest-by-date.
- No hero/above-the-fold lead story with large image.
- No live scores module visible in current markup.

### 4.2 Articles list (`/articles/`)
- Simple paginated card grid, 21 per page, 2055 pages total.
- Each card: headline + category badge. No excerpt, no date on the card itself.
- Has a "تحميل المزيد" (Load More) button that appears non-functional in the static scrape (likely AJAX).
- Classic numbered pagination at the bottom (1, 2, 3, …, 2055, Next).

### 4.3 Single article
Layout (top to bottom):
1. Category badge (links to category archive)
2. H1 headline
3. Featured image (778×460)
4. Date (e.g., "19 أبريل 2026")
5. Author row: Gravatar + name + time + view count
6. First paragraph
7. **Inline related article card** (thumbnail + headline, mid-article)
8. Rest of body
9. **Second inline related article card**
10. Tag chips
11. "للتفاعل مع هذا المقال" (Engage with this article — likely social share buttons, not rendered in scrape)
12. "أخبار ذات صلة" (Related news) — 3-4 items

### 4.4 Tournaments page (`/tournaments/`)
**Completely empty except for a shortcode: `[mfm_sport_football_league_cup_standings]`**.
The standings are rendered client-side by a WP plugin. No filter UI visible in scraped HTML — likely a single default league or tabs injected by JS.

### 4.5 Matches page (`/matchs/`)
Same pattern as tournaments — a lone shortcode: `[mfm_sport_football_full_matches_program]`. Also JS-hydrated.

### 4.6 Club page (`/club/wydad-athletic-club/`)
- Header: club logo + club name as H2
- Simple paginated article grid (same card style as `/articles/` but filtered to the club)
- **Missing:** squad, fixtures, results, standings position, stats, history — i.e. it's just a news archive, not a real club hub.

### 4.7 Teams page
Broken: the "فرق" menu item points to `/under-construction`, which is a placeholder. **This is a greenfield opportunity in the rebuild.**

### 4.8 Category pages
Same card-grid pattern as `/articles/`, filtered by category. No category-specific header content (no league logo, no standings embedded, no recent fixtures).

---

## 5. Functional Inventory

| Feature | Status on current site | Quality | Rebuild priority |
|---|---|---|---|
| News publishing (articles) | ✅ Working | Decent | Must-keep, modernize UI |
| Categories & tags | ✅ Working | OK, slightly over-engineered hierarchy | Keep, simplify |
| Club news archives | ✅ Working | Thin — news only | Expand into full club hubs |
| League standings | ⚠️ Shortcode-based, opaque | Unknown | Rebuild as proper data feature |
| Match program / fixtures | ⚠️ Shortcode-based | Unknown, likely static | Rebuild with live data source |
| Teams directory | ❌ Broken (under construction) | N/A | **Build from scratch** |
| Player profiles | ❌ Absent | N/A | **New feature** |
| Live scores | ❌ Absent | N/A | **New feature** |
| Match details / lineups / events | ❌ Absent | N/A | **New feature** |
| Video content | ❌ Absent (YouTube linked, not embedded) | N/A | Consider |
| Search | ⚠️ "Search for:" box present but basic | Weak | Rebuild with proper full-text search |
| User accounts / comments | ❌ Not visible | N/A | Optional |
| Newsletter signup | ❌ Absent | N/A | Consider |
| Mobile app links | ❌ Absent | N/A | Consider |
| Social sharing | ⚠️ "للتفاعل مع هذا المقال" placeholder | Weak | Rebuild |
| Social presence | ✅ FB, IG, X, YouTube linked in footer | Good | Keep |
| RTL / Arabic | ✅ Native | Core identity | Must preserve |
| French/English toggle | ❌ Absent | N/A | Consider (Moroccan audience) |

---

## 6. Workflow / Data Flow (Current)

```
Editor writes article in WP admin
    ↓
WP stores: post + featured_image + category + tags + author
    ↓
Published → appears in:
  • Homepage featured grid (auto, by date)
  • /articles/ main feed
  • /category/{cat}/ archive
  • /club/{slug}/ archive (if tagged to a club)
  • /tag/{slug}/ archive
    ↓
Shortcodes [mfm_sport_football_*] pull fixtures/standings from
a separate data source (likely a WP plugin with manual entry
or a third-party football data API) and render client-side.
```

**Critical gap:** editorial content and structured football data live in two disconnected worlds. A rebuild should unify them (e.g., a match article auto-links to the match entity, which auto-links to the teams' league position, to their recent results, etc.).

---

## 7. Observations, Issues, Opportunities

### Issues with current site
- **Teams page broken** — a core nav item leads nowhere.
- **Visual fatigue** — dense list-after-list-after-list on homepage, no visual hierarchy, no hero.
- **Redundancy** — same articles appear 3–4 times on the homepage.
- **No data depth** — zero player profiles, no stats pages, no historical results.
- **Shortcode dependence** — standings and fixtures are black boxes; can't be styled to match site branding.
- **No live-match experience** — misses the single biggest driver of sports-site traffic.
- **Ads / monetization** — not visible; may exist but isn't strategically placed.
- **No language toggle** — Moroccan audience is bilingual (Arabic/French); French speakers are ignored.
- **Slow SEO slugs** — URL-encoded Arabic slugs are ugly and harder for link-sharing.

### Opportunities for the rebuild
1. **Live score hub** like beIN/ESPN: today's matches with live updating scores, match timelines, lineups, events.
2. **Team/Club pages as real hubs**: crest, stadium, squad, fixtures, results, form, league position, top scorers, recent news.
3. **Player profiles**: stats, career history, clubs played for, photos.
4. **League pages**: logo, current standings, top scorers, fixtures, results, history of winners.
5. **Editorial hierarchy on homepage**: one big hero + secondary stories + category rows — like modern sports sites.
6. **Real-time updates**: push notifications or at minimum live-refresh on match pages.
7. **Bilingual Arabic/French** with proper RTL ↔ LTR handling.
8. **Modern search**: auto-complete, cross-entity (articles + teams + players + matches).
9. **Mobile-first**: most Moroccan sports traffic is mobile.
10. **Dark mode**: standard for sports sites now.

---

## 8. Technology Analysis

**Current site (evidence):**
- WordPress CMS (`/wp-content/uploads/` paths everywhere)
- Gravatar for author avatars (`secure.gravatar.com`)
- Flag icons via CDN (`cdnjs.cloudflare.com/ajax/libs/flag-icon-css/`)
- Custom WP plugin prefixed `mfm_sport_football_*` for football data widgets
- No evidence of a headless setup, React front-end, or modern framework
- No visible CDN for site assets (besides flag icons)
- No visible analytics snippet (may be there, stripped by fetcher)

**Target stack — DECIDED:**
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (decided 2026-04-20)
- **Styling:** Tailwind CSS + **shadcn/ui** primitives (decided 2026-04-20)
- **Hosting:** Vercel
- **i18n:** `next-intl`
- **Analytics:** Vercel Analytics (decided 2026-04-20)
- **Error tracking:** Sentry (decided 2026-04-20)
- **Package manager:** pnpm (proposed)
- **Node.js:** 20 LTS

**CMS — DECIDED: Payload 3.0 (self-hosted, in-Next.js)**

Installed directly into the Next.js app folder via `pnpx create-payload-app@latest -t website`. Admin UI lives at `mfmsport.ma/admin`. Single deployment on Vercel.

**Infrastructure choices:**
- **Database:** Neon Postgres (Vercel-native, free tier covers dev + early launch traffic)
- **Media storage:** Vercel Blob (pairs naturally with Vercel deploys)
- **Email (for editor invitations, password resets):** Resend (cheap, Vercel-friendly) — TBD at setup time
- **Rich text:** Lexical editor (Payload 3.0 default, now stable)

**Rationale for Payload over Sanity (decided 2026-04-20):**
1. **Single codebase** — Payload installs into the Next.js app folder. One repo, one Vercel deployment, one TypeScript project. Massively better DX for a solo builder on a 52-day sprint.
2. **End-to-end type safety** — schema types flow from CMS config into frontend queries at build time. No `sanity-codegen` or manual GROQ typing.
3. **Cost** — self-hosted CMS software is free. Year-1 infra cost ~$0–40/mo vs Sanity's ~$90+/mo on Growth tier. $840/yr saved, compounds over time.
4. **Full ownership** — content lives in your Postgres. No SaaS lock-in, no pricing-policy risk over 5-10 years.
5. **Vercel-native** — Payload 3.0 explicitly supports Vercel serverless with Neon Postgres and Vercel Blob; one-click deploy template available.

**Acknowledged tradeoffs:**
- **Lose:** Sanity Studio's real-time collaborative editing. Mitigation: assign single-owner for live match threads, coordinate handoffs via Slack/WhatsApp (standard sports-newsroom pattern).
- **Lose:** Sanity's slightly more polished admin UI. Payload's admin is still good; editors will adapt in a week of training.
- **Gain:** All the simplifications listed above.

**Ruled out:**
- **WordPress** — user preference (2026-04-20)
- **Sanity** — good product, but the single-codebase + ownership + cost advantages of Payload outweigh its editor-UX polish for this specific project
- **Contentful, Strapi, Directus, Keystone, Storyblok** — not as natural a fit for trilingual + Next.js-native + editorial-heavy

**Migration approach (WordPress → Payload, ~3-5 days):**
1. Crawl current WP REST API → dump articles with featured images, authors, categories, tags, dates, slugs into a local NDJSON/JSON file.
2. Write a transformer that maps WP schema → Payload collection shape (Article, Author, Category, Tag, Media).
3. Bulk import via Payload's local API: `await payload.create({ collection: 'articles', data: ... })` in a loop with batching.
4. Build Next.js `redirects()` config from the dump — maps every old Arabic-slug URL to its new clean slug. Preserves SEO.
5. Re-host media: either keep WP's `/wp-content/uploads/` URLs intact (simpler) or pipe all images through Vercel Blob (cleaner, slightly more work).
6. Spot-check QA on a random 50-article sample across languages.

---

## 9. Design Direction — LOCKED

**Inspiration:** beIN Sports Arabic (ar-mena) — adapted for editorial focus, football only, and Moroccan brand identity.

**Theme:** Dark-only for v1. Light mode deferred to Phase 2 if reader feedback demands it.

**Palette (Option A — Moroccan red):**
- Background primary: `#0E0E10` (near-black)
- Background surface: `#1A1A1D` (cards, panels)
- Background elevated: `#222226` (hover states, chips)
- Brand red: `#D92332` (Atlas Lions / Moroccan flag red)
- Accent amber: `#F5A623` (secondary hover / highlights)
- Text primary: `#F5F5F5`
- Text secondary: `#9CA3AF`
- Text muted: `#6B7280`
- Border subtle: `rgba(255,255,255,0.06)`
- Border default: `rgba(255,255,255,0.08)`
- Semantic: win `#10B981`, loss `#EF4444`, draw / live `#F59E0B`

**Typography:**
- Arabic: IBM Plex Sans Arabic (primary) — Cairo as fallback
- Latin (FR/EN): IBM Plex Sans — designed sibling of Plex Arabic
- Headlines: 600 weight, tight tracking
- Body: 400 weight, line-height 1.7 for Arabic
- Numbers (scores, standings): Plex tabular numerals

**Patterns adopted from beIN (and adapted):**
- Dark-first theme, content-dense but not cluttered
- Competition-branded section blocks on the homepage (logo + section title + card grid below)
- Horizontal competition chips strip under main nav — quick access to every covered tournament
- Clean card anatomy: image (16:9) + red category badge + headline, no excerpt
- Live scores and fixtures as first-class nav destinations
- RTL-native layout (logo top-right, nav right-to-left, direction respects language)

**Patterns deliberately changed from beIN:**
- Football only (beIN is multi-sport)
- Editorial-first (beIN is video-first)
- Free with newsletter signup CTA (beIN pushes paid subscription)
- Moroccan red palette (beIN uses yellow/gold)
- Real editorial bylines with author pages (beIN has thin authorship)
- Section headers use a red underline + logo (beIN uses competition banner strips)

**Signature brand moments:**
- Red category badges on every card — brand visibility without being loud
- Red 2px underline under competition section headers
- Red circular play button on video thumbnails
- Red gradient newsletter strip (full-width, unmissable CTA)
- Red active-state in navigation

**Component library:** shadcn/ui primitives, themed with the Moroccan red palette via Tailwind tokens + CSS variables. Custom sports-specific components (MatchScoreCard, StandingsTable, PlayerCard, CompetitionSectionHeader, VideoCard) built on top.

---

## 10. Rebuild Scope 🔄

**Proposed phases** (to be discussed and refined):

**Phase 1 — Foundation**
- New design system (tokens, typography, components)
- Homepage + single article + category + tag pages
- Content migration path from WP

**Phase 2 — Football data layer**
- Proper teams directory with full club pages
- League pages with standings, fixtures, results
- Match detail pages (pre-match, live, post-match)
- Player profiles

**Phase 3 — Depth & engagement**
- Live scores hub
- Search across all entity types
- Author pages
- Newsletter / notifications
- Bilingual (AR/FR) support

**Phase 4 — Polish & growth**
- Dark mode
- PWA / mobile app shell
- Analytics & SEO hardening
- Ad placements (if relevant)

---

## 11. Open Questions — Status

1. ~~**Tech stack preference?**~~ ✅ **Next.js + Vercel**
2. ~~**Hosting / deployment target?**~~ ✅ **Vercel**
3. ~~**Content migration:**~~ ✅ **Full migration of all existing articles**
4. ~~**Data source for football:**~~ ✅ **API-Football** — see §15 for rationale and scope.
5. ~~**Team size / who builds?**~~ ✅ User builds; 5-6 editorial staff (journalists, presenters, hosts) will use the CMS.
6. ~~**Timeline / deadline?**~~ ⚠️ **~52 days (before FIFA World Cup 2026, kicks off 11 June 2026).** See §16 — aggressive; phasing required.
7. 🔴 **Budget constraints** — deferred, user will share API access later.
8. ~~**Monetization model?**~~ ✅ Light ad placements.
9. ~~**Scope of sports?**~~ ✅ Football only for now.
10. ~~**Trilingual — which 3 languages?**~~ ✅ **Arabic + French + English**
11. 🟡 **Admin/editorial workflow** — explained to user. Assumed WordPress defaults will cover this; confirm after CMS lock-in.

**New open topics:**
- ~~**CMS choice — Sanity vs Payload 3.0**~~ ✅ **Payload 3.0** (decided 2026-04-20)
- 🔴 **Design direction** (beIN Sports / ESPN inspiration mentioned — not yet detailed)
- 🔴 **Phase-1 sitemap & wireframes**
- 🔴 **i18n URL strategy** — proposed `/ar/…`, `/fr/…`, `/en/…` subpaths with Arabic as default
- 🔴 **Phasing plan sign-off** (see §16)
- 🔴 **Migration script scope** (now required — WP REST → Payload)
- 🔴 **Access to current WP install** (needed to start the migration export)

---

## 12. Decisions Log 🔄

*(Append entries as decisions are made. Format: date — topic — decision — rationale.)*

- **2026-04-20** — Project kickoff — full analysis of existing mfmsport.ma completed — baseline established for rebuild.
- **2026-04-20** — Frontend framework — **Next.js** — user preference; pairs naturally with Vercel and handles RTL/i18n well.
- **2026-04-20** — Hosting — **Vercel** — user preference; optimal DX for Next.js.
- **2026-04-20** — Migration scope — **full migration of existing ~43K articles** — preserve SEO and archive value.
- **2026-04-20** — Scope — **football only for v1** — de-risks the 50-day timeline.
- **2026-04-20** — Monetization — **light ads** — do not let ad tech shape the core UX.
- **2026-04-20** — Languages — **trilingual** (exact 3 to confirm) — aligns with Moroccan bilingual context + international World Cup audience.
- **2026-04-20** — Team — **user + 5-6 editorial contributors** — CMS choice must support multi-user editorial workflow.
- **2026-04-20** — Deadline — **~50 days (World Cup 2026 kickoff 11 June)** — forces hard phasing; live-scores & full club hubs likely phase-2.
- **2026-04-20** — Languages confirmed — **Arabic + French + English** — trilingual, AR as default with RTL; FR/EN as LTR alternates.
- **2026-04-20** — Competition scope for launch — **Botola Pro 1 + CAF competitions + top 5 European leagues + World Cup 2026** — sets data API requirements.
- **2026-04-20** — Live data cadence — **near-live (1-2 min delay acceptable)** — polling-based refresh sufficient; no push/webhook infra needed for v1.
- **2026-04-20** — Football data provider — **API-Football** (api-football.com) — covers all required leagues, near-live cadence, affordable tier progression, strong REST docs.
- **2026-04-20** — Language — **TypeScript** — strongly recommended for a multi-page codebase; team velocity and refactor safety.
- **2026-04-20** — UI primitives — **shadcn/ui + Tailwind** — speeds up component delivery during 50-day sprint.
- **2026-04-20** — Observability — **Vercel Analytics + Sentry from day 1** — catches bugs and user-behavior issues from launch.
- **2026-04-20** — **WordPress ruled out** — user explicitly rejected WordPress. Forces active CMS evaluation between Sanity (recommended) and Payload 3.0. Migration of ~43K articles now becomes a real 3-5 day scripted task.
- **2026-04-20** — CMS — **Payload 3.0** (self-hosted, in-Next.js, Neon Postgres, Vercel Blob) — chosen over Sanity. Rationale: single codebase for solo builder on 52-day sprint, end-to-end TypeScript, ~$70/mo cost savings compound, full ownership, no SaaS lock-in. Tradeoff accepted: lose real-time collab on live match threads (mitigated via single-owner pattern + Slack coordination).
- **2026-04-20** — Database — **Neon Postgres** (confirmed) — Supabase evaluated and ruled out. Rationale: we use none of Supabase's bundled services (Payload handles auth; Vercel Blob handles media; no realtime needed — API-Football is server-polled + ISR-cached). Neon is pure Postgres, Vercel-native, with scale-to-zero and instant branching. Migration to Supabase later is a `pg_dump` away if user features ever shift the need.
- **2026-04-20** — Authentication scope — **no reader auth** — public news site; readers consume, no login/accounts/comments at launch. Editor auth lives inside Payload (admin users). Future features like newsletter signup or "follow your team" notifications store an email via a transactional service (Resend / ConvertKit) without requiring a full auth system.
- **2026-04-20** — Newsletter — **in scope for Phase 1** (moved from Phase 3 per user) — implementation via Resend or ConvertKit integration, simple signup form in header/footer + confirmation + unsubscribe flow. No auth, just email storage.
- **2026-04-20** — Build tool — **Claude Code** will do the actual coding. Productivity multiplier on scaffolding, CRUD, boilerplate, component variants (~50-60% faster). Does not compress design decisions, migration QA, editorial onboarding, or real-world debugging. 52-day Phase 1 timeline is achievable but still requires disciplined scope and fast design decisions.
- **2026-04-20** — Design inspiration — **beIN Sports Arabic (ar-mena)** — chosen as reference for layout, content density, and RTL handling. Adapted for football-only scope + editorial focus + Moroccan brand.
- **2026-04-20** — Palette — **Option A (Moroccan red)** — brand red `#D92332` on near-black `#0E0E10` surfaces. Amber `#F5A623` as secondary accent.
- **2026-04-20** — Theme mode — **Dark-only for v1** — simpler implementation, ships faster, matches sports-site convention. Light mode deferred to Phase 2 if reader feedback demands it.
- **2026-04-20** — Videos — **in scope for Phase 1** (YouTube-embed-first). Articles can feature embedded YouTube videos; dedicated `/videos` section; video cards with play overlay + duration badge. Self-hosted video (Mux / Bunny Stream) and Shorts-style vertical feed deferred to Phase 2.
- **2026-04-20** — Phase-1 sitemap — **LOCKED** — see §18. URL strategy: always-prefix locales (`/ar/…`), transliterated ASCII slugs, flattened competition hierarchy, middleware-based legacy redirects. 10 Payload collections defined. Full route list mapped with data sources and cache strategies.

---

## 13. Progress Log 🔄

*(Append timestamped entries as work happens.)*

- **2026-04-20** — Scraped homepage, articles list, tournaments page, matches page, a sample article, and a sample club page. Built this memory document as the single source of truth.
- **2026-04-20** — First round of user answers received. Stack (Next.js/Vercel), migration (full), team, timeline, monetization, scope, and trilingual direction locked in. Remaining discussion topics: football data source (big), exact 3 languages, editorial workflow details, CMS final choice, design direction, phasing plan.
- **2026-04-20** — Second round: languages (AR/FR/EN), competition scope (Botola + CAF + top 5 European + World Cup), live-data cadence (near-live), and football data provider (API-Football) all locked in. Next up: CMS sign-off, design direction conversation (beIN/ESPN inspiration), and phase-1 sitemap.
- **2026-04-20** — Third round: TypeScript + shadcn/ui + Tailwind + Vercel Analytics + Sentry locked in. **WordPress ruled out** — CMS evaluation reopened. Sanity recommended over Payload 3.0 on editor-UX and zero-ops grounds. Content migration scope expanded to include a one-time WP-to-target-CMS ETL script.
- **2026-04-20** — Fourth round: user asked for personal recommendation given solo-builder + 52-day constraint. **Payload 3.0 chosen** over Sanity on single-codebase / ownership / cost grounds. Full stack now locked (Next.js 15 App Router + TS + Tailwind + shadcn/ui + Payload 3.0 + Neon Postgres + Vercel Blob + next-intl + Vercel Analytics + Sentry + API-Football). Ready to move to design direction or start scaffolding.
- **2026-04-20** — Fifth round: user confirmed **Neon over Supabase** for the database (we use none of Supabase's bundled services) and confirmed **no reader authentication** in scope (public news site; editor auth handled by Payload). Newsletter / notification features deferred to Phase 3 as transactional-only (no full auth system needed).
- **2026-04-20** — Sixth round: **Newsletter moved into Phase 1 scope** (user marked mandatory). User will build with **Claude Code**. Timeline reassessed: 52-day Phase 1 is achievable with Claude Code as multiplier (~10-15% risk of missing deadline) versus risky (35-40%) without. Non-code work (design, migration QA, editorial training) remains the real schedule pressure.
- **2026-04-20** — Seventh round: **Design direction locked** — beIN ar-mena as inspiration, Moroccan red palette (Option A), dark-only for v1, video support added to Phase 1 (YouTube-embed-first), newsletter signup via red gradient strip. Homepage mockup shown and approved in direction. Remaining open: phase-1 sitemap detail, scaffolding start, WP export access for migration.
- **2026-04-20** — Eighth round: **Phase-1 sitemap locked** (§18). 10 Payload collections defined. All public routes, admin routes, API routes, and SEO files mapped with data sources and cache strategies. URL strategy decided (always-prefix locales, ASCII slugs, flattened competition hierarchy, middleware-based legacy redirects). Blueprint complete — ready for scaffolding.

---

## 14. Sources Consulted

- https://mfmsport.ma/ (homepage)
- https://mfmsport.ma/articles/ (article list)
- https://mfmsport.ma/tournaments/ (standings)
- https://mfmsport.ma/matchs/ (fixtures)
- https://mfmsport.ma/club/wydad-athletic-club/ (sample club page)
- Sample article (Olympique Safi vs. USM Alger riots, 19 Apr 2026)

---

## 15. Football Data Source — DECIDED

**Provider:** API-Football (https://www.api-football.com/)
**Access model:** Direct via api-football.com dashboard (RapidAPI also possible as alternative marketplace).
**Cadence:** Near-live polling (1–2 min refresh on match pages). No webhook/push infra needed for v1.

**Required coverage (must-have):**
- 🇲🇦 **Botola Pro 1** (Morocco)
- 🌍 **CAF competitions:** CAF Champions League, CAF Confederation Cup, Africa Cup of Nations, CAF Super Cup
- ⚽ **FIFA World Cup 2026**
- 🇪🇺 **Top 5 European leagues:** Premier League (England), La Liga (Spain), Bundesliga (Germany), Serie A (Italy), Ligue 1 (France)
- 🏆 **European club competitions:** UEFA Champions League, UEFA Europa League *(assumed needed for editorial parity)*

**Data points required per entity:**
- **Fixtures:** date, kickoff, home/away teams, venue, competition, round, referee, status
- **Results:** final score, half-time, scorers, cards, substitutions
- **Standings:** P, W, D, L, GF, GA, GD, Pts, form (last 5)
- **Match detail:** lineups (starting XI + bench), events timeline (goals, cards, subs, VAR), basic stats (possession, shots, corners)
- **Teams:** crest, colors, venue, squad
- **Players:** name, photo, position, age, nationality, shirt number, season stats
- **Top scorers / assists** per competition

**Pricing note:** Pricing tiers evolve; final tier choice will be made at purchase time based on expected daily call volume. Rough ballpark: start on a low tier (~$20/mo) during development, scale to a mid tier at launch based on real traffic. The dev tier is enough to build and test; we only need to scale when live users are hitting the cached endpoints.

**Architecture pattern (Next.js side):**
- **Server-side fetches** (RSC / route handlers) with **ISR / revalidate** = 60–120 seconds for fixtures, standings, and match pages.
- **Cache aggressively** at Vercel's edge; the data API is an upstream, not a per-request dependency.
- **Rate-limit safe**: one fetch per page variant per revalidation window, not per user request.
- For the live match page specifically: client-side polling every 60 seconds *or* server-side ISR on 60s — pick one, don't stack.

**Fallback plan:** if during build we discover API-Football has gaps in Botola or CAF depth, layer in **SportMonks** for those specific competitions. Keep the data layer abstracted behind a service module so the provider can be swapped per-competition without touching page code.

---

## 16. Timeline Reality Check 🔄

**Deadline:** before World Cup 2026 kickoff (**11 June 2026**) = **~52 days from today (20 April 2026)**.
**Build tool:** user will build with **Claude Code** — significant productivity multiplier on code, but non-code work (design decisions, migration QA, editorial training) is not compressed.

**What fits in 52 days with Claude Code + solo builder + editors ramping up:**
- ✅ New design system + homepage + article/category/tag/club pages
- ✅ Payload 3.0 wired to Next.js (single deployment)
- ✅ Content migration (WP REST → Payload, with redirects from old Arabic slugs)
- ✅ Trilingual scaffolding (AR default, FR, EN) with proper RTL/LTR switching
- ✅ Basic fixtures & standings pages driven by API-Football
- ✅ Match detail pages at MVP level (pre-match + post-match; live events defer)
- ✅ **Newsletter signup + Resend integration** (moved from Phase 3 to Phase 1 per user)
- ✅ **Video support — YouTube-embed-first** (articles can feature embedded YouTube videos; dedicated `/videos` page; video cards with play overlay and duration badge)
- ✅ Search (basic)
- ✅ Sentry + Vercel Analytics + SEO basics
- ❌ Full live-score hub with real-time event stream — phase 2
- ❌ Full player profiles with career stats — phase 2
- ❌ Squad pages with full rosters — phase 2
- ❌ Historical stats deep-dives — phase 2
- ❌ Self-hosted video (Mux / Bunny Stream) — phase 2 if demand warrants
- ❌ Shorts / vertical video feed — phase 2+

**What Claude Code compresses heavily (50-60% faster):** scaffolding, CRUD pages, collection configs, API wrappers, type generation, boilerplate for i18n/metadata/redirects, component variants.

**What Claude Code does NOT compress:** design taste decisions, content migration edge-case debugging on 43K real WP articles, i18n QA across 3 languages, editorial onboarding (training 5-6 staff), integration debugging against real API-Football responses, DNS/domain cutover, account signups & payments.

**Realistic risk assessment:**
- Without Claude Code: 52 days is risky. ~35-40% chance of missing deadline.
- With Claude Code + disciplined scope: ~10-15% chance of missing. Miss scenarios are almost always content-migration surprises or design decision loops — not code throughput.

**Conditions for the 52-day plan to hold:**
1. Design direction decided within first week
2. Current WP export access obtained in first 7 days
3. Phase 2 features stay firmly out of Phase 1 scope
4. Editorial training runs in parallel with final-week polish, not after launch
5. User reviews Claude Code output critically — "bad code at speed" is the real trap

**Phased plan:**
- **Phase 1 (by 11 June):** editorial platform reborn + trilingual + fixtures + standings + basic match pages + newsletter signup. World Cup ready.
- **Phase 2 (June–July):** live scores with event timeline, full club hubs, player profiles, search upgrades.
- **Phase 3 (post World Cup):** community features (if roadmap evolves that way), advanced personalization, further polish.

---

## 17. i18n — Trilingual Architecture

**Languages:** Arabic (AR, primary, RTL) · French (FR, LTR) · English (EN, LTR)

**URL strategy (proposed):** subpath prefixes
- `mfmsport.ma/ar/…` — default Arabic
- `mfmsport.ma/fr/…` — French
- `mfmsport.ma/en/…` — English

The bare domain `mfmsport.ma/` redirects to `/ar/` (or detects the browser's `Accept-Language` and redirects accordingly, with `/ar/` as fallback).

**Next.js implementation:** `next-intl` (recommended — actively maintained, App Router-native, handles RTL attribute at layout level).

**Direction handling:**
- `<html lang="ar" dir="rtl">` for Arabic
- `<html lang="fr" dir="ltr">` / `<html lang="en" dir="ltr">` for French/English
- Tailwind's `rtl:` / `ltr:` modifiers for per-element adjustments (logical properties preferred: `ms-4`/`me-4` over `ml-4`/`mr-4`)

**Typography:**
- Arabic: **IBM Plex Sans Arabic** or **Cairo** (both on Google Fonts, load-tested for RTL)
- Latin (FR/EN): pair with **Inter** or **IBM Plex Sans** for visual consistency
- Avoid mixing 4+ fonts; ideally one family that has both Arabic and Latin glyphs

**Content translation model (WordPress side):**
- **Polylang** (free) — good for small-to-medium multilingual sites
- **WPML** (~$99/yr) — more mature for complex editorial workflows, better plugin compatibility

Recommendation: **Polylang** for v1 unless we hit a blocker. Switching to WPML later is possible (tools exist for the migration).

**Fallback behavior:** if an article exists in AR but not yet in FR/EN, the FR/EN version should display the AR original with a "translation coming soon" notice *or* fall back to auto-translated (flagged as such). Decision needed from user.

---

## 18. Phase-1 Sitemap — LOCKED

**URL strategy decisions:**
- **Locale always prefixes the URL** — `/ar/…`, `/fr/…`, `/en/…`. Bare `/` redirects to `/ar/` (or best-match from `Accept-Language`). Cleaner SEO, standard next-intl pattern.
- **Clean ASCII slugs** — transliterate Arabic at article-create time (e.g., `/ar/articles/riots-at-el-massira-stadium`). Original WP encoded-Arabic slugs stored in the `redirects` collection as aliases for 301s.
- **Flatten competition hierarchy** — current WP nests 3 levels deep (`/category/continental/equipes/coupe-de-la-confederation/`). New structure is `/competition/caf-confederation-cup` — cleaner and more shareable.
- **43K legacy redirects** — not in `next.config.js` (too many). Handled by middleware that looks up old slugs in Payload's `redirects` collection, issues 301s.

### Payload collections (10)

| Collection | Purpose | Key relationships |
|---|---|---|
| `articles` | News articles (editorial + video) | author, categories, tags, clubs, competitions, featuredMedia, locale-linked siblings |
| `authors` | Journalists, presenters, hosts | — |
| `categories` | Hierarchical taxonomy | self-referential parent |
| `tags` | Flat taxonomy | — |
| `clubs` | Teams (Wydad, Raja, FAR, etc.) | → competitions (many-to-many) |
| `competitions` | Leagues and cups (Botola, CAF CL, Premier League…) | → category |
| `media` | Uploaded images via Vercel Blob | — |
| `subscribers` | Newsletter audience (email + locale + status) | — |
| `redirects` | Old WP slug → new slug (for migration) | — |
| `users` | Payload admin accounts with role-based access | — |

**Locale handling:** Articles use Payload's built-in localization — one logical article with AR / FR / EN field variants linked as siblings.

### Public editorial routes (per-locale `/[locale]/`)

| Route | Page | Data | Cache |
|---|---|---|---|
| `/` | Redirect to `/ar/` (or `Accept-Language` match) | — | — |
| `/[locale]/` | Homepage | Payload + API-Football | ISR 60s |
| `/[locale]/articles` | All articles, paginated | Payload | ISR 60s |
| `/[locale]/articles/[slug]` | Single article | Payload | ISR 60s; on-demand revalidate on update |
| `/[locale]/category/[slug]` | Category archive | Payload | ISR 60s |
| `/[locale]/tag/[slug]` | Tag archive | Payload | ISR 60s |
| `/[locale]/author/[slug]` | Author profile + their articles | Payload | ISR 5m |
| `/[locale]/search` | Search results (`?q=`) | Payload full-text | no-cache |

### Football data routes

| Route | Page | Data | Cache |
|---|---|---|---|
| `/[locale]/matches` | Today + upcoming + recent | API-Football | ISR 60s |
| `/[locale]/matches/[id]` | Single match (pre-match, lineups, summary) | API-Football | ISR 60–120s |
| `/[locale]/competition` | All competitions index | Payload | ISR 1h |
| `/[locale]/competition/[slug]` | Competition (logo + standings + fixtures + news) | Payload + API-Football | ISR 60s |
| `/[locale]/club/[slug]` | Club (basic info + news archive) | Payload + API-Football | ISR 5m |

### Videos + static + newsletter

| Route | Page | Data | Cache |
|---|---|---|---|
| `/[locale]/videos` | Video hub (articles flagged as video) | Payload | ISR 60s |
| `/[locale]/newsletter` | Subscription landing | static | build-time |
| `/[locale]/newsletter/confirm` | Double opt-in confirmation | — | no-cache |
| `/[locale]/unsubscribe` | Unsubscribe landing | — | no-cache |
| `/[locale]/about` | About | Payload (editable) | ISR 1h |
| `/[locale]/contact` | Contact | Payload (editable) | ISR 1h |
| `/[locale]/legal` | Legal notice | Payload (editable) | ISR 1h |
| `/[locale]/privacy` | Privacy policy | Payload (editable) | ISR 1h |

### Admin routes (Payload-native, no locale prefix)

- `/admin` — dashboard (login required)
- `/admin/collections/{collection}` — CRUD for every collection
- `/admin/account` — editor profile / password

### Internal API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/newsletter/subscribe` | POST | Signup handler, sends Resend confirmation email |
| `/api/newsletter/confirm` | GET | Double opt-in confirmation target |
| `/api/revalidate` | POST | Payload afterChange hook calls this to revalidate affected pages |
| `/api/search` | GET | Search endpoint for `/[locale]/search` |
| `/api/og/[...params]` | GET | Dynamic OG image generation for social sharing |

### SEO / technical

- `/sitemap.xml` — auto-generated, one entry per locale per page
- `/robots.txt` — crawler rules, points at sitemap
- `/[locale]/feed.xml` — RSS feed per locale (latest articles)

### Middleware responsibilities

1. **Locale detection & routing** — `next-intl` handles bare `/` → `/ar/` redirect or `Accept-Language` match
2. **Legacy URL redirects** — look up incoming paths against `redirects` collection; 301 if matched
3. **Direction attribute** — set `<html dir="rtl">` for `/ar/*`, `dir="ltr"` for `/fr/*` and `/en/*`
4. **Auth gate** — protect `/admin` and `/api/revalidate` (shared secret)

---

*End of document. Update freely as the project progresses.*
