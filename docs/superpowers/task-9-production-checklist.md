# Task 9 — Production verification checklist

**Status: NOT RUN. Deployment is a human decision.**

Branch `feat/journalist-authoring-blocks`, unpushed. Nothing here executes until someone
decides to deploy.

Every item below is written as *what to observe*, not *what to expect*, because several of the
defects on this branch were found only by looking at what a client actually received. The
project rule applies throughout: **assert on the artefact a crawler or reader receives, never on
a proxy for it.** See `docs/verification-principles.md`.

## Setup

Publish one test article containing **all** of: one tweet, one Facebook video, one Instagram
post, one Instagram **reel**, one gallery, one audio file, one content image, and one
`embedFrame`. The reel matters separately from the post — they take different aspect ratios and
that path has never been exercised end to end.

---

## 1. No third-party SDK reaches the reader

Open the article with DevTools' Network tab, unfiltered, and confirm **zero** requests to:

- [ ] `connect.facebook.net`
- [ ] `platform.twitter.com/widgets.js`

This is the load-bearing claim of the whole architecture. A single request here means an SDK
crept back in.

## 2. Tweet text is server-rendered

- [ ] View source (not the inspector — **view-source**, or `curl` the URL) and find the tweet's
      text in the HTML.

If it is only in the DevTools DOM and not in view-source, it is client-injected, and the point
of using `react-tweet` in an RSC — making tweet text indexable article content — has been lost.

## 3. Core Web Vitals, measured against a control

Run Lighthouse **mobile** twice: once on the test article, once on a **text-only article of
similar length**.

- [ ] CLS on the embed article: ______
- [ ] CLS on the control: ______
- [ ] LCP on the embed article: ______
- [ ] LCP on the control: ______

Report both numbers, not a verdict. The aspect-ratio boxes exist specifically to keep CLS flat;
if CLS is materially worse than the control, a ratio is wrong somewhere.

## 4. JavaScript budget

- [ ] Total JS transferred on the embed article: ______
- [ ] Total JS on the control: ______
- [ ] Delta: ______  **Budget: < 50 KB**

## 5. Indexation is not silently broken

- [ ] The test article's `seoTier` is correct.
- [ ] The page carries **no** `robots: noindex` meta tag.
- [ ] The article appears in `/sitemap.xml`.

Count with `grep -o … | wc -l`, never `grep -c` — the HTML is minified onto one line, and this
mistake has already produced a false result on this project.

## 6. Close the two carried gaps

These are open, known, and written down precisely so they are not forgotten.

- [ ] **Paste a real Instagram embed copied from the app.** The committed test fixture is
      *documented-format, not fetched* — both oEmbed endpoints returned an app-token wall. The
      parser's markup extraction has therefore never been tested against what a journalist
      actually copies. If it fails, the parser also accepts a bare URL, so the fallback is to
      tell journalists to paste the link — but find out which, rather than assuming.
- [ ] **Observe pixels inside our own iframe.** Framing was confirmed only at header level
      (no `X-Frame-Options`, no `frame-ancestors`) plus the absence of a browser refusal
      message. Nobody has yet *seen* an Instagram or Facebook embed painted inside an iframe on
      one of our pages.

## 7. The unconditional fallback, seen in the wild

- [ ] With a **working** embed, confirm the caption and the "شاهد على إنستغرام" link are
      **still visible** beneath the frame.

They render unconditionally by design — a deleted, privated or suspended post returns HTTP 200
and paints nothing, and that cannot be detected cross-origin. If the link only appears on
failure, the requirement has been implemented backwards.

## 8. Aspect ratios differ by content type

- [ ] The Instagram **reel** box is 9:16.
- [ ] The Instagram **post** box is 4:5.
- [ ] Neither resizes after load.

## 9. Insertion at the cursor, on a real phone

- [ ] On a **physical phone**, not an emulated viewport: place the caret mid-paragraph, insert
      a block from the toolbar, confirm it lands there and not at the end of the document.

Verified in Task 8 at a 390px viewport with the caret placed via the Selection API. A real
device with real touch input is a different thing, and it is what the journalists actually use.

- [ ] While there: **click** — do not programmatically place — the caret in the middle of an
      Arabic paragraph and confirm it lands where you tapped.

This is the open defect recorded in `CLAUDE.md`: a click computed from the paragraph's bounding
box placed the caret at paragraph *end* in the RTL editor. It is not headless-specific and was
never re-tested against a coordinate known to sit on a glyph. A phone settles it.

## 10. Error pages still carry no ads

- [ ] `curl` a 404 and count real `adsbygoogle.js` script tags: must be **0**.

Unrelated to this branch, but the ad exclusion is a property of the route tree and a merge has
tried to break it before. Cheap to re-check.

---

## If something fails

Do not improvise a fix during verification. Record what was observed and stop. Several
"corrections" on this branch turned out to be the premise being wrong rather than the code —
the quoted-tweet URL assumption and the tiering exposure both dissolved under checking.
