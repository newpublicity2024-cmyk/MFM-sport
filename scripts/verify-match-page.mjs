#!/usr/bin/env node
/**
 * Oracles for the match-page pre-match blocks (September 2026). Each mode
 * prints a success-only marker after every assertion passes and exits 1
 * otherwise. Served modes read the bytes a crawler gets, never the source.
 *
 *   node scripts/verify-match-page.mjs lint            → LINT CLEAN
 *   node scripts/verify-match-page.mjs tests           → SUITE OK
 *   node scripts/verify-match-page.mjs served-page     → SERVED-PAGE OK
 *   node scripts/verify-match-page.mjs served-blocks   → SERVED-BLOCKS OK
 *   node scripts/verify-match-page.mjs served-gate     → SERVED-GATE OK
 *   node scripts/verify-match-page.mjs served-links    → SERVED-LINKS OK
 *   node scripts/verify-match-page.mjs served-sitemap  → SERVED-SITEMAP OK
 *
 * Served modes take BASE_URL (default https://www.mfmsport.ma). The fixture
 * under test is discovered from /api/fixtures/date (a finished, indexable
 * fixture in a league with a table, from the last few days) unless FIXTURE_ID
 * is set. NOINDEX_FIXTURE_ID (default 1234567, a non-league English fixture)
 * is the positive control for the noindex gate and is itself checked against
 * the API before it is trusted.
 *
 * Portable: Node only, no grep/sed.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
const BASE = (process.env.BASE_URL ?? "https://www.mfmsport.ma").replace(/\/$/, "");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}
function count(haystack, re) {
  return (haystack.match(re) ?? []).length;
}

// Mirrors lib/seo/matchIndexing.ts, read from source so the two cannot drift.
function indexableLeagueIds() {
  const src = read("src/lib/seo/matchIndexing.ts");
  const block = /INDEXABLE_LEAGUE_IDS = new Set<number>\(\[([\s\S]*?)\]\)/.exec(src);
  if (!block) fail("could not read INDEXABLE_LEAGUE_IDS from source");
  const ids = [...block[1].matchAll(/^\s*(\d+),/gm)].map((m) => Number(m[1]));
  if (ids.length < 10) fail(`only ${ids.length} indexable league ids parsed`);
  return new Set(ids);
}
function isIndexable(fx, ids) {
  if (ids.has(fx.league.id)) return true;
  const country = (fx.league.country ?? "").trim().toLowerCase();
  if (["morocco", "maroc", "المغرب"].includes(country)) return true;
  return /^morocco(\s|$)|^maroc(\s|$)/i.test(fx.teams.home.name) ||
    /^morocco(\s|$)|^maroc(\s|$)/i.test(fx.teams.away.name);
}

async function get(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "mfm-verify/1.0" },
    ...init,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

async function fixtureJson(id) {
  const r = await get(`/api/fixtures/${id}`);
  if (r.status !== 200) return null;
  return JSON.parse(r.text).fixture;
}

// Leagues whose table the excerpt can show — round-robin leagues we index.
const TABLE_LEAGUES = new Set([39, 61, 78, 135, 140, 200, 201]);

async function discoverFixture() {
  if (process.env.FIXTURE_ID) {
    const fx = await fixtureJson(process.env.FIXTURE_ID);
    if (!fx) fail(`FIXTURE_ID ${process.env.FIXTURE_ID} is not a fixture`);
    return fx;
  }
  const ids = indexableLeagueIds();
  for (let back = 1; back <= 10; back++) {
    const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
    const r = await get(`/api/fixtures/date?date=${d}`);
    if (r.status !== 200) continue;
    const { fixtures } = JSON.parse(r.text);
    const pick = fixtures.find(
      (f) => f.fixture.status.short === "FT" && TABLE_LEAGUES.has(f.league.id) && isIndexable(f, ids),
    );
    if (pick) return pick;
  }
  fail("no finished indexable league fixture found in the last 10 days; set FIXTURE_ID");
}

/** The text from `startMarker` up to the next `nextMarker` after it (or the end); null if absent. */
function sliceBetween(text, startMarker, nextMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return null;
  nextMarker.lastIndex = start + startMarker.length;
  const next = nextMarker.exec(text);
  return text.slice(start, next ? next.index : undefined);
}

function casablancaTime(iso) {
  return new Intl.DateTimeFormat("ar-MA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Casablanca",
  }).format(new Date(iso));
}

if (mode === "lint" || mode === "tests") {
  const version = execFileSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" }).trim();
  const pinned = /"packageManager":\s*"pnpm@([\d.]+)"/.exec(read("package.json"))?.[1];
  if (version !== pinned) fail(`pnpm ${version} running, package.json pins ${pinned}`);
  const args = mode === "lint" ? ["exec", "eslint", "."] : ["exec", "vitest", "run", "--config", "vitest.config.ts"];
  const res = spawnSync("pnpm", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = `${res.stdout}\n${res.stderr}`;
  if (mode === "lint") {
    const m = /✖ \d+ problems \((\d+) errors?, \d+ warnings?\)/.exec(out);
    const errors = m ? Number(m[1]) : /^\s*$/.test(res.stdout ?? "") ? 0 : NaN;
    if (Number.isNaN(errors)) fail(`could not read the eslint summary:\n${out.slice(-2000)}`);
    if (errors !== 0) fail(`eslint reports ${errors} errors`);
    console.log(`eslint errors: ${errors}`);
    console.log("LINT CLEAN");
  } else {
    const m = /Tests\s+(\d+) passed \((\d+)\)/.exec(out);
    if (res.status !== 0 || !m) fail(`vitest did not pass:\n${out.slice(-3000)}`);
    const passed = Number(m[1]);
    const total = Number(m[2]);
    if (/Test Files\s+\d+ failed|Tests\s+\d+ failed/.test(out)) fail("vitest summary reports failures");
    if (passed !== total) fail(`${passed}/${total} tests passed`);
    const floor = Number(process.env.TEST_FLOOR ?? "691");
    if (total < floor) fail(`only ${total} tests ran; the pre-change suite had ${floor}`);
    console.log(`vitest: ${passed}/${total} passed`);
    console.log("SUITE OK");
  }
} else if (mode === "served-page") {
  // H1, <time>, JSON-LD, kickoff in Casablanca time, one ads loader, ISR.
  const fx = await discoverFixture();
  const id = fx.fixture.id;
  const page = await get(`/ar/matches/${id}`);
  if (page.status !== 200) fail(`/ar/matches/${id} → ${page.status}`);
  const html = page.text;

  const h1s = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) ?? [];
  if (h1s.length !== 1) fail(`${h1s.length} <h1> on the page, expected 1`);
  // Both names must be in the H1 — Arabic (no Latin letters).
  const h1Text = h1s[0].replace(/<[^>]+>/g, "");
  if (/[A-Za-z]/.test(h1Text)) fail(`H1 contains Latin letters: ${h1Text}`);
  if (!/ضد/.test(h1Text)) fail(`H1 is not "home ضد away": ${h1Text}`);

  const times = [...html.matchAll(/<time[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/gi)];
  if (times.length !== 1) fail(`${times.length} <time datetime> elements, expected 1`);
  const [, dt, inner] = times[0];
  if (new Date(dt).getTime() !== new Date(fx.fixture.date).getTime()) {
    fail(`<time datetime="${dt}"> is not the fixture instant ${fx.fixture.date}`);
  }
  const expected = casablancaTime(fx.fixture.date);
  const timeText = inner.replace(/<[^>]+>/g, "");
  if (!timeText.includes(expected)) {
    fail(`visible kickoff "${timeText}" does not contain Casablanca time "${expected}" for ${fx.fixture.date}`);
  }
  // Negative control for the timezone check: the UTC rendering must differ
  // from the Casablanca one on this date, or the assertion proves nothing.
  const utc = new Intl.DateTimeFormat("ar-MA", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(fx.fixture.date));
  if (utc === expected) console.log(`note: UTC and Casablanca agree at ${expected} on this date (Ramadan window?) — timezone check is not discriminating today`);

  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (ld.length !== 1) fail(`${ld.length} JSON-LD scripts, expected 1`);
  let data;
  try {
    data = JSON.parse(ld[0][1]);
  } catch (e) {
    fail(`JSON-LD does not parse: ${e.message}`);
  }
  const graph = Array.isArray(data) ? data : data["@graph"] ?? [data];
  const event = graph.find((n) => n["@type"] === "SportsEvent");
  if (!event) fail("no SportsEvent in JSON-LD");
  if (!/^https:\/\/schema\.org\/Event(Scheduled|Postponed|Cancelled|Rescheduled)$/.test(event.eventStatus ?? "")) {
    fail(`SportsEvent.eventStatus is ${event.eventStatus}`);
  }
  const st = fx.fixture.status.short;
  const want = st === "PST" ? "EventPostponed" : ["CANC", "ABD"].includes(st) ? "EventCancelled" : "EventScheduled";
  if (!event.eventStatus.endsWith(want)) fail(`eventStatus ${event.eventStatus} for API status ${st}, expected ${want}`);
  if (new Date(event.startDate).getTime() !== new Date(fx.fixture.date).getTime()) fail("SportsEvent.startDate ≠ fixture date");
  if (!graph.find((n) => n["@type"] === "BreadcrumbList")) fail("no BreadcrumbList in JSON-LD");
  if (/undefined|null/.test(ld[0][1].replace(/"[^"]*"/g, ""))) fail("JSON-LD contains undefined/null values");

  const ads = count(html, /<script[^>]*adsbygoogle\.js/g);
  if (ads !== 1) fail(`${ads} adsbygoogle loader tags, expected 1`);

  const second = await get(`/ar/matches/${id}`);
  const cache = second.headers.get("x-vercel-cache");
  if (!["HIT", "STALE"].includes(cache ?? "")) fail(`second request x-vercel-cache=${cache}, expected HIT/STALE (ISR off?)`);

  console.log(`fixture ${id}: ${fx.teams.home.name} v ${fx.teams.away.name} (${fx.league.name}, ${st}); kickoff ${expected}`);
  console.log("SERVED-PAGE OK");
} else if (mode === "served-blocks") {
  // Standings excerpt window, highlighted rows, results and H2H blocks.
  const fx = await discoverFixture();
  const id = fx.fixture.id;
  const page = await get(`/ar/matches/${id}`);
  if (page.status !== 200) fail(`/ar/matches/${id} → ${page.status}`);
  const html = page.text;

  // Blocks are sibling <section data-block> elements rendered in sequence, so a
  // block's markup runs from its marker to the next marker (or the end).
  const block = (name) => sliceBetween(html, `data-block="${name}"`, /data-block="/g);
  const standings = block("standings");
  if (!standings) fail("no data-block=\"standings\" on a league fixture page");
  const bodyRows = count(standings, /<tr[^>]*data-rank=/g);
  if (bodyRows < 3 || bodyRows > 6) fail(`standings excerpt has ${bodyRows} team rows, expected 3–6`);
  const current = count(standings, /aria-current="true"/g);
  if (current !== 2) fail(`${current} highlighted standings rows, expected 2`);
  if (!/<caption/.test(standings)) fail("standings excerpt has no <caption>");
  if (count(standings, /<th[^>]*scope="col"/g) < 8) fail("standings excerpt headers lack scope=\"col\"");
  // Excerpt, not the whole table: the full competition table is ≥ 16 rows.
  if (count(html, /<tr[^>]*data-rank=/g) !== bodyRows) fail("more ranked rows outside the excerpt — full table leaked?");

  const results = block("results");
  if (!results) fail("no data-block=\"results\"");
  const badges = count(results, /data-result="[WDL]"/g);
  if (badges < 2) fail(`only ${badges} result badges in recent results`);
  // Derived stats must be x/N with N = number of rendered rows with a result, per column.
  const cols = ["home", "away"]
    .map((side) => [side, sliceBetween(results, `data-form-column="${side}"`, /data-form-column="/g)])
    .filter(([, col]) => col !== null);
  if (cols.length !== 2) fail(`${cols.length} form columns, expected 2`);
  for (const [side, col] of cols) {
    const n = count(col, /data-result="[WDL]"/g);
    const stats = [...col.matchAll(/data-stat="[A-Za-z0-9]+" data-value="(\d+)\/(\d+)"/g)];
    if (stats.length !== 3) fail(`${side}: ${stats.length} stat rows, expected 3`);
    for (const [, num, den] of stats) {
      if (Number(den) !== n) fail(`${side}: stat denominator ${den} ≠ ${n} rendered results`);
      if (Number(num) > Number(den)) fail(`${side}: stat ${num}/${den} exceeds its denominator`);
    }
  }

  const h2h = block("h2h");
  if (h2h === null) console.log("note: no H2H block (first meeting?) — allowed");
  else {
    const counters = [...h2h.matchAll(/data-h2h="(winsA|draws|winsB)" data-value="(\d+)"/g)];
    if (counters.length !== 3) fail(`${counters.length} H2H counters, expected 3`);
    const rows = count(h2h, /data-h2h-row/g);
    const sum = counters.reduce((a, [, , v]) => a + Number(v), 0);
    if (sum !== rows) fail(`H2H counters sum ${sum} ≠ ${rows} rendered meetings`);
  }
  console.log(`fixture ${id}: standings rows=${bodyRows}, badges=${badges}, h2h=${h2h ? "yes" : "no"}`);
  console.log("SERVED-BLOCKS OK");
} else if (mode === "served-gate") {
  // Indexation gate unchanged: non-whitelisted → 200 + noindex,follow; bad id → 404;
  // whitelisted → no robots meta (positive control).
  const ids = indexableLeagueIds();
  const noindexId = process.env.NOINDEX_FIXTURE_ID ?? "1234567";
  const control = await fixtureJson(noindexId);
  if (!control) fail(`NOINDEX_FIXTURE_ID ${noindexId} is not a fixture`);
  if (isIndexable(control, ids)) fail(`NOINDEX_FIXTURE_ID ${noindexId} is indexable (${control.league.name}) — pick another control`);
  const nx = await get(`/ar/matches/${noindexId}`);
  if (nx.status !== 200) fail(`non-whitelisted fixture → ${nx.status}, expected 200`);
  if (!/<meta name="robots" content="noindex, follow"\/?>/.test(nx.text)) fail("non-whitelisted fixture lacks noindex, follow");

  const fx = await discoverFixture();
  const ok = await get(`/ar/matches/${fx.fixture.id}`);
  if (ok.status !== 200) fail(`whitelisted fixture → ${ok.status}`);
  if (/<meta name="robots" content="noindex/.test(ok.text)) fail("whitelisted fixture carries noindex");

  const bad = await get(`/ar/matches/999999999`);
  if (bad.status !== 404) fail(`unknown fixture id → ${bad.status}, expected 404`);
  if (!/<meta name="robots" content="noindex/.test(bad.text)) fail("404 page lacks noindex");
  const badAds = count(bad.text, /<script[^>]*adsbygoogle\.js/g);
  if (badAds !== 0) fail(`${badAds} ads loaders on the 404 page`);
  // Pre-existing, site-wide (21 Sep 2026): entity-miss 404s render Next's
  // `__next_error__` shell with no lang/dir and an empty body; the Arabic
  // not-found UI arrives only through the RSC payload. Reported, not gated here.
  if (!/<html[^>]*dir="rtl"/.test(bad.text)) console.log("note: entity-miss 404 <html> carries no dir=\"rtl\" (pre-existing defect, see CLAUDE.md)");
  console.log("SERVED-GATE OK");
} else if (mode === "served-links") {
  // Every match link inside the new blocks targets an indexable fixture.
  const ids = indexableLeagueIds();
  const fx = await discoverFixture();
  const page = await get(`/ar/matches/${fx.fixture.id}`);
  if (page.status !== 200) fail(`/ar/matches/${fx.fixture.id} → ${page.status}`);
  const blocks = ["results", "h2h"]
    .map((name) => sliceBetween(page.text, `data-block="${name}"`, /data-block="/g))
    .filter((b) => b !== null);
  if (blocks.length === 0) fail("no results/h2h blocks to inspect");
  const links = new Set();
  let plain = 0;
  for (const b of blocks) {
    for (const m of b.matchAll(/href="\/ar\/matches\/(\d+)"/g)) links.add(m[1]);
    plain += count(b, /data-unlinked-fixture="\d+"/g);
  }
  if (links.size + plain === 0) fail("no fixture rows found in the blocks");
  for (const id of links) {
    const f = await fixtureJson(id);
    if (!f) fail(`linked fixture ${id} does not resolve`);
    if (!isIndexable(f, ids)) fail(`linked fixture ${id} (${f.league.name}) is not indexable — crawl path into noindex`);
  }
  console.log(`links=${links.size} (all indexable), unlinked rows=${plain}`);
  if (plain === 0) console.log("note: no unlinked row on this page — the negative branch was not exercised here; unit tests cover it");
  console.log("SERVED-LINKS OK");
} else if (mode === "served-sitemap") {
  const sm = await get(`/sitemap.xml`);
  if (sm.status !== 200) fail(`/sitemap.xml → ${sm.status}`);
  const locs = count(sm.text, /<loc>/g);
  if (locs < 1000) fail(`sitemap has only ${locs} locs`);
  const matchLocs = count(sm.text, /\/ar\/matches\/\d+<\/loc>/g);
  if (matchLocs !== 0) fail(`${matchLocs} match pages in the sitemap, expected 0`);
  // Positive control: the pattern must match a synthetic loc.
  if (count("<loc>https://www.mfmsport.ma/ar/matches/123</loc>", /\/ar\/matches\/\d+<\/loc>/g) !== 1) fail("match-loc pattern is broken");
  console.log(`sitemap locs=${locs}, match locs=${matchLocs}`);
  console.log("SERVED-SITEMAP OK");
} else {
  fail(`unknown mode "${mode}"`);
}
