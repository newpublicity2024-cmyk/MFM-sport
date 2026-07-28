# Verification Principles

> **Assert on the artefact a crawler or user actually receives — not on a proxy for it.**

This document exists because of five bugs found in one SEO remediation project. Every one of them had already been "verified" by something that looked like evidence. Each was found only when someone fetched the bytes a client would actually get.

They are collected here because the pattern generalises well beyond SEO, and because the individual fixes will age out of relevance long before the habit does.

---

## The pattern

Every miss shared one shape: **a success signal that does not measure the thing.**

| What was checked | What it actually proved | What it was taken to prove |
|---|---|---|
| 200 rows exist in the redirect table | 200 rows exist | Redirects work |
| The build printed `/sitemap/0.xml` | A file was emitted | The sitemap has URLs in it |
| `sitemap.ts` has no match-page loop | The source has no loop | Match pages aren't listed |
| `grep -c adsbygoogle` returned 1 | One *line* contains that string | An ad script is executing |
| Body length computed as 0 | The measuring function returned 0 | The article has no body |

None of these are lazy checks. They are the checks a careful person makes. They fail because the gap between the proxy and the artefact is exactly where the bug lives — a bug in that gap is invisible to the proxy *by construction*.

### The rule

Ask: **what does a crawler or a user receive?** Then fetch precisely that and assert on it.

- Not "is the redirect row present" → `curl -sIL` the old URL and read the status chain.
- Not "did the build succeed" → fetch the URL and count the elements.
- Not "does the code filter X" → fetch the output and grep for X.
- Not "does the string appear" → count the *parsed construct*, not matching lines.

### Corollaries

**A green build is not a behavioural assertion.** Builds prove the code compiles and did not throw. They do not prove the output is correct, non-empty, or reachable at the URL you expect.

**Prefer diagnostic assertions.** The empty-sitemap bug was findable because that function pushes ~9 static URLs unconditionally, so *zero* URLs was impossible unless something structural had failed. If a partial failure and a total failure look the same, you cannot tell them apart. Build in a value that can only appear if the mechanism worked.

**Test the negative and the positive.** Non-whitelisted fixtures were confirmed `noindex`; whitelisted ones were only unit-tested. Half a check.

**A dry run is not a rehearsal.** The importer's dry run passed cleanly and found nothing. The first real run against a throwaway database branch found three bugs immediately — all in the steps the dry run skips (rich-text conversion, taxonomy creation, redirect writes, slug collisions). Dry runs validate parsing. They do not validate writing.

**Say "untested", not "works".** The phrasing in a report becomes the next person's premise. "A 301 map exists" reads as "redirects work". "200 rows exist; behaviour untested" invites the check that finds the bug.

---

## Worked examples

### 1. The redirect map that matched nothing

**Claimed:** the migration built a working 301 map — 200 rows, correct `to` targets, a middleware lookup, CDN caching. The recon report said "a redirect map exists" and moved on.

**Reality:** none of the 200 had ever fired.

The lookup is an exact string match. WordPress wrote permalinks percent-encoded in *lowercase* hex with a trailing slash; the platform 308-normalises incoming requests to *uppercase* hex without one. The two never matched.

```
stored:    /%d8%b9%d9%84%d8%a7%d8%a1-...-%d9%8a/
received:  /%D8%B9%D9%84%D8%A7%D8%A1-...-%D9%8A
```

**Found by:** curling one old URL and reading the chain — `308 → 307 → 200` (soft-404). A working redirect would have shown a `301` to `/ar/articles/…`.

**Cost of the proxy:** this was the single most damaging defect in the project, and it hid behind a row count for months. It also meant an importer was about to write 36,992 more rows in the same dead format.

**Fix:** `normalizeLegacyPath()` — percent-decode and strip the trailing slash, applied on *both* the write and the lookup side.

---

### 2. The sitemap that served zero URLs

**Claimed:** sharding worked — the build output listed `/sitemap/0.xml`.

**Reality:** two independent failures, and the build reported success through both.

1. `generateSitemaps()` moves the sitemap to `/sitemap/0.xml`, so **`/sitemap.xml` returned 404** — the URL `robots.txt` advertises and the one Google already had.
2. Next passes the shard id in a form that arithmetic turns into `NaN`, and `entries.slice(NaN, NaN)` is empty. Every shard served a well-formed `<urlset>` containing **zero** `<url>` elements.

**Found by:** fetching `/sitemap.xml` and `/sitemap/0.xml` and counting `<loc>`.

**Also worth noting:** the change was unnecessary. The projection that motivated sharding assumed match pages were listed; they weren't. The real ceiling was ~28,000 URLs against a 50,000 limit — a number nobody had measured either.

---

### 3. The CDATA stripper that deleted the articles

**Claimed:** 2,224 of 36,992 archived posts (6%) had empty bodies, so they should be imported as redirect-only stubs.

**Reality:** 4 posts were empty. The other 2,220 had full articles.

The length function stripped HTML tags with `/<[^>]+>/` *before* removing the CDATA wrapper. Since `<![CDATA[` opens with `<` and `]]>` closes with `>`, that pattern matches the entire section as a single "tag" and deletes the body. Posts containing HTML survived partially — the first `>` ended the match early — which is why the damage looked like a plausible 6% rather than an obvious total failure.

**Found by:** the reviewer refusing the number. *"6% empty smells like a parser miss — sample 20 against the source."* The samples showed full Arabic text in `content:encoded`.

**Generalises to:** a suspiciously round or suspiciously plausible statistic is a hypothesis, not a finding. Sample the raw records behind any number that will drive a decision.

---

### 4. The loading skeleton that broke every 404

**Claimed:** `notFound()` is called correctly throughout, so 404s return 404.

**Reality:** every 404 on the site returned **HTTP 200**.

`[locale]/loading.tsx` created a Suspense boundary that made Next flush the response shell before the page body ran, committing the status as 200. `notFound()` then rendered its page *inside* an already-committed 200 response. Google reads "200 + noindex" as "this URL is alive and deliberately hidden" — it stays in the crawl set indefinitely and passes no link equity, the exact opposite of a 404.

Nothing in the routing code was wrong. The defect was in a file that appeared to be about loading states.

**Found by:** `curl -o /dev/null -w "%{http_code}"` against a URL that should 404.

**Generalises to:** HTTP status is part of the artefact. A page that *renders* correctly can still *respond* incorrectly, and only the status line tells you.

---

### 5. `grep -c` and the ads that weren't there

**Claimed:** ads were still rendering on entity-miss 404 pages — `grep -c adsbygoogle` returned 1.

**Reality:** zero ad scripts were executing. The single match was the string appearing inside the escaped RSC flight payload — serialised data describing the route tree, not a `<script>` tag.

Two errors compounded: `grep -c` counts *matching lines*, not occurrences (and minified HTML is one line), and the match wasn't the construct being counted.

**Found by:** counting real tags with `grep -oE '<script[^>]*adsbygoogle\.js[^>]*>'`, then confirming with Playwright that the page issued **zero network requests** to `googlesyndication`.

**Generalises to:** when counting occurrences, use `grep -o | wc -l`, and match the *parsed construct*, not a substring that can appear in serialised data, comments, or payloads. Where possible, assert on behaviour (a network request) rather than on markup.

---

## Practical checklist

Before claiming something works:

- [ ] Did I fetch the artefact, or infer from the source?
- [ ] Does my assertion distinguish partial success from total failure?
- [ ] Did I check the HTTP status, not just the rendered body?
- [ ] If I counted, did I count the construct — `grep -o | wc -l`, not `grep -c`?
- [ ] Did I test the positive case *and* the negative case?
- [ ] If it writes to a database, did I run it for real against a throwaway branch?
- [ ] If I'm reporting a number that drives a decision, did I sample the raw records behind it?
- [ ] Is my report worded as "tested" only where it was tested?

---

## When a proxy is fine

This is not an argument for end-to-end testing everything. Proxies are cheap and usually correct; that is why they are seductive.

Spend the real check when:

- **The blast radius is large** — anything touching every URL: redirects, canonicals, sitemaps, status codes, robots directives.
- **The failure is silent** — no exception, no failed build, no alert. Ask: *if this were broken, what would tell me?* If the honest answer is "nothing", that is precisely where to look.
- **A number will drive a decision** — before it becomes someone's premise.
- **You are about to scale it** — a defect at 200 rows is a nuisance; the same defect at 37,000 is the project.
