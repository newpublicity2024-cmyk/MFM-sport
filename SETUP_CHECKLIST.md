# MFM Sport — Setup Checklist

> Everything you need to set up for the website to be fully operational. Follow in order.

---

## 1. Accounts to Create

| Service | URL | What you get | Cost |
|---------|-----|-------------|------|
| **Neon** | https://neon.tech | Postgres database | Free tier |
| **Vercel** | https://vercel.com | Hosting + deployment | Free tier |
| **API-Football** | https://www.api-football.com | Live match data | Free dev tier, ~$20/mo for launch |
| **Resend** | https://resend.com | Email sending (newsletter) | Free tier (100 emails/day) |
| **Sentry** | https://sentry.io | Error tracking | Free tier |

---

## 2. Environment Variables

Generate secrets locally:

```bash
# Payload secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Revalidation secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fill in `.env` (copy from `.env.example`):

| Variable | Where to get it | Status |
|----------|----------------|--------|
| `DATABASE_URL` | Neon dashboard -> Connection string | Done |
| `PAYLOAD_SECRET` | Generate locally (see above) | Done |
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard -> Storage -> Create Blob Store | Not done |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry -> Create Next.js project -> Copy DSN | Not done |
| `NEXT_PUBLIC_SITE_URL` | `https://mfmsport.ma` for production, `http://localhost:3000` for dev | Set to localhost |
| `API_FOOTBALL_KEY` | API-Football dashboard -> Your API key | Not done |
| `RESEND_API_KEY` | Resend dashboard -> API Keys -> Create | Not done |
| `REVALIDATION_SECRET` | Generate locally (see above) | Not done |
| `WP_API_URL` | Your WordPress site REST API URL | Already defaulted |

---

## 3. Service Setup Details

### Neon Database (already done)
- You already have a connection string configured in `.env`

### Vercel Account
1. Sign up at https://vercel.com (GitHub login works)
2. Push your project to GitHub first: `git remote add origin <your-repo-url> && git push -u origin master`
3. In Vercel: Import the `mfm-sport` repository
4. During import, add ALL environment variables from `.env`
5. Deploy

### API-Football Key
1. Sign up at https://www.api-football.com/pricing
2. Start with the **Free** plan (100 requests/day — enough for development)
3. Copy your API key from the dashboard
4. Add `API_FOOTBALL_KEY=your-key` to `.env`

### Resend API Key
1. Sign up at https://resend.com
2. Add and verify your domain `mfmsport.ma` (requires DNS records — see section 7)
3. Create an API key in the Resend dashboard
4. Add `RESEND_API_KEY=your-key` to `.env`

### Sentry Project
1. Sign up at https://sentry.io
2. Create a new project -> select Next.js
3. Copy the DSN from project settings
4. Add `NEXT_PUBLIC_SENTRY_DSN=your-dsn` to `.env`

### Vercel Blob Storage
1. In Vercel dashboard -> your project -> Storage tab
2. Create a new Blob Store
3. It auto-generates `BLOB_READ_WRITE_TOKEN` — add it to your Vercel env vars

---

## 4. Content Setup (in Payload Admin at /admin)

### First-time admin setup
1. Visit `http://localhost:3000/admin` (or your deployed URL)
2. Create your first admin account (email + password)

### Create Competitions
Go to Admin -> Competitions -> Create. Add each league:

| Name | Slug | Type | API-Football ID | Season |
|------|------|------|----------------|--------|
| Botola Pro 1 | botola-pro-1 | League | 200 | 2025 |
| CAF Champions League | caf-champions-league | Cup | 12 | 2025 |
| CAF Confederation Cup | caf-confederation-cup | Cup | 20 | 2025 |
| Africa Cup of Nations | africa-cup-of-nations | Cup | 6 | 2025 |
| FIFA World Cup 2026 | world-cup-2026 | Cup | 1 | 2026 |
| Premier League | premier-league | League | 39 | 2025 |
| La Liga | la-liga | League | 140 | 2025 |
| Bundesliga | bundesliga | League | 78 | 2025 |
| Serie A | serie-a | League | 135 | 2025 |
| Ligue 1 | ligue-1 | League | 61 | 2025 |
| UEFA Champions League | uefa-champions-league | Cup | 2 | 2025 |
| UEFA Europa League | uefa-europa-league | Cup | 3 | 2025 |

### Create Key Clubs
Go to Admin -> Clubs -> Create. Add major Moroccan clubs:

| Name | Slug | API-Football ID | Country |
|------|------|----------------|---------|
| Wydad AC | wydad-ac | 965 | Morocco |
| Raja CA | raja-ca | 967 | Morocco |
| FAR Rabat | far-rabat | 973 | Morocco |
| RS Berkane | rs-berkane | 981 | Morocco |

Look up other team IDs at https://www.api-football.com/documentation-v3#tag/Teams

### Create Categories
Go to Admin -> Categories -> Create. Match the old site structure:

| Name (Arabic) | Slug | Parent |
|---------------|------|--------|
| البطولة | el-botola | — |
| البطولة الاحترافية 1 | botola-pro-1 | el-botola |
| القارية | continental | — |
| كأس أفريقيا | africa-cup-of-nations | continental |
| دوري أبطال أفريقيا | caf-champions-league | continental |
| أوروبا | europe | — |
| الدوري الإنجليزي | premier-league | europe |
| الدوري الإسباني | la-liga | europe |
| كأس العالم 2026 | world-cup-2026 | — |

### Create Static Pages
Go to Admin -> Pages -> Create. Add 4 pages:

| Title | Slug | Body |
|-------|------|------|
| من نحن | about | Write your About Us content |
| اتصل بنا | contact | Contact info, email, social links |
| إشعار قانوني | legal | Your legal notice text |
| سياسة الخصوصية | privacy | Your privacy policy text |

### Create Authors
Go to Admin -> Authors -> Create. Add your 5-6 editorial team members with:
- Name (Arabic)
- Slug (e.g., `abdel-ilah-dahaoui`)
- Bio
- Avatar (upload a photo)
- Social links (optional)

### Create Editor Accounts
Go to Admin -> Users -> Create. Add accounts for your team:
- Email + password for each editor
- Role: `editor` (can create/edit content) or `viewer` (read-only)

---

## 5. WordPress Migration

Once all the above is configured:

```bash
# Make sure .env has WP_API_URL, DATABASE_URL, and PAYLOAD_SECRET
pnpm migrate:wp
```

This imports:
- All WordPress categories -> Payload categories
- All WordPress tags -> Payload tags
- All WordPress authors -> Payload authors
- All published articles (~43K) -> Payload articles
- Legacy URL redirect mappings -> Payload redirects

**Note:** Article bodies are imported as metadata only (title, excerpt, dates, relationships). The rich text body needs manual editing in Payload admin or a follow-up HTML-to-Lexical conversion script.

---

## 6. DNS & Domain (when ready to go live)

### Point domain to Vercel
1. In Vercel dashboard: Settings -> Domains -> Add `mfmsport.ma`
2. At your domain registrar, update DNS:

| Type | Name | Value |
|------|------|-------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

3. Vercel auto-provisions SSL certificate
4. Update `NEXT_PUBLIC_SITE_URL` to `https://mfmsport.ma` in Vercel env vars

### Resend Domain Verification (for newsletter emails)
At your domain registrar, add the DNS records provided by Resend:

| Type | Purpose |
|------|---------|
| TXT | SPF record (email authentication) |
| CNAME | DKIM record (email signing) |
| CNAME | Return-Path (bounce handling) |

Without these records, emails from `noreply@mfmsport.ma` will not deliver.

---

## 7. Deployment

```bash
# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/mfm-sport.git
git push -u origin master

# Vercel auto-deploys on push
# Or manually: vercel deploy --prod
```

In Vercel project settings, make sure ALL env vars are added:
- `DATABASE_URL`
- `PAYLOAD_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SITE_URL` = `https://mfmsport.ma`
- `API_FOOTBALL_KEY`
- `RESEND_API_KEY`
- `REVALIDATION_SECRET`

---

## 8. Post-Launch Checklist

- [ ] Train editorial team on Payload admin (creating articles, uploading images, managing categories)
- [ ] Verify all 3 locales work (Arabic RTL, French, English)
- [ ] Test newsletter signup flow (subscribe -> confirm email -> confirmed)
- [ ] Verify matches page shows live data from API-Football
- [ ] Check competition pages show standings and fixtures
- [ ] Test legacy URL redirects (try an old WordPress URL)
- [ ] Verify sitemap.xml loads at `https://mfmsport.ma/sitemap.xml`
- [ ] Verify RSS feeds at `/ar/feed.xml`, `/fr/feed.xml`, `/en/feed.xml`
- [ ] Monitor Sentry for errors in the first 48 hours
- [ ] Check Vercel Analytics for traffic patterns
- [ ] Scale API-Football plan if you hit the free tier rate limit (100 req/day)
- [ ] Set up Vercel Blob storage for production media uploads

---

## Quick Reference: All URLs

| URL | Purpose |
|-----|---------|
| `/admin` | Payload CMS admin panel |
| `/ar/` | Arabic homepage (RTL) |
| `/fr/` | French homepage |
| `/en/` | English homepage |
| `/ar/articles` | Article list |
| `/ar/articles/[slug]` | Single article |
| `/ar/matches` | Today's matches |
| `/ar/matches/[id]` | Match detail |
| `/ar/competition/[slug]` | Competition (standings + fixtures) |
| `/ar/club/[slug]` | Club page |
| `/ar/videos` | Video articles |
| `/ar/search?q=...` | Search |
| `/ar/author/[slug]` | Author profile |
| `/ar/about` | About page |
| `/ar/contact` | Contact page |
| `/ar/feed.xml` | RSS feed |
| `/sitemap.xml` | Sitemap |
| `/robots.txt` | Robots file |
| `/api/og?title=...` | Dynamic OG image |
