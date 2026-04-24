# Google AdSense — Setup Checklist

This is the list of **non-code steps** you need to do outside the repo to get ads live on mfmsport.ma. Code is already in place on the `feat/ad-banners` branch. Check items off as you go.

---

## Phase 1 — Before applying to AdSense

AdSense rejects sites that look incomplete. Do these first.

- [ ] **Merge `feat/ad-banners` into `master`** (ads won't render until this is deployed, but the site needs to be live with working pages first).
- [ ] **Run the WordPress migration** so you have a real article library (AdSense wants substantial content — 20+ articles minimum, ideally hundreds).
  ```bash
  pnpm seed:preview:reset
  pnpm migrate:wp
  ```
- [ ] **Deploy to production** at `https://mfmsport.ma`:
  - Push to GitHub
  - Import into Vercel
  - Point DNS (`mfmsport.ma` → Vercel)
  - Verify `https://mfmsport.ma` loads and serves real content in all three languages
- [ ] **Check these pages render publicly and have real content:**
  - `/en`, `/fr`, `/ar` (homepage)
  - `/en/articles`, `/en/category/[any]`, `/en/tag/[any]`
  - `/en/articles/[any-slug]` (article detail)
  - `/en/privacy` — **required** for AdSense
  - `/en/legal` — required in Morocco
  - `/en/about` — helps approval
  - `/en/contact` — required for AdSense
- [ ] **Confirm `https://mfmsport.ma/ads.txt` returns 200** — it's already in `public/ads.txt`, should be served automatically once deployed. Don't fill in the publisher ID yet.
- [ ] **Wait for some organic traffic** — AdSense wants to see real visitors, not just you refreshing. Share articles, post on social, let Google index you. Typical minimum: 2–4 weeks of indexing + a few hundred organic visits.

---

## Phase 2 — Apply to Google AdSense

- [ ] Go to [adsense.google.com](https://adsense.google.com) and sign in with the Google account you want to receive payments on.
- [ ] Click **Get started**.
- [ ] Enter your site: `mfmsport.ma` (no protocol, no trailing slash).
- [ ] Select your country (**Morocco**) — this is the country for the payment account. Can't be changed later.
- [ ] Select payment currency (USD or MAD — USD is more flexible for international payouts).
- [ ] Accept the AdSense terms.
- [ ] **Save your publisher ID** — it shows up as `ca-pub-XXXXXXXXXXXXXXXX` on the AdSense home dashboard. Copy it somewhere safe. You'll need it in Phase 3.
- [ ] AdSense gives you a verification snippet. **Ignore it** — the code in this repo already loads the right script automatically once you fill the env var in Phase 3. (If the AdSense UI insists on manual verification, use the "Code in the `<head>` tag of your homepage" method and temporarily let it proceed — once the snippet is served via the env var deployment, verification will pass.)
- [ ] Submit for review. AdSense approval typically takes **3 days to 4 weeks**. They email you when they decide.

**If rejected:** Most common reasons are "insufficient content," "site not ready," or "policy violations." Read the exact reason, fix it, and reapply after ~30 days. Don't reapply immediately.

---

## Phase 3 — After AdSense approves you

You'll get an email: "Your site is ready to show ads."

### 3a. Fill in your publisher ID

- [ ] **Vercel environment variable.** Go to your Vercel project → Settings → Environment Variables. Add:
  ```
  NEXT_PUBLIC_ADSENSE_CLIENT_ID = ca-pub-XXXXXXXXXXXXXXXX
  ```
  Apply to: Production, Preview, Development (all three). Save.

- [ ] **Update `public/ads.txt`** in the repo — replace the placeholder `pub-XXXXXXXXXXXXXXXX` with your real publisher ID (without the `ca-` prefix). Commit and push.
  ```
  # Before
  google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
  # After
  google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
  ```
  After deploy, verify `https://mfmsport.ma/ads.txt` shows the real ID.

### 3b. Create the 5 ad units in AdSense

In the AdSense dashboard, go to **Ads → By ad unit → Display ads**. Create one ad unit for each placement below. For each, use the listed name and size settings. **Copy the 10-digit slot ID** (it looks like `1234567890` — not the snippet, just the ID) into the table at the bottom.

- [ ] **Header Leaderboard**
  - Name: `MFM — Header Leaderboard`
  - Ad size: Responsive
- [ ] **In-Article Mid**
  - Name: `MFM — In-Article Mid`
  - Ad size: Responsive
- [ ] **In-Article Bottom**
  - Name: `MFM — In-Article Bottom`
  - Ad size: Responsive
- [ ] **In-Grid**
  - Name: `MFM — Between Cards`
  - Ad size: Responsive
- [ ] **Sticky Mobile**
  - Name: `MFM — Sticky Mobile`
  - Ad size: Responsive (or Anchor if AdSense offers it in your account — Anchor is the official name for this format)

Save each slot ID here as you go:

| Slot | AdSense name | 10-digit slot ID |
|---|---|---|
| Header Leaderboard | MFM — Header Leaderboard | _____________ |
| In-Article Mid | MFM — In-Article Mid | _____________ |
| In-Article Bottom | MFM — In-Article Bottom | _____________ |
| In-Grid | MFM — Between Cards | _____________ |
| Sticky Mobile | MFM — Sticky Mobile | _____________ |

### 3c. Fill the slot IDs into the code

- [ ] Open `src/lib/ads/slots.ts`.
- [ ] Replace the five empty strings in `AD_SLOTS` with the IDs from the table above. Example:
  ```typescript
  export const AD_SLOTS: Record<SlotName, string> = {
    headerLeaderboard: "1234567890",
    inArticleMid: "2345678901",
    inArticleBottom: "3456789012",
    inGrid: "4567890123",
    stickyMobile: "5678901234",
  };
  ```
- [ ] Commit, push, let Vercel deploy.

### 3d. Enable the consent banner (Funding Choices)

This is required for EU/UK visitors (GDPR). Free, built into AdSense.

- [ ] In the AdSense dashboard, go to **Privacy & messaging** → **European regulations**.
- [ ] Click **Create message** → **GDPR**.
- [ ] Configure appearance (colors, logo, language — set to auto-detect). Leave most defaults.
- [ ] Publish the message.
- [ ] No code change needed — the AdSense script loads Funding Choices automatically.

---

## Phase 4 — After first deployment with real ad IDs

- [ ] Visit `https://mfmsport.ma/en` and verify:
  - Open DevTools → Network tab → filter `pagead2.googlesyndication.com`. You should see the script loading.
  - The header should have an ad slot above it (may be blank at first — fill rate isn't 100% immediately).
  - Scroll to the bottom — you should see either a sticky mobile bar (on mobile viewport) or nothing (on desktop).
- [ ] Open an article and scroll — check for mid-article ad and bottom ad.
- [ ] Open the articles listing — scroll past 8 cards, check for between-grid ad.
- [ ] Open DevTools → check the `<html>` source for `<ins class="adsbygoogle" data-ad-status="...">`. Status will be either `filled` (ad showing) or `unfilled` (CSS hides the wrapper — expected, normal).
- [ ] **Wait 24–48 hours** before judging fill rate. AdSense needs time to calibrate.
- [ ] In AdSense dashboard → Reports, verify impressions are being recorded.

---

## Phase 5 — Add cookie + ad mention to your privacy page

Legal requirement in most markets (including Morocco after the 2023 data protection update).

- [ ] Open the Payload admin (`https://mfmsport.ma/admin`) → Pages → Privacy.
- [ ] Add a section titled **"Third-party advertising"** (or equivalent in each locale) with something like:
  > "We use Google AdSense to serve advertisements. AdSense may use cookies to personalize ads based on your browsing history. You can manage your preferences through our consent banner or at [Google Ads Settings](https://adssettings.google.com)."
- [ ] Save and publish in all three locales.

---

## Phase 6 — Ongoing

- [ ] In AdSense, set a **payment threshold** and add your bank details (Settings → Payments). You only get paid after you cross $100 (or MAD equivalent).
- [ ] Add a **tax form** in AdSense (Settings → Tax info) — required before any payout.
- [ ] Check the AdSense dashboard weekly for policy notices — they email but warnings also appear in the UI.
- [ ] Monitor Google Search Console for "ads.txt issues" — if the file becomes unreachable, impressions drop.

---

## What to do if things break

**No ads appear after deploy:**
1. Confirm `NEXT_PUBLIC_ADSENSE_CLIENT_ID` is set in Vercel (Production env).
2. Redeploy — `NEXT_PUBLIC_*` vars bake in at build time, not runtime. A new env var requires a new build.
3. Check browser DevTools → Network → is `adsbygoogle.js` loading? If not, env isn't set.
4. If script loads but `<ins>` stays `unfilled` for every slot, the slot IDs in `slots.ts` are probably wrong or the ad units were deleted in AdSense.

**AdSense suspends your account:**
Stop sending traffic to the ads until resolved. Don't click your own ads — ever. Don't ask friends or family to click. Auto-suspension is triggered by invalid clicks and is painful to appeal.

**You want to temporarily disable ads (e.g., for a server issue):**
Unset `NEXT_PUBLIC_ADSENSE_CLIENT_ID` in Vercel and redeploy. All slots return `null`, zero Google requests, site keeps working.

---

## Reference links

- AdSense dashboard: [adsense.google.com](https://adsense.google.com)
- AdSense program policies: [support.google.com/adsense/answer/48182](https://support.google.com/adsense/answer/48182)
- ads.txt spec: [iabtechlab.com/ads-txt](https://iabtechlab.com/ads-txt/)
- Funding Choices setup: [support.google.com/fundingchoices](https://support.google.com/fundingchoices)
- Morocco tax guidance for AdSense: check with a local accountant — rules differ based on whether you register as a business or freelancer.
