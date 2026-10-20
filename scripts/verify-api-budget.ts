/**
 * scripts/verify-api-budget.ts
 *
 * Measures how many API-Football requests the data layer actually issues, by
 * stubbing `fetch` and counting. Every subcommand prints a success-only marker
 * and exits non-zero on the first failed assertion, so it can back a gate.
 *
 * Why this exists rather than a unit test: the defect being guarded against is
 * not "a function returns the wrong value", it is "a correct-looking getter
 * reaches the network more often than its declared TTL allows". That is a
 * property of the composed module graph — getter, React cache(), memo tier,
 * Redis tier, fetch — so it is measured through the real modules end to end.
 *
 *   pnpm exec tsx scripts/verify-api-budget.ts <env|breaker|dedupe|ttl|home|match|date-route|suite|all>
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CacheRedis } from "../src/lib/cache";

// ---------------------------------------------------------------------------
// assertion helpers
// ---------------------------------------------------------------------------

let checks = 0;

function assert(condition: boolean, message: string): void {
  checks += 1;
  if (!condition) {
    console.error(`  FAIL ${message}`);
    process.exit(1);
  }
  console.log(`  ok   ${message}`);
}

function assertEq(actual: unknown, expected: unknown, message: string): void {
  assert(
    actual === expected,
    `${message} (expected ${String(expected)}, got ${String(actual)})`,
  );
}

// ---------------------------------------------------------------------------
// fetch recorder
// ---------------------------------------------------------------------------

type Recorded = { url: string; revalidate: number | undefined };

type NextInit = RequestInit & { next?: { revalidate?: number } };

const realFetch = globalThis.fetch;

function payloadFor(url: string): unknown {
  if (url.includes("/leagues")) {
    return [
      {
        league: { id: 39, name: "Premier League", type: "League" },
        seasons: [
          { year: 2025, current: false, start: null, end: null },
          { year: 2026, current: true, start: "2026-08-01", end: "2027-05-01" },
        ],
      },
    ];
  }
  if (url.includes("/standings")) {
    return [{ league: { id: 39, season: 2026, standings: [[]] } }];
  }
  return []; // /fixtures and /fixtures/headtohead — the count is what matters
}

function recordFetch(): { calls: Recorded[]; restore(): void } {
  const calls: Recorded[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: NextInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, revalidate: init?.next?.revalidate });
    return new Response(
      JSON.stringify({ response: payloadFor(url), errors: [] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = realFetch;
    },
  };
}

function countMatching(calls: Recorded[], needle: string): number {
  return calls.filter((c) => c.url.includes(needle)).length;
}

/** `/fixtures?...` but not `/fixtures/headtohead`. */
function countPlainFixtures(calls: Recorded[]): number {
  return calls.filter(
    (c) => c.url.includes("/fixtures?") && !c.url.includes("headtohead"),
  ).length;
}

process.env.API_FOOTBALL_KEY ||= "verify-api-budget-key";

// Keep Redis out of every scenario except the breaker one, which supplies its
// own fake client. A real client here would make these measurements depend on
// whatever store the developer happens to have configured.
function clearRedisEnv(): void {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}

// ---------------------------------------------------------------------------
// env — G1
// ---------------------------------------------------------------------------

async function checkEnv(): Promise<void> {
  const { hasUpstash, upstashCredentials } = await import("../src/lib/cache");

  clearRedisEnv();
  assertEq(hasUpstash(), false, "no credentials at all → hasUpstash() false");

  clearRedisEnv();
  process.env.KV_REST_API_URL = "https://kv.example.upstash.io";
  assertEq(
    hasUpstash(),
    false,
    "a URL with no token is not a credential pair → false",
  );

  clearRedisEnv();
  process.env.KV_REST_API_URL = "https://kv.example.upstash.io";
  process.env.KV_REST_API_TOKEN = "kv-token";
  assertEq(
    hasUpstash(),
    true,
    "Vercel's KV_REST_API_* pair is recognised → true",
  );
  assertEq(
    upstashCredentials()?.url,
    "https://kv.example.upstash.io",
    "KV_REST_API_URL is the url it reports",
  );

  clearRedisEnv();
  process.env.UPSTASH_REDIS_REST_URL = "https://native.example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "native-token";
  assertEq(
    hasUpstash(),
    true,
    "Upstash's own UPSTASH_REDIS_REST_* pair still works → true",
  );

  // Both present: the native pair wins, so an explicit override is possible.
  process.env.KV_REST_API_URL = "https://kv.example.upstash.io";
  process.env.KV_REST_API_TOKEN = "kv-token";
  assertEq(
    upstashCredentials()?.url,
    "https://native.example.upstash.io",
    "with both pairs set, UPSTASH_* takes precedence",
  );

  clearRedisEnv();
  console.log("ENV GATE OK");
}

// ---------------------------------------------------------------------------
// breaker — G2
// ---------------------------------------------------------------------------

async function checkBreaker(): Promise<void> {
  const {
    withBreaker,
    makeCachedJson,
    REDIS_BREAKER_FAILURE_THRESHOLD,
    REDIS_BREAKER_COOLDOWN_MS,
  } = await import("../src/lib/cache");

  let clientCalls = 0;
  const deadRedis: CacheRedis = {
    get: async () => {
      clientCalls += 1;
      throw new Error("ENOTFOUND possible-seasnail-120719.upstash.io");
    },
    set: async () => {
      clientCalls += 1;
      throw new Error("ENOTFOUND possible-seasnail-120719.upstash.io");
    },
    del: async () => {
      clientCalls += 1;
      throw new Error("ENOTFOUND possible-seasnail-120719.upstash.io");
    },
  };

  let clock = 1_000_000;
  const breakered = withBreaker(deadRedis, { now: () => clock });
  const cachedJson = makeCachedJson(breakered);

  let fetcherCalls = 0;
  const fetcher = async () => {
    fetcherCalls += 1;
    return ["value"];
  };

  const ROUNDS = 25;
  for (let i = 0; i < ROUNDS; i++) {
    const out = await cachedJson(`key:${i}`, { ttlSeconds: 60 }, fetcher);
    assert(
      Array.isArray(out) && out[0] === "value",
      i === 0
        ? "a dead store still yields the fetcher's value"
        : `round ${i} still yields the fetcher's value`,
    );
  }

  assertEq(
    fetcherCalls,
    ROUNDS,
    "every round resolved through the fetcher, never an error",
  );
  assertEq(
    clientCalls,
    REDIS_BREAKER_FAILURE_THRESHOLD,
    `a dead store is consulted exactly ${REDIS_BREAKER_FAILURE_THRESHOLD} times across ${ROUNDS} rounds, then skipped`,
  );
  assert(
    breakered.breaker.openedUntil > clock,
    "the breaker is open and has a future reopen time",
  );

  // It is a cooldown, not a permanent off: past it, one probe is allowed again.
  const beforeProbe = clientCalls;
  clock += REDIS_BREAKER_COOLDOWN_MS + 1;
  await cachedJson("key:after-cooldown", { ttlSeconds: 60 }, fetcher);
  assert(
    clientCalls > beforeProbe,
    "after the cooldown the store is probed again rather than written off",
  );

  console.log("BREAKER GATE OK");
}

// ---------------------------------------------------------------------------
// dedupe — G3
// ---------------------------------------------------------------------------

async function checkDedupe(): Promise<void> {
  clearRedisEnv();
  const { resetCacheTiers } = await import("../src/lib/cache");
  const { getCurrentSeason } = await import("../src/lib/api-football/season");

  resetCacheTiers();
  const rec = recordFetch();

  const REPEATS = 5;
  for (let i = 0; i < REPEATS; i++) await getCurrentSeason(39, 2025);
  assertEq(
    countMatching(rec.calls, "/leagues"),
    1,
    `${REPEATS} identical reads inside the TTL reach upstream once`,
  );

  // Concurrent readers of a cold key must share one request, not race.
  resetCacheTiers();
  rec.calls.length = 0;
  await Promise.all([
    getCurrentSeason(140, 2025),
    getCurrentSeason(140, 2025),
    getCurrentSeason(140, 2025),
  ]);
  assertEq(
    countMatching(rec.calls, "/leagues"),
    1,
    "three concurrent readers of a cold key share one upstream request",
  );

  // POSITIVE CONTROL: the same counting logic against a path with no memo must
  // see every repeat. Without this, "1 call" could just mean the detector is
  // blind.
  const { makeCachedJson } = await import("../src/lib/cache");
  const { fetchApi } = await import("../src/lib/api-football/client");
  const uncached = makeCachedJson(null);
  rec.calls.length = 0;
  for (let i = 0; i < REPEATS; i++) {
    await uncached("control", { ttlSeconds: 60 }, () =>
      fetchApi("/leagues", { id: 39 }, { revalidate: 60 }),
    );
  }
  assertEq(
    countMatching(rec.calls, "/leagues"),
    REPEATS,
    `control: an unmemoised path repeats all ${REPEATS} times, so the detector can see repeats`,
  );

  rec.restore();
  console.log("DEDUPE GATE OK");
}

// ---------------------------------------------------------------------------
// ttl — G4
// ---------------------------------------------------------------------------

async function checkTtl(): Promise<void> {
  clearRedisEnv();
  const { resetCacheTiers } = await import("../src/lib/cache");
  const { TTL } = await import("../src/lib/api-football/ttl");
  const fixtures = await import("../src/lib/api-football/fixtures");
  const { getStandingsGroups } = await import("../src/lib/api-football/standings");
  const { getHeadToHead } = await import("../src/lib/api-football/headToHead");
  const { getCurrentSeason } = await import("../src/lib/api-football/season");

  const rec = recordFetch();

  // Each entry: a cold read, and the age the table says that read may have.
  const cases: { label: string; run: () => Promise<unknown>; expected: number }[] = [
    { label: "getFixtureById", run: () => fixtures.getFixtureById(1), expected: TTL.FIXTURE_BY_ID },
    { label: "getLiveFixtures", run: () => fixtures.getLiveFixtures(), expected: TTL.LIVE_ALL },
    {
      label: "getFixturesByDate (today)",
      run: () => fixtures.getFixturesByDate(new Date().toISOString().slice(0, 10)),
      expected: TTL.DATE_TODAY,
    },
    {
      label: "getFixturesByDate (other day)",
      run: () => fixtures.getFixturesByDate("2026-01-02"),
      expected: TTL.DATE_OTHER,
    },
    {
      label: "getFixturesByLeague",
      run: () => fixtures.getFixturesByLeague(39, 2026),
      expected: TTL.LEAGUE_SEASON,
    },
    {
      label: "getTeamRecentFixtures",
      run: () => fixtures.getTeamRecentFixtures(33, 6),
      expected: TTL.TEAM_FIXTURES,
    },
    {
      label: "getStandingsGroups (page reader)",
      run: () => getStandingsGroups(39, 2026),
      expected: TTL.STANDINGS,
    },
    {
      label: "getStandingsGroups (live reader)",
      run: () => getStandingsGroups(140, 2026, { maxAgeSeconds: TTL.STANDINGS_LIVE }),
      expected: TTL.STANDINGS_LIVE,
    },
    { label: "getHeadToHead", run: () => getHeadToHead(33, 34, 6), expected: TTL.HEAD_TO_HEAD },
    { label: "getCurrentSeason", run: () => getCurrentSeason(78, 2026), expected: TTL.CURRENT_SEASON },
  ];

  for (const c of cases) {
    resetCacheTiers();
    rec.calls.length = 0;
    await c.run();
    assertEq(rec.calls.length, 1, `${c.label}: issues exactly one cold request`);
    assertEq(
      rec.calls[0]!.revalidate,
      c.expected,
      `${c.label}: the fetch carries the age declared in ttl.ts`,
    );
  }

  rec.restore();
  console.log("TTL GATE OK");
}

// ---------------------------------------------------------------------------
// home — G5
// ---------------------------------------------------------------------------

/** The four big-five leagues the homepage hero panel is configured with. */
const HERO = [39, 140, 135, 78].map((id) => ({ apiFootballId: id, season: 2026 }));

async function checkHome(): Promise<void> {
  clearRedisEnv();
  const { resetCacheTiers, makeCachedJson } = await import("../src/lib/cache");
  const { getCompetitionFixtures } = await import("../src/lib/api-football/competition");
  const { getFixturesByDate } = await import("../src/lib/api-football/fixtures");
  const { fetchApi } = await import("../src/lib/api-football/client");

  const today = new Date().toISOString().slice(0, 10);
  resetCacheTiers();
  const rec = recordFetch();

  // One homepage render: a season per hero league (each needing its season
  // resolved first), plus today's fixtures across every listed league.
  async function renderHomepageFixtureLayer(): Promise<void> {
    await Promise.all([
      Promise.all(HERO.map((c) => getCompetitionFixtures(c))),
      getFixturesByDate(today),
    ]);
  }

  await renderHomepageFixtureLayer();
  const cold = rec.calls.length;
  const coldLeagues = countMatching(rec.calls, "/leagues");
  const coldFixtures = countPlainFixtures(rec.calls);

  assertEq(coldLeagues, HERO.length, "cold render: one season lookup per hero league");
  assertEq(
    coldFixtures,
    HERO.length + 1,
    "cold render: one fixture list per hero league plus one for today",
  );
  assertEq(cold, 2 * HERO.length + 1, "cold render issues 9 upstream requests in total");

  rec.calls.length = 0;
  await renderHomepageFixtureLayer();
  assertEq(
    rec.calls.length,
    0,
    "a second render inside the TTL window issues no upstream request at all",
  );

  // POSITIVE CONTROL: the same counter against an unmemoised composition must
  // see the second render repeat everything.
  const uncached = makeCachedJson(null);
  const renderControl = () =>
    Promise.all(
      HERO.map((c) =>
        uncached(`control:lg:${c.apiFootballId}`, { ttlSeconds: 900 }, () =>
          fetchApi("/fixtures", { league: c.apiFootballId, season: 2026 }, { revalidate: 900 }),
        ),
      ),
    );
  await renderControl();
  rec.calls.length = 0;
  await renderControl();
  assertEq(
    countPlainFixtures(rec.calls),
    HERO.length,
    "control: an unmemoised second render repeats every request",
  );

  rec.restore();
  console.log("HOME GATE OK");
}

// ---------------------------------------------------------------------------
// match — G6
// ---------------------------------------------------------------------------

async function checkMatch(): Promise<void> {
  clearRedisEnv();
  const { resetCacheTiers, makeCachedJson } = await import("../src/lib/cache");
  const { getFixtureById } = await import("../src/lib/api-football/fixtures");
  const { fetchApi } = await import("../src/lib/api-football/client");

  resetCacheTiers();
  const rec = recordFetch();

  // A match page resolves the fixture twice per request: once in
  // generateMetadata and once in the body. React's cache() does not span those
  // two passes (verified: it does not memoise outside a single render), which
  // is why production logged two identical /fixtures?id= calls under one
  // request id. They must now collapse to one.
  await getFixtureById(1550109); // generateMetadata pass
  await getFixtureById(1550109); // body pass

  assertEq(
    countPlainFixtures(rec.calls),
    1,
    "metadata pass + body pass issue exactly one /fixtures?id= request",
  );

  // POSITIVE CONTROL
  const uncached = makeCachedJson(null);
  rec.calls.length = 0;
  for (let i = 0; i < 2; i++) {
    await uncached("control:fx", { ttlSeconds: 30 }, () =>
      fetchApi("/fixtures", { id: 1550109 }, { revalidate: 30 }),
    );
  }
  assertEq(
    countPlainFixtures(rec.calls),
    2,
    "control: without the memo the two passes issue two requests",
  );

  rec.restore();
  console.log("MATCH GATE OK");
}

// ---------------------------------------------------------------------------
// date-route — G7
// ---------------------------------------------------------------------------

async function checkDateRoute(): Promise<void> {
  clearRedisEnv();
  const { resetCacheTiers, makeCachedJson } = await import("../src/lib/cache");
  const { getFixturesByDateForLeagues } = await import("../src/lib/api-football/fixtures");
  const { fetchApi } = await import("../src/lib/api-football/client");

  // The Payload league-id read the route also performs is a database call, not
  // an API-Football one, so it is deliberately not part of this measurement.
  const LEAGUES = [200, 39];
  const DATE = "2026-11-27";

  resetCacheTiers();
  const rec = recordFetch();

  await getFixturesByDateForLeagues(DATE, LEAGUES);
  assertEq(countPlainFixtures(rec.calls), 1, "first request for a date reaches upstream once");

  rec.calls.length = 0;
  await getFixturesByDateForLeagues(DATE, LEAGUES);
  await getFixturesByDateForLeagues(DATE, LEAGUES);
  assertEq(
    countPlainFixtures(rec.calls),
    0,
    "two further requests for the same date issue no upstream request",
  );

  // POSITIVE CONTROL
  const uncached = makeCachedJson(null);
  rec.calls.length = 0;
  for (let i = 0; i < 2; i++) {
    await uncached("control:date", { ttlSeconds: 1800 }, () =>
      fetchApi("/fixtures", { date: DATE }, { revalidate: 1800 }),
    );
  }
  assertEq(
    countPlainFixtures(rec.calls),
    2,
    "control: without the memo each request reaches upstream",
  );

  rec.restore();
  console.log("DATE-ROUTE GATE OK");
}

// ---------------------------------------------------------------------------
// suite — G10
// ---------------------------------------------------------------------------

/**
 * A floor, not the expected count. It exists only to catch the failure mode
 * this repo has already shipped once: a runner that exits 0 without executing
 * anything. The real assertion is that nothing failed.
 */
const MIN_EXPECTED_TESTS = 800;

function checkSuite(): void {
  const dir = mkdtempSync(join(tmpdir(), "api-budget-"));
  const out = join(dir, "vitest.json");
  try {
    const res = spawnSync(
      "pnpm",
      ["exec", "vitest", "run", "--config", "vitest.config.ts", "--reporter=json", `--outputFile=${out}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15 * 60_000 },
    );

    let report: {
      numTotalTests?: number;
      numPassedTests?: number;
      numFailedTests?: number;
    };
    try {
      report = JSON.parse(readFileSync(out, "utf8"));
    } catch {
      console.error("  FAIL vitest produced no parseable JSON report");
      console.error((res.stderr || res.stdout || "").slice(-2000));
      process.exit(1);
    }

    const total = report.numTotalTests ?? 0;
    const passed = report.numPassedTests ?? 0;
    const failed = report.numFailedTests ?? 0;

    if (failed > 0) {
      console.error(`  FAIL ${failed} test(s) failed`);
      console.error((res.stdout || "").slice(-4000));
      process.exit(1);
    }
    assertEq(failed, 0, "no test failed");
    assertEq(passed, total, "every test that ran passed");
    assert(
      total >= MIN_EXPECTED_TESTS,
      `the runner actually executed tests (${total} >= ${MIN_EXPECTED_TESTS} floor)`,
    );
    assertEq(res.status, 0, "vitest exited 0");

    console.log(`SUITE GATE OK (${total} tests)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------

const COMMANDS: Record<string, () => void | Promise<void>> = {
  env: checkEnv,
  breaker: checkBreaker,
  dedupe: checkDedupe,
  ttl: checkTtl,
  home: checkHome,
  match: checkMatch,
  "date-route": checkDateRoute,
  suite: checkSuite,
};

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (!cmd || (!COMMANDS[cmd] && cmd !== "all")) {
    console.error(`usage: tsx scripts/verify-api-budget.ts <${Object.keys(COMMANDS).join("|")}|all>`);
    process.exit(2);
  }

  if (cmd === "all") {
    for (const [name, run] of Object.entries(COMMANDS)) {
      if (name === "suite") continue; // slow; run it on its own
      console.log(`\n--- ${name} ---`);
      await run();
    }
    console.log(`\nALL BUDGET GATES OK (${checks} assertions)`);
    return;
  }

  await COMMANDS[cmd]!();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
