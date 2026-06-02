# Runtime Error Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve three runtime errors observed after rotating the API-Football key — a Postgres SSL deprecation warning, the API-Football Free-plan season error (`Free plans do not have access to this season, try from 2022 to 2024`), and a downstream `Cannot read properties of undefined (reading 'map')` crash.

**Architecture:** Three independent fixes, each shippable on its own. (1) Swap `sslmode=require` to `sslmode=verify-full` in `DATABASE_URL` to preserve current TLS verification semantics under the upcoming pg-connection-string v3 / pg v9 change. (2) Make `fetchApi` defensively normalize a missing/null `response` field to `[]` so downstream `.map`/`.length` calls never see `undefined` — this is the root cause of the crash, surfaced when the API returns `{ errors: {}, response: null }` (which can happen during transient API hiccups even before the Free-plan path applies). (3) Downgrade competition `season` values in `scripts/seed.ts` from `2025` to `2024` (and FIFA WC from `2026` to `2022`, the Qatar tournament) since the Free plan only serves 2022-2024 — and force-update existing rows so the change reaches the database.

**Tech Stack:** Node.js / Payload 3.84 / Postgres (Neon) / pg-connection-string / Vitest 3.2.4 for the client unit test.

**Discovered state (verified during planning):**

- The current API key (`fbb6efc15caac7a42af0b4f0ca317ffb`) is on the Free plan — verified via `/status` at planning time, response shows `{"plan":"Free","limit_day":100}`, expires 2027-05-11. The seed uses `season: 2025` for 11 competitions and `season: 2026` for FIFA WC — none supported by Free. Verified by reading [scripts/seed.ts:155-167](scripts/seed.ts#L155-L167).
- `competition.season` flows: DB row → server component at [src/app/(frontend)/[locale]/competition/[slug]/page.tsx:36](src/app/(frontend)/[locale]/competition/[slug]/page.tsx#L36) → `getStandings(leagueId, season)` and `getFixturesByLeague(leagueId, season, ...)`. **Updating the seed alone is insufficient** — existing DB rows still hold season 2025, so the seed must force-rewrite the `season` field on existing rows.
- `fetchApi` at [src/lib/api-football/client.ts:49](src/lib/api-football/client.ts#L49) ends with `return data.response;`. When the API returns `{ errors: {}, response: null }` (no error string but no payload either), this returns `null`. The TS return type `Promise<T[]>` is violated. Downstream consumers like `MatchList.tsx:24` (`fixtures.reduce(...)`) or `LiveScoreboard` would crash on `Cannot read properties of undefined (reading 'map')` or equivalents. No existing test covers this path — there's no `src/lib/api-football/__tests__/` directory yet.
- `.env` currently has `DATABASE_URL=postgresql://...?sslmode=require`. The warning is from `pg-connection-string` advising the explicit `verify-full` switch to preserve TLS-cert verification before the library's default semantics change.
- Branch state: on `main` at `6a3c811`, clean working tree (modulo untracked QA screenshots and planning docs).

---

## File Structure

**Modified:**
- `.env` — `DATABASE_URL` query-string flag
- `src/lib/api-football/client.ts` — one-line nullish-coalesce on return
- `scripts/seed.ts` — season values in the competitions array + force-update branch for existing rows

**New:**
- `src/lib/api-football/__tests__/client.test.ts` — unit tests for the `fetchApi` defensive return

**Untouched:**
- Vercel env (user updates `DATABASE_URL` separately if the prod URL uses the same flag — currently out of scope; this plan handles the local `.env` only)
- Payload schema (no migration needed — `season` is a regular number field)
- API-Football downstream callers (standings/fixtures/etc. — none of them need defensive changes once `fetchApi` is fixed at the source)

---

### Task 1: Swap Postgres `sslmode=require` → `sslmode=verify-full`

**Files:**
- Modify: `.env` (the `DATABASE_URL` line)

- [ ] **Step 1: Confirm the current DATABASE_URL format**

Run: `grep -n DATABASE_URL .env`
Expected: `DATABASE_URL=postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require`

- [ ] **Step 2: Replace the query-string flag**

Use the `Edit` tool on `.env`. Find:

```
sslmode=require
```

Replace with:

```
sslmode=verify-full
```

> **Why `verify-full` not `uselibpqcompat=true&sslmode=require`:** the warning offers both. `verify-full` preserves the current behavior (full cert chain + hostname verification, what Neon's TLS already passes). The libpq-compat path weakens the trust model by aliasing `require` to libpq's looser semantics — strictly worse for a managed Postgres host.

- [ ] **Step 3: Verify the warning is gone**

Stop any running dev server. Start a fresh one: `pnpm dev` (background, wait until it binds to :3000). Then in another shell:

```bash
curl -sI http://localhost:3000/ar 2>&1 | head -3
```

Watch the dev-server log output — the `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'` line should no longer appear. If it does, your seed/payload code path may be loading the DATABASE_URL from a different place; investigate (`grep -rn "process.env.DATABASE_URL" src/`).

Stop the dev server.

- [ ] **Step 4: Commit**

The `.env` file is gitignored, so there's nothing for git to stage. Instead, document the change in `.env.example` if it isn't already up-to-date:

```bash
grep -n DATABASE_URL .env.example
```

If `.env.example` shows `sslmode=require`, edit it to `sslmode=verify-full` and commit:

```bash
git add .env.example
git commit -m "chore(db): document sslmode=verify-full in .env.example"
```

If `.env.example` doesn't show that flag (or doesn't exist), skip this commit step — the local-only `.env` change stands without a git record.

---

### Task 2: Defensive null-coalesce in `fetchApi` (TDD)

**Files:**
- Modify: `src/lib/api-football/client.ts`
- Create: `src/lib/api-football/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/api-football/__tests__/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "../client";

const originalFetch = global.fetch;
const originalKey = process.env.API_FOOTBALL_KEY;

describe("fetchApi", () => {
  beforeEach(() => {
    process.env.API_FOOTBALL_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.API_FOOTBALL_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns the response array on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [], response: [{ id: 1 }, { id: 2 }] }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns [] when API errors object is non-empty", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: { plan: "Free plans do not have access to this season" },
        response: [],
      }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] when response field is null", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [], response: null }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] when response field is undefined", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [] }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] on non-2xx HTTP status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => ({}),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] when no API_FOOTBALL_KEY is configured", async () => {
    delete process.env.API_FOOTBALL_KEY;
    global.fetch = vi.fn(); // should never be called

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `pnpm test:run src/lib/api-football/__tests__/client.test.ts 2>&1 | tail -30`
Expected: the "response field is null" and "response field is undefined" tests FAIL with assertions saying `expected null` (or `undefined`) `to equal []`. The other four PASS because the existing client already handles them.

If all six pass before the implementation change, the bug is somewhere else — escalate to the orchestrator rather than skipping ahead.

- [ ] **Step 3: Fix the client**

In `src/lib/api-football/client.ts`, locate line 49 — the final `return data.response;` — and replace with:

```ts
return (data.response ?? []) as T[];
```

The full bottom of the function should read:

```ts
  if (errEntries.length > 0) {
    console.error(
      `[API-Football] errors for ${endpoint} ${JSON.stringify(params)}: ${JSON.stringify(errs)}`,
    );
    return [] as T[];
  }

  return (data.response ?? []) as T[];
}
```

- [ ] **Step 4: Re-run the tests and confirm they pass**

Run: `pnpm test:run src/lib/api-football/__tests__/client.test.ts 2>&1 | tail -20`
Expected: 6/6 passing.

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `pnpm test:run 2>&1 | tail -10`
Expected: ≥57 tests passing (the prior 51 plus these 6 new ones), 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-football/client.ts src/lib/api-football/__tests__/client.test.ts
git commit -m "fix(api-football): normalize null response to [] in fetchApi"
```

---

### Task 3: Downgrade competition seasons to Free-plan-supported years

**Files:**
- Modify: `scripts/seed.ts` (the `competitions` array around line 155 and the surrounding update loop around line 169)

- [ ] **Step 1: Update all 12 competition season values**

In `scripts/seed.ts`, locate the `competitions` array (starts ~line 146). Replace the entire array literal (currently lines 154-167) with these values — leagues drop to `2024`, FIFA WC drops to `2022` (Qatar — last tournament with data):

```ts
  ] = [
    { name: "Botola Pro 1", slug: "botola-pro-1", type: "league", apiFootballId: 200, season: 2024, country: "Morocco", categorySlug: "botola-pro-1-cat" },
    { name: "CAF Champions League", slug: "caf-champions-league", type: "cup", apiFootballId: 12, season: 2024, categorySlug: "caf-champions-league-cat" },
    { name: "CAF Confederation Cup", slug: "caf-confederation-cup", type: "cup", apiFootballId: 20, season: 2024 },
    { name: "Africa Cup of Nations", slug: "africa-cup-of-nations", type: "cup", apiFootballId: 6, season: 2024, categorySlug: "africa-cup-of-nations-cat" },
    { name: "FIFA World Cup 2026", slug: "world-cup-2026-competition", type: "cup", apiFootballId: 1, season: 2022, categorySlug: "world-cup-2026" },
    { name: "Premier League", slug: "premier-league", type: "league", apiFootballId: 39, season: 2024, country: "England", categorySlug: "premier-league-cat" },
    { name: "La Liga", slug: "la-liga", type: "league", apiFootballId: 140, season: 2024, country: "Spain", categorySlug: "la-liga-cat" },
    { name: "Bundesliga", slug: "bundesliga", type: "league", apiFootballId: 78, season: 2024, country: "Germany" },
    { name: "Serie A", slug: "serie-a", type: "league", apiFootballId: 135, season: 2024, country: "Italy" },
    { name: "Ligue 1", slug: "ligue-1", type: "league", apiFootballId: 61, season: 2024, country: "France" },
    { name: "UEFA Champions League", slug: "uefa-champions-league", type: "cup", apiFootballId: 2, season: 2024 },
    { name: "UEFA Europa League", slug: "uefa-europa-league", type: "cup", apiFootballId: 3, season: 2024 },
  ];
```

> **Note:** the leading `] = [` line keeps the same `const competitions: Array<...>` type annotation above it intact. Don't touch the type annotation; only replace the array literal.

- [ ] **Step 2: Force-update the `season` field on existing rows**

The existing idempotency check at line 169-183 only updates `logoUrl` when missing. Existing rows in the DB already have season=2025, so they'd never get rewritten. Extend the `if (existing) { ... }` branch to also rewrite season when it differs from the seed value.

Replace the existing block (currently lines 169-184):

```ts
  for (const c of competitions) {
    const existing = await findBySlug(payload, "competitions", c.slug);
    if (existing) {
      if (!(existing as any).logoUrl) {
        await payload.update({
          collection: "competitions",
          id: existing.id,
          data: { logoUrl: `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png` },
          overrideAccess: true,
        });
        console.log(`  [updated logoUrl] ${c.name}`);
      } else {
        console.log(`  [skip] ${c.name}`);
      }
      continue;
    }
```

with:

```ts
  for (const c of competitions) {
    const existing = await findBySlug(payload, "competitions", c.slug);
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (!(existing as any).logoUrl) {
        patch.logoUrl = `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png`;
      }
      if ((existing as any).season !== c.season) {
        patch.season = c.season;
      }
      if (Object.keys(patch).length > 0) {
        await payload.update({
          collection: "competitions",
          id: existing.id,
          data: patch,
          overrideAccess: true,
        });
        console.log(`  [updated ${Object.keys(patch).join(",")}] ${c.name}`);
      } else {
        console.log(`  [skip] ${c.name}`);
      }
      continue;
    }
```

This preserves the existing logoUrl backfill, adds a season-rewrite when stale, and combines both into a single `payload.update` call.

- [ ] **Step 3: Run the seed**

Stop any running dev server first (releases the DB pool).

Run: `pnpm seed 2>&1 | tail -30`
Expected output snippet for the competitions section:

```
--- Seeding Competitions ---
  [updated season] Botola Pro 1
  [updated season] CAF Champions League
  [updated season] CAF Confederation Cup
  [updated season] Africa Cup of Nations
  [updated season] FIFA World Cup 2026
  [updated season] Premier League
  [updated season] La Liga
  [updated season] Bundesliga
  [updated season] Serie A
  [updated season] Ligue 1
  [updated season] UEFA Champions League
  [updated season] UEFA Europa League
```

Every competition should report `[updated season]`. If any reports `[skip]`, that row already had the new season for some reason (re-run is then a no-op — that's fine).

- [ ] **Step 4: Spot-check the DB via curl**

Start dev server (`pnpm dev` background). Wait for it to bind. Then:

```bash
curl -s http://localhost:3000/ar/competition/premier-league 2>&1 | grep -o 'season":\s*[0-9]*' | head -3
```

Expected: at least one match showing `season":2024` (or similar). If it shows `2025`, the DB update didn't apply — check the seed output for errors.

Alternative: check the Payload admin at `http://localhost:3000/admin/collections/competitions` — open any competition, confirm `Season` field shows `2024` (or `2022` for FIFA WC).

- [ ] **Step 5: Confirm the `.map of undefined` error is gone**

Visit `http://localhost:3000/ar/competition/premier-league` in a browser via Playwright MCP (or use the dev server's terminal output as a proxy). Watch the server log. Expected:
- No `Free plans do not have access to this season` error log
- No `Cannot read properties of undefined (reading 'map')` crash
- If there's no live data (offseason), the page renders empty sections gracefully — that's fine

If the error persists, the issue is downstream of fetchApi (Task 2's fix didn't fully cover it) and warrants a separate investigation.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts
git commit -m "fix(seed): downgrade competition seasons to free-plan-supported years (2022/2024) and force-update existing rows"
```

---

### Task 4: Final smoke test and summary commit

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test:run 2>&1 | tail -10`
Expected: all green, count ≥ 57 (the 51 baseline + 6 new client tests from Task 2).

- [ ] **Step 2: Production build sanity check**

Run: `pnpm build 2>&1 | tail -15`
Expected: completes without error.

- [ ] **Step 3: Hand off**

Report:
- Postgres SSL warning: resolved
- fetchApi defensive return: tested + committed
- Free-plan season constraint: addressed in seed + DB rewritten
- Production needs: user must mirror the `sslmode=verify-full` flag in Vercel's `DATABASE_URL` env var (separate dashboard action) and re-deploy. The other two fixes ship via `git push origin main`.

---

## Out of Scope (do NOT implement in this plan)

- Upgrading the API-Football plan (paid tier needed for current-season data — user decision, not a code change)
- Changing the API-Football base URL or auth headers
- Adding retry/backoff for transient API failures (separate concern; defensive null-coalesce already prevents the crash)
- Updating the Vercel production `DATABASE_URL` env var — user does this in the dashboard
- Reverting the season change once a paid plan unlocks 2025 — that's a future seed update

---

## Self-Review

**Spec coverage:**

| Reported error | Covered by |
|---|---|
| Postgres SSL deprecation warning | Task 1 |
| API-Football Free-plan season error | Task 3 (seed downgrade + DB rewrite) |
| `Cannot read properties of undefined (reading 'map')` | Task 2 (defensive null-coalesce in fetchApi) |

All three are mapped to concrete tasks. ✓

**Type consistency check:**
- `fetchApi<T>` signature unchanged — only the return statement gains a nullish-coalesce
- `season` is a `number` everywhere (Payload schema confirms `number`); reassigning 2025→2024 doesn't violate any contract
- `competitions[i].season` shape matches the existing Array typing at scripts/seed.ts:146 — no schema change

**Placeholder scan:** No "TBD", "implement later", or generic "add error handling". Every code step shows the actual replacement code. Every command shows expected output.

**Decomposition check:** Tasks 1, 2, and 3 are independent. Task 4 verifies the combined result. Each task produces an independently shippable commit.

---

*Plan complete.*
