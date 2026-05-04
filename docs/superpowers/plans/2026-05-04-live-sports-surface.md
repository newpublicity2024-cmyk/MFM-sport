# Live Sports Surface Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the football surface complete and live: ship the missing competition + club index pages, add client-side live-score polling on the match detail page, add a "Live Now" section to the homepage, and replace the rigid 3-button date row on `/matches` with a 7-day strip + a competition filter.

**Architecture:** Server components remain authoritative. Live updates come from a tiny client-side polling hook (`useEffect` + `setInterval` + `fetch` against a Next.js API route that proxies API-Football, hiding the secret key). Visibility API pauses polling when the tab is hidden. New index pages read directly from Payload via existing `queries.ts` helpers. The `/matches` page becomes URL-driven: `?date=YYYY-MM-DD&league=<id>`.

**Tech Stack:** Next.js 16 App Router, Payload 3, API-Football v3, next-intl, Vitest + React Testing Library, Tailwind, shadcn/ui (already in repo). No new dependencies.

---

## Depends On

- Plans 1–5 complete (all collections + base pages exist)
- `API_FOOTBALL_KEY` set in `.env`
- Existing modules left untouched: `src/lib/api-football/{client,fixtures,standings,types}.ts`, `src/components/football/{MatchCard,MatchList,MatchEvents,MatchStats,MatchLineup,StandingsTable}.tsx`

---

## File Structure (end state of this plan)

```
src/
  app/
    api/
      fixtures/
        live/route.ts                     # Task 2 — proxy: live fixtures
        [id]/route.ts                     # Task 3 — proxy: single fixture
    (frontend)/
      [locale]/
        page.tsx                          # Task 7 (modify) — mount LiveNowSection
        matches/
          page.tsx                        # Task 12 (modify) — DateStrip + CompetitionFilter
          [id]/
            page.tsx                      # Task 13 (modify) — wire LiveScoreboard for live matches
        competition/
          page.tsx                        # Task 8 (new) — competitions index
        club/
          page.tsx                        # Task 9 (new) — clubs index
  components/
    football/
      LiveNowSection.tsx                  # Task 6 (new) — homepage live block
      DateStrip.tsx                       # Task 10 (new) — 7-day strip + date input
      CompetitionFilter.tsx               # Task 11 (new) — competition chip filter
      LiveScoreboard.tsx                  # Task 13 (new) — client wrapper for match detail score
  hooks/
    useFixture.ts                         # Task 4 (new) — single-fixture polling hook
    useLiveFixtures.ts                    # Task 5 (new) — live-list polling hook
  lib/
    api-football/
      fixtures.ts                         # Task 2 (modify) — add getLiveFixtures()
    payload/
      queries.ts                          # Task 1 (modify) — add getClubs()
messages/
  en.json                                 # Task 14 (modify)
  fr.json                                 # Task 14 (modify)
  ar.json                                 # Task 14 (modify)
src/
  components/football/__tests__/          # tests colocated
    LiveNowSection.test.tsx               # Task 6
    DateStrip.test.tsx                    # Task 10
    CompetitionFilter.test.tsx            # Task 11
    LiveScoreboard.test.tsx               # Task 13
  hooks/__tests__/
    useFixture.test.tsx                   # Task 4
    useLiveFixtures.test.tsx              # Task 5
  lib/payload/__tests__/
    getClubs.test.ts                      # Task 1
```

---

## Conventions

- **Tests:** Vitest with `jsdom`, RTL. Files end in `.test.ts(x)`. Run a single test file: `pnpm test:run path/to/file.test.tsx`.
- **i18n:** Add new strings to all three locales (en/fr/ar) in the same task.
- **Polling intervals:** match detail = **30s**, live-now list = **60s**.
- **API quota safety:** every external call goes through `fetchApi()` with `next: { revalidate }` cache. The proxy routes set short revalidate windows so multiple users polling do NOT each hit API-Football.
- **Commit style:** match existing repo convention (`feat(scope): ...`, `test(scope): ...`).

---

## Task 1: Add `getClubs()` query helper

Currently `getClubBySlug()` exists, but the soon-to-exist `/club` index needs a list helper.

**Files:**
- Modify: `src/lib/payload/queries.ts` (insert near `getCompetitions`)
- Test: `src/lib/payload/__tests__/getClubs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/payload/__tests__/getClubs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMock = vi.fn();

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ find: findMock })),
}));
vi.mock("@payload-config", () => ({ default: Promise.resolve({}) }));

import { getClubs } from "@/lib/payload/queries";

describe("getClubs", () => {
  beforeEach(() => {
    findMock.mockReset();
    findMock.mockResolvedValue({ docs: [{ id: "1", name: "Wydad" }] });
  });

  it("queries clubs collection with locale and sort by name", async () => {
    await getClubs("en");
    expect(findMock).toHaveBeenCalledWith({
      collection: "clubs",
      locale: "en",
      limit: 50,
      sort: "name",
      depth: 1,
    });
  });

  it("returns the find() result unchanged", async () => {
    const result = await getClubs("en");
    expect(result.docs[0].name).toBe("Wydad");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test:run src/lib/payload/__tests__/getClubs.test.ts`
Expected: FAIL with "getClubs is not a function" (export does not exist yet).

- [ ] **Step 3: Add `getClubs()` to `queries.ts`**

Open `src/lib/payload/queries.ts`. Find the `getCompetitions` function (around line 188). Immediately after it, add:

```ts
export async function getClubs(locale: Locale) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "clubs",
    locale,
    limit: 50,
    sort: "name",
    depth: 1,
  });
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test:run src/lib/payload/__tests__/getClubs.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payload/queries.ts src/lib/payload/__tests__/getClubs.test.ts
git commit -m "feat(queries): add getClubs() list helper"
```

---

## Task 2: API-Football `getLiveFixtures()` helper + `/api/fixtures/live` proxy route

API-Football's `/fixtures?live=all` returns currently-live matches across all leagues. We need a server function and a proxy route so the client can poll without ever seeing the API key.

**Files:**
- Modify: `src/lib/api-football/fixtures.ts`
- Create: `src/app/api/fixtures/live/route.ts`

- [ ] **Step 1: Add `getLiveFixtures` helper**

Open `src/lib/api-football/fixtures.ts`. Append:

```ts
export async function getLiveFixtures(): Promise<ApiFixture[]> {
  return fetchApi<ApiFixture>("/fixtures", { live: "all" }, 30);
}
```

`30` = 30s server-side cache so multiple polling clients share one upstream call per 30s window.

- [ ] **Step 2: Create the proxy route**

Create `src/app/api/fixtures/live/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getLiveFixtures } from "@/lib/api-football/fixtures";

export const revalidate = 30;

export async function GET() {
  const fixtures = await getLiveFixtures();
  return NextResponse.json({ fixtures });
}
```

- [ ] **Step 3: Smoke test the route manually**

Run dev server in another terminal: `pnpm dev`
Then: `curl -s http://localhost:3000/api/fixtures/live | head -c 200`
Expected: JSON like `{"fixtures":[...]}`. May be `{"fixtures":[]}` outside live windows — that's fine. If the response is an HTML error page, check that `API_FOOTBALL_KEY` is in `.env` and dev server was restarted after editing it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-football/fixtures.ts src/app/api/fixtures/live/route.ts
git commit -m "feat(api): add live fixtures helper + /api/fixtures/live proxy"
```

---

## Task 3: `/api/fixtures/[id]` proxy route

Single-fixture proxy, used by the match detail page client polling.

**Files:**
- Create: `src/app/api/fixtures/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/fixtures/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getFixtureById } from "@/lib/api-football/fixtures";

export const revalidate = 30;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const fixtureId = Number(id);
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ fixture });
}
```

- [ ] **Step 2: Smoke test**

With dev server running, hit a known fixture id (use any id you see in the browser when visiting `/en/matches`). Example:
`curl -s http://localhost:3000/api/fixtures/12345`

Expected: JSON `{"fixture":{...}}` with status 200, OR `{"error":"not found"}` with 404 if id is bogus. Hit `/api/fixtures/abc` → expect 400.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fixtures/[id]/route.ts
git commit -m "feat(api): add /api/fixtures/[id] proxy"
```

---

## Task 4: `useFixture(id)` polling hook

A client hook that polls a single fixture every 30s. Pauses while the tab is hidden. Returns `{ fixture, isLoading, error }`.

**Files:**
- Create: `src/hooks/useFixture.ts`
- Test: `src/hooks/__tests__/useFixture.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useFixture.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFixture } from "@/hooks/useFixture";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("useFixture", () => {
  it("fetches once on mount and returns the fixture", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    const { result } = renderHook(() =>
      useFixture(7, { initial: null, intervalMs: 30000, enabled: true }),
    );
    await waitFor(() => expect(result.current.fixture).toEqual({ fixture: { id: 7 } }));
    expect(fetchMock).toHaveBeenCalledWith("/api/fixtures/7", expect.any(Object));
  });

  it("uses initial data without an immediate fetch when provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    const initial = { fixture: { id: 7, score: "0-0" } } as never;
    const { result } = renderHook(() =>
      useFixture(7, { initial, intervalMs: 30000, enabled: true }),
    );
    expect(result.current.fixture).toBe(initial);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polls on the interval", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    renderHook(() => useFixture(7, { initial: null, intervalMs: 30000, enabled: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("does not fetch when enabled is false", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    renderHook(() => useFixture(7, { initial: null, intervalMs: 30000, enabled: false }));
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes fetch errors via error state", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(() =>
      useFixture(7, { initial: null, intervalMs: 30000, enabled: true }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test:run src/hooks/__tests__/useFixture.test.tsx`
Expected: FAIL — "Cannot find module @/hooks/useFixture".

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useFixture.ts`:

```ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiFixture } from "@/lib/api-football/types";

export type UseFixtureOptions = {
  initial: ApiFixture | null;
  intervalMs: number;
  enabled: boolean;
};

export type UseFixtureResult = {
  fixture: ApiFixture | null;
  isLoading: boolean;
  error: Error | null;
};

export function useFixture(id: number, options: UseFixtureOptions): UseFixtureResult {
  const { initial, intervalMs, enabled } = options;
  const [fixture, setFixture] = useState<ApiFixture | null>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hadInitialRef = useRef<boolean>(initial !== null);

  const fetchOnce = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fixtures/${id}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { fixture: ApiFixture };
      setFixture(json.fixture);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!enabled) return;

    if (!hadInitialRef.current) {
      void fetchOnce();
    }
    hadInitialRef.current = false;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchOnce();
    }, intervalMs);

    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, fetchOnce]);

  return { fixture, isLoading, error };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test:run src/hooks/__tests__/useFixture.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFixture.ts src/hooks/__tests__/useFixture.test.tsx
git commit -m "feat(hooks): add useFixture polling hook with visibility pause"
```

---

## Task 5: `useLiveFixtures()` polling hook

Same shape as `useFixture` but for the live-now list. 60s interval.

**Files:**
- Create: `src/hooks/useLiveFixtures.ts`
- Test: `src/hooks/__tests__/useLiveFixtures.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useLiveFixtures.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("useLiveFixtures", () => {
  it("returns initial array without fetching when provided", () => {
    const initial = [{ fixture: { id: 1 } }] as never;
    const { result } = renderHook(() =>
      useLiveFixtures({ initial, intervalMs: 60000, enabled: true }),
    );
    expect(result.current.fixtures).toBe(initial);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polls /api/fixtures/live every intervalMs", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [] }));
    renderHook(() => useLiveFixtures({ initial: [], intervalMs: 60000, enabled: true }));
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/fixtures/live", expect.any(Object));
  });

  it("updates fixtures from server response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [{ fixture: { id: 9 } }] }));
    const { result } = renderHook(() =>
      useLiveFixtures({ initial: [], intervalMs: 60000, enabled: true }),
    );
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await waitFor(() => expect(result.current.fixtures.length).toBe(1));
  });

  it("does not poll when disabled", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [] }));
    renderHook(() => useLiveFixtures({ initial: [], intervalMs: 60000, enabled: false }));
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test:run src/hooks/__tests__/useLiveFixtures.test.tsx`
Expected: FAIL — "Cannot find module @/hooks/useLiveFixtures".

- [ ] **Step 3: Implement**

Create `src/hooks/useLiveFixtures.ts`:

```ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiFixture } from "@/lib/api-football/types";

export type UseLiveFixturesOptions = {
  initial: ApiFixture[];
  intervalMs: number;
  enabled: boolean;
};

export type UseLiveFixturesResult = {
  fixtures: ApiFixture[];
  isLoading: boolean;
  error: Error | null;
};

export function useLiveFixtures(options: UseLiveFixturesOptions): UseLiveFixturesResult {
  const { initial, intervalMs, enabled } = options;
  const [fixtures, setFixtures] = useState<ApiFixture[]>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true);
    try {
      const res = await fetch("/api/fixtures/live", { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { fixtures: ApiFixture[] };
      setFixtures(json.fixtures);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchOnce();
    }, intervalMs);

    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, fetchOnce]);

  return { fixtures, isLoading, error };
}
```

Note: unlike `useFixture`, we do **not** fetch on mount — the homepage seeds with server data, and we only need updates. This avoids a redundant request on every page load.

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test:run src/hooks/__tests__/useLiveFixtures.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLiveFixtures.ts src/hooks/__tests__/useLiveFixtures.test.tsx
git commit -m "feat(hooks): add useLiveFixtures polling hook"
```

---

## Task 6: `LiveNowSection` component

A client component that takes the seed of currently-live matches from the server, then keeps it fresh with `useLiveFixtures`. Renders nothing if there are no live matches (so the homepage doesn't grow an empty section in the middle of the night).

**Files:**
- Create: `src/components/football/LiveNowSection.tsx`
- Test: `src/components/football/__tests__/LiveNowSection.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/football/__tests__/LiveNowSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LiveNowSection } from "@/components/football/LiveNowSection";

vi.mock("@/hooks/useLiveFixtures", () => ({
  useLiveFixtures: ({ initial }: { initial: unknown[] }) => ({
    fixtures: initial,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/components/football/MatchList", () => ({
  MatchList: ({ fixtures }: { fixtures: unknown[] }) => (
    <div data-testid="match-list">count:{fixtures.length}</div>
  ),
}));

const messages = { match: { liveNow: "Live Now" }, common: { readMore: "View all" } };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

const liveFixture = {
  fixture: { id: 1, status: { short: "1H" } },
  league: { id: 39 },
  teams: { home: {}, away: {} },
} as never;

describe("LiveNowSection", () => {
  it("renders nothing when there are no live fixtures", () => {
    const { container } = renderWithIntl(<LiveNowSection initial={[]} locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders heading and MatchList when live fixtures exist", () => {
    renderWithIntl(<LiveNowSection initial={[liveFixture]} locale="en" />);
    expect(screen.getByText("Live Now")).toBeInTheDocument();
    expect(screen.getByTestId("match-list")).toHaveTextContent("count:1");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test:run src/components/football/__tests__/LiveNowSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/football/LiveNowSection.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { ApiFixture } from "@/lib/api-football/types";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";
import { MatchList } from "@/components/football/MatchList";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  initial: ApiFixture[];
  locale: string;
};

export function LiveNowSection({ initial, locale }: Props) {
  const t = useTranslations("match");
  const tCommon = useTranslations("common");
  const { fixtures } = useLiveFixtures({
    initial,
    intervalMs: 60000,
    enabled: true,
  });

  if (fixtures.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeader
        title={t("liveNow")}
        href={`/${locale}/matches`}
        linkText={tCommon("readMore")}
      />
      <div className="flex items-center gap-2 mb-2 text-xs text-live">
        <span className="inline-block h-2 w-2 rounded-full bg-live animate-pulse" />
        {t("live")}
      </div>
      <MatchList fixtures={fixtures.slice(0, 10)} locale={locale} />
    </section>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test:run src/components/football/__tests__/LiveNowSection.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/football/LiveNowSection.tsx src/components/football/__tests__/LiveNowSection.test.tsx
git commit -m "feat(football): add LiveNowSection client component"
```

---

## Task 7: Mount `LiveNowSection` on the homepage

Server-fetch the live seed once, then hand it to the client component for refresh.

**Files:**
- Modify: `src/app/(frontend)/[locale]/page.tsx`

- [ ] **Step 1: Edit the homepage**

In `src/app/(frontend)/[locale]/page.tsx`:

(a) Update the imports block (top of file). Replace:

```ts
import { getFixturesByDate } from "@/lib/api-football/fixtures";
```

with:

```ts
import { getFixturesByDate, getLiveFixtures } from "@/lib/api-football/fixtures";
import { LiveNowSection } from "@/components/football/LiveNowSection";
```

(b) Update the data fetch in `HomePage`. Replace:

```ts
  const today = new Date().toISOString().split("T")[0];
  const todayFixtures = await getFixturesByDate(today);
```

with:

```ts
  const today = new Date().toISOString().split("T")[0];
  const [todayFixtures, liveFixtures] = await Promise.all([
    getFixturesByDate(today),
    getLiveFixtures(),
  ]);
```

(c) Insert `<LiveNowSection />` immediately after `<HeroSection />`. Replace:

```tsx
      <HeroSection featured={featured} secondary={secondary} locale={locale} />

      {todayFixtures.length > 0 && (
```

with:

```tsx
      <HeroSection featured={featured} secondary={secondary} locale={locale} />

      <LiveNowSection initial={liveFixtures} locale={locale} />

      {todayFixtures.length > 0 && (
```

- [ ] **Step 2: Smoke test**

Run `pnpm dev`. Visit `http://localhost:3000/en`. Open DevTools → Network and filter by "fixtures". Wait 60s — you should see a request to `/api/fixtures/live` exactly every 60s while the tab is focused. Switch tabs, wait 90s, switch back: there should be no requests during the hidden window.

If `liveFixtures` is empty (no live matches happening when you test), the section won't render. That is correct. To verify the section's appearance, temporarily inject a test fixture: hard-code `initial={[fakeFixture]}` for one render and confirm UI renders, then revert.

- [ ] **Step 3: Run all tests**

Run: `pnpm test:run`
Expected: All previously passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/page.tsx
git commit -m "feat(home): mount LiveNowSection above today's matches"
```

---

## Task 8: `/competition` index page (fixes 404 from nav)

The `Competitions` nav link currently 404s. Build the index.

**Files:**
- Create: `src/app/(frontend)/[locale]/competition/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(frontend)/[locale]/competition/page.tsx`:

```tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Link from "next/link";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCompetitions } from "@/lib/payload/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: `${t("competitions")} | MFM Sport` };
}

export default async function CompetitionsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "nav" });
  const tComp = await getTranslations({ locale, namespace: "competition" });
  const result = await getCompetitions(locale as Config["locale"]);

  const leagues = result.docs.filter((c: any) => c.type === "league");
  const cups = result.docs.filter((c: any) => c.type === "cup");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t("competitions")}</h1>

      {leagues.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">{tComp("standings")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {leagues.map((c: any) => (
              <CompetitionCard key={c.id} competition={c} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {cups.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">{tComp("fixtures")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {cups.map((c: any) => (
              <CompetitionCard key={c.id} competition={c} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompetitionCard({ competition, locale }: { competition: any; locale: string }) {
  const logoUrl = competition.logo?.url ?? null;
  return (
    <Link
      href={`/${locale}/competition/${competition.slug}`}
      className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
    >
      {logoUrl ? (
        <Image src={logoUrl} alt={competition.name} width={48} height={48} className="object-contain h-12 w-12" />
      ) : (
        <div className="h-12 w-12 rounded bg-muted" aria-hidden />
      )}
      <span className="text-sm font-medium text-center">{competition.name}</span>
      {competition.country && (
        <span className="text-xs text-muted-foreground">{competition.country}</span>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Smoke test**

Visit `http://localhost:3000/en/competition`. Expected: a grid of seeded competitions, click any tile → goes to `/en/competition/<slug>`. Visit `/fr/competition` and `/ar/competition` — confirm RTL on the Arabic version doesn't break the grid.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/competition/page.tsx
git commit -m "feat(competition): add competitions index page"
```

---

## Task 9: `/club` index page

Same pattern as competitions. The nav doesn't currently link here — that's fine for this scope, the page still serves SEO and direct URLs.

**Files:**
- Create: `src/app/(frontend)/[locale]/club/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(frontend)/[locale]/club/page.tsx`:

```tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Link from "next/link";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getClubs } from "@/lib/payload/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: `${t("clubs")} | MFM Sport` };
}

export default async function ClubsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "nav" });
  const result = await getClubs(locale as Config["locale"]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t("clubs")}</h1>

      {result.docs.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {result.docs.map((club: any) => {
            const logoUrl = club.logo?.url ?? null;
            return (
              <Link
                key={club.id}
                href={`/${locale}/club/${club.slug}`}
                className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
              >
                {logoUrl ? (
                  <Image src={logoUrl} alt={club.name} width={48} height={48} className="object-contain h-12 w-12" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted" aria-hidden />
                )}
                <span className="text-sm font-medium text-center">{club.name}</span>
                {club.city && (
                  <span className="text-xs text-muted-foreground">{club.city}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Visit `http://localhost:3000/en/club`. Expected: 4 seeded clubs (per memory). Click any → `/en/club/<slug>` works as before.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/club/page.tsx
git commit -m "feat(club): add clubs index page"
```

---

## Task 10: `DateStrip` component (7-day strip + date input)

A horizontally-scrollable strip showing D-3 → D+3 around a `selected` date, with a native `<input type="date">` for jumping to any day. All entries are plain `<a>` links so the URL is the source of truth (server keeps rendering).

**Files:**
- Create: `src/components/football/DateStrip.tsx`
- Test: `src/components/football/__tests__/DateStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/football/__tests__/DateStrip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateStrip } from "@/components/football/DateStrip";

describe("DateStrip", () => {
  it("renders 7 day links centered on selected", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(links[0]).toHaveAttribute("href", "/en/matches?date=2026-05-01");
    expect(links[3]).toHaveAttribute("href", "/en/matches?date=2026-05-04");
    expect(links[6]).toHaveAttribute("href", "/en/matches?date=2026-05-07");
  });

  it("marks the selected day as aria-current", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveAttribute("href", "/en/matches?date=2026-05-04");
  });

  it("preserves the league query param when set", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" league="39" />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/en/matches?date=2026-05-01&league=39");
  });

  it("renders a date picker input bound to selected", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" />);
    const input = screen.getByLabelText(/date/i) as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-05-04");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test:run src/components/football/__tests__/DateStrip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/football/DateStrip.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  selected: string; // YYYY-MM-DD
  locale: string;
  basePath: string;
  league?: string;
};

function shiftDate(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function buildHref(basePath: string, date: string, league?: string): string {
  const params = new URLSearchParams({ date });
  if (league) params.set("league", league);
  return `${basePath}?${params.toString()}`;
}

function dayLabel(date: string, locale: string): { day: string; num: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
  const num = String(dt.getUTCDate());
  return { day, num };
}

export function DateStrip({ selected, locale, basePath, league }: Props) {
  const router = useRouter();
  const days = [-3, -2, -1, 0, 1, 2, 3].map((offset) => shiftDate(selected, offset));

  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <div className="flex gap-1 overflow-x-auto">
        {days.map((d) => {
          const { day, num } = dayLabel(d, locale);
          const isSelected = d === selected;
          return (
            <Link
              key={d}
              href={buildHref(basePath, d, league)}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[3.5rem] text-xs transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="capitalize">{day}</span>
              <span className="text-base font-semibold">{num}</span>
            </Link>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Date</span>
        <input
          type="date"
          value={selected}
          onChange={(e) => {
            const next = e.target.value;
            if (next) router.push(buildHref(basePath, next, league));
          }}
          className="bg-secondary text-foreground rounded-md px-2 py-1 text-xs"
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test:run src/components/football/__tests__/DateStrip.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/football/DateStrip.tsx src/components/football/__tests__/DateStrip.test.tsx
git commit -m "feat(football): add DateStrip with 7-day scroll and date input"
```

---

## Task 11: `CompetitionFilter` chip component

A row of clickable chips: "All", then one per seeded competition. Click writes `?league=<apiFootballId>` to the URL. Server filters fixtures.

**Files:**
- Create: `src/components/football/CompetitionFilter.tsx`
- Test: `src/components/football/__tests__/CompetitionFilter.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/football/__tests__/CompetitionFilter.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionFilter } from "@/components/football/CompetitionFilter";

const competitions = [
  { id: "a", name: "Botola Pro", apiFootballId: 200 },
  { id: "b", name: "Premier League", apiFootballId: 39 },
] as never;

describe("CompetitionFilter", () => {
  it("renders an 'All' chip plus one per competition", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague={null}
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent("All");
    expect(links[1]).toHaveTextContent("Botola Pro");
  });

  it("sets aria-current on the selected league chip", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague="39"
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
      />,
    );
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("Premier League");
  });

  it("sets aria-current on 'All' when no league selected", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague={null}
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
      />,
    );
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("All");
  });

  it("preserves date in chip hrefs", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague={null}
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/en/matches?date=2026-05-04");
    expect(links[1]).toHaveAttribute("href", "/en/matches?date=2026-05-04&league=200");
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test:run src/components/football/__tests__/CompetitionFilter.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/football/CompetitionFilter.tsx`:

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

type Competition = {
  id: string | number;
  name: string;
  apiFootballId: number;
};

type Props = {
  competitions: Competition[];
  selectedLeague: string | null;
  date: string;
  basePath: string;
  allLabel: string;
};

function buildHref(basePath: string, date: string, league?: string): string {
  const params = new URLSearchParams({ date });
  if (league) params.set("league", league);
  return `${basePath}?${params.toString()}`;
}

export function CompetitionFilter({
  competitions,
  selectedLeague,
  date,
  basePath,
  allLabel,
}: Props) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      <Link
        href={buildHref(basePath, date)}
        aria-current={selectedLeague === null ? "page" : undefined}
        className={cn(
          "rounded-full px-3 py-1 text-xs transition-colors",
          selectedLeague === null
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground",
        )}
      >
        {allLabel}
      </Link>
      {competitions.map((c) => {
        const id = String(c.apiFootballId);
        const isSelected = selectedLeague === id;
        return (
          <Link
            key={c.id}
            href={buildHref(basePath, date, id)}
            aria-current={isSelected ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test:run src/components/football/__tests__/CompetitionFilter.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/football/CompetitionFilter.tsx src/components/football/__tests__/CompetitionFilter.test.tsx
git commit -m "feat(football): add CompetitionFilter chip row"
```

---

## Task 12: Refactor `/matches` to use `DateStrip` + `CompetitionFilter`

The current page hardcodes 3 buttons and fetches yesterday/today/tomorrow in parallel. Replace with: read `?date` and `?league` from the URL → fetch only the selected day (optionally filtered by league) → render `DateStrip` + `CompetitionFilter` + a single `MatchList`.

**Files:**
- Modify: `src/app/(frontend)/[locale]/matches/page.tsx`

- [ ] **Step 1: Replace the page contents**

Open `src/app/(frontend)/[locale]/matches/page.tsx`. Replace the entire file with:

```tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { getCompetitions } from "@/lib/payload/queries";
import { MatchList } from "@/components/football/MatchList";
import { DateStrip } from "@/components/football/DateStrip";
import { CompetitionFilter } from "@/components/football/CompetitionFilter";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; league?: string }>;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidLeague(s: string | undefined): s is string {
  return typeof s === "string" && /^\d+$/.test(s);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "match" });
  return { title: `${t("today")} | MFM Sport` };
}

export default async function MatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { date: rawDate, league: rawLeague } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "match" });
  const tComp = await getTranslations({ locale, namespace: "competition" });

  const selectedDate = isValidDate(rawDate) ? rawDate : todayISO();
  const selectedLeague = isValidLeague(rawLeague) ? rawLeague : null;

  const [allFixtures, competitionsResult] = await Promise.all([
    getFixturesByDate(selectedDate),
    getCompetitions(locale as Config["locale"]),
  ]);

  const fixtures = selectedLeague
    ? allFixtures.filter((f) => String(f.league.id) === selectedLeague)
    : allFixtures;

  const basePath = `/${locale}/matches`;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("today")}</h1>

      <DateStrip
        selected={selectedDate}
        locale={locale}
        basePath={basePath}
        league={selectedLeague ?? undefined}
      />

      <CompetitionFilter
        competitions={competitionsResult.docs.map((c: any) => ({
          id: c.id,
          name: c.name,
          apiFootballId: c.apiFootballId,
        }))}
        selectedLeague={selectedLeague}
        date={selectedDate}
        basePath={basePath}
        allLabel={tComp("allCompetitions")}
      />

      {fixtures.length > 0 ? (
        <MatchList fixtures={fixtures} locale={locale} />
      ) : (
        <p className="text-muted-foreground text-center py-8">{t("noMatches")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Visit `http://localhost:3000/en/matches`. Expected:
- DateStrip shows 7 days centered on today, today highlighted.
- CompetitionFilter chips show "All" + one per seeded competition; "All" highlighted.
- Click another day → page reloads, that day's fixtures show, that day highlighted.
- Click a competition chip → fixtures filtered to that league only; URL has `?league=<id>`.
- Combine: pick D+1 then a league chip → `?date=...&league=...` is preserved across both controls.
- Native date input: pick a date 2 weeks out → URL updates and that date renders.

- [ ] **Step 3: Run all tests**

Run: `pnpm test:run`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/matches/page.tsx
git commit -m "feat(matches): replace fixed tabs with DateStrip + CompetitionFilter"
```

---

## Task 13: Wire `useFixture` into the match detail page (live updates)

The match detail page server-renders the initial fixture, then a thin client wrapper keeps the score, status, and elapsed minute fresh — but only for matches that are actually live.

**Files:**
- Create: `src/components/football/LiveScoreboard.tsx`
- Test: `src/components/football/__tests__/LiveScoreboard.test.tsx`
- Modify: `src/app/(frontend)/[locale]/matches/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/football/__tests__/LiveScoreboard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

const useFixtureMock = vi.fn();
vi.mock("@/hooks/useFixture", () => ({ useFixture: (...args: unknown[]) => useFixtureMock(...args) }));

import { LiveScoreboard } from "@/components/football/LiveScoreboard";

const messages = { match: { live: "LIVE", fullTime: "FT" } };

function wrap(ui: React.ReactElement) {
  return render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>);
}

const baseFixture = {
  fixture: { id: 7, date: "2026-05-04T20:00:00Z", status: { short: "1H", elapsed: 23, long: "" }, venue: null, referee: null },
  league: { id: 1, name: "L", logo: "", country: "", flag: null, season: 2025, round: "" },
  teams: { home: { id: 1, name: "H", logo: "", winner: null }, away: { id: 2, name: "A", logo: "", winner: null } },
  goals: { home: 1, away: 0 },
  score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
} as never;

describe("LiveScoreboard", () => {
  it("displays the live score and elapsed minute", () => {
    useFixtureMock.mockReturnValue({ fixture: baseFixture, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={baseFixture} locale="en" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/LIVE 23'/)).toBeInTheDocument();
  });

  it("calls useFixture with enabled=true when match is live", () => {
    useFixtureMock.mockReturnValue({ fixture: baseFixture, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={baseFixture} locale="en" />);
    expect(useFixtureMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ enabled: true, intervalMs: 30000 }),
    );
  });

  it("calls useFixture with enabled=false when match is finished", () => {
    const finished = {
      ...baseFixture,
      fixture: { ...baseFixture.fixture, status: { short: "FT", elapsed: 90, long: "" } },
    } as never;
    useFixtureMock.mockReturnValue({ fixture: finished, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={finished} locale="en" />);
    expect(useFixtureMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.getByText("FT")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test:run src/components/football/__tests__/LiveScoreboard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `LiveScoreboard`**

Create `src/components/football/LiveScoreboard.tsx`:

```tsx
"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ApiFixture } from "@/lib/api-football/types";
import { getMatchStatus } from "@/lib/api-football/types";
import { useFixture } from "@/hooks/useFixture";
import { cn, formatDate, formatTime } from "@/lib/utils";

type Props = {
  initial: ApiFixture;
  locale: string;
};

export function LiveScoreboard({ initial, locale }: Props) {
  const t = useTranslations("match");
  const initialStatus = getMatchStatus(initial.fixture.status.short);
  const isLive = initialStatus === "live";
  const { fixture: latest } = useFixture(initial.fixture.id, {
    initial,
    intervalMs: 30000,
    enabled: isLive,
  });
  const fixture = latest ?? initial;
  const status = getMatchStatus(fixture.fixture.status.short);
  const { home, away } = fixture.teams;
  const goals = fixture.goals;

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-2 flex-1">
          <Image src={home.logo} alt={home.name} width={56} height={56} />
          <span className={cn("text-sm font-medium text-center", home.winner && "font-bold")}>
            {home.name}
          </span>
        </div>

        <div className="flex flex-col items-center mx-4">
          {status === "scheduled" ? (
            <>
              <span className="text-2xl font-bold text-muted-foreground">vs</span>
              <span className="text-sm text-muted-foreground mt-1">
                {formatTime(fixture.fixture.date, locale)}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 text-4xl font-bold tabular-nums">
                <span>{goals.home ?? 0}</span>
                <span className="text-muted-foreground text-2xl">-</span>
                <span>{goals.away ?? 0}</span>
              </div>
              <span
                className={cn(
                  "text-xs font-medium mt-1 px-2 py-0.5 rounded",
                  status === "live" && "bg-live/20 text-live",
                  status === "finished" && "bg-secondary text-muted-foreground",
                )}
              >
                {status === "live"
                  ? `${t("live")} ${fixture.fixture.status.elapsed || ""}'`
                  : t("fullTime")}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1">
          <Image src={away.logo} alt={away.name} width={56} height={56} />
          <span className={cn("text-sm font-medium text-center", away.winner && "font-bold")}>
            {away.name}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
        <span>{formatDate(fixture.fixture.date, locale)}</span>
        {fixture.fixture.venue?.name && <span>{fixture.fixture.venue.name}</span>}
        {fixture.fixture.referee && <span>{fixture.fixture.referee}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test:run src/components/football/__tests__/LiveScoreboard.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Use `LiveScoreboard` in the detail page**

Open `src/app/(frontend)/[locale]/matches/[id]/page.tsx`. Make two edits:

(a) Add the import alongside the existing component imports:

```ts
import { LiveScoreboard } from "@/components/football/LiveScoreboard";
```

(b) Replace the entire `{/* Score header */}` block (the `<div className="bg-card rounded-lg border border-border p-6 mb-8">...</div>` containing the home/away/score layout) with:

```tsx
      <LiveScoreboard initial={fixture} locale={locale} />
```

After this swap these imports become unused (delete them): `cn`, `formatDate`, `formatTime`, `getMatchStatus`. These imports stay (still used elsewhere in the page): `Image` (stats section logos), `notFound`, `setRequestLocale`, `getTranslations`, `getFixtureById`, `MatchEvents`, `MatchLineup`, `MatchStats`, `SectionHeader`. Run `pnpm lint` to confirm.

- [ ] **Step 6: Smoke test**

Visit a finished match: `http://localhost:3000/en/matches/<some-id>`. Expected: identical render, no `/api/fixtures/<id>` requests in Network tab. Visit a live match: a request fires every 30s, score and elapsed minute update without reload.

- [ ] **Step 7: Commit**

```bash
git add src/components/football/LiveScoreboard.tsx src/components/football/__tests__/LiveScoreboard.test.tsx src/app/\(frontend\)/\[locale\]/matches/\[id\]/page.tsx
git commit -m "feat(matches): live-update scoreboard via useFixture"
```

---

## Task 14: i18n strings (en/fr/ar)

Add the new strings consumed across this plan: `match.liveNow`, `nav.clubs`. Everything else (`match.live`, `match.today`, `competition.allCompetitions`, etc.) already exists.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/fr.json`
- Modify: `messages/ar.json`

- [ ] **Step 1: Edit `messages/en.json`**

Inside `"nav": { ... }`, add `"clubs": "Clubs"` so the block reads:

```json
  "nav": {
    "home": "Home",
    "news": "News",
    "competitions": "Competitions",
    "matches": "Matches",
    "videos": "Videos",
    "clubs": "Clubs"
  },
```

Inside `"match": { ... }`, add `"liveNow": "Live Now"` (place it next to `"live"`):

```json
    "live": "LIVE",
    "liveNow": "Live Now",
```

- [ ] **Step 2: Edit `messages/fr.json` (same shape)**

In `nav`: add `"clubs": "Clubs"`.
In `match`: add `"liveNow": "En direct"` next to `"live"`.

- [ ] **Step 3: Edit `messages/ar.json` (same shape)**

In `nav`: add `"clubs": "الأندية"`.
In `match`: add `"liveNow": "مباشر الآن"` next to `"live"`.

- [ ] **Step 4: Smoke test**

Reload `http://localhost:3000/en`, `/fr`, `/ar`. Confirm:
- The "Competitions" nav link still works in all three locales (no missing key warning in console).
- The "Live Now" section heading shows when seeded with a live fixture (forced-render or actual live).
- `/en/club`, `/fr/club`, `/ar/club` show the title from `nav.clubs`.

- [ ] **Step 5: Run all tests**

Run: `pnpm test:run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add messages/
git commit -m "i18n: add nav.clubs and match.liveNow in en/fr/ar"
```

---

## Final Verification Checklist

Before declaring this plan done:

- [ ] `pnpm test:run` — all tests green, no skipped suites added by this plan.
- [ ] `pnpm lint` — no new warnings.
- [ ] `pnpm build` — production build succeeds with no type errors.
- [ ] Manual: `/en/competition` and `/en/club` render index pages, no 404.
- [ ] Manual: `/en/matches?date=YYYY-MM-DD` reflects URL state; `?league=39` filters correctly; combined params preserved when toggling either control.
- [ ] Manual: visit a live match, confirm `/api/fixtures/<id>` polling at ~30s. Switch tabs, confirm polling pauses (visibility state).
- [ ] Manual: homepage at `/en` renders the "Live Now" section only when there are live matches. With live fixtures, the section refreshes every 60s.
- [ ] API quota: skim API-Football usage dashboard after 10 minutes of normal browsing. Confirm proxy `revalidate: 30/60` is collapsing client polls into one upstream call per window.

---

## Out of Scope (separate plans)

- Top scorers / player stats / head-to-head (API-Football supports; UI does not yet).
- A persistent live-score ticker in the global header.
- WebSocket / SSE upgrades (polling is enough for current traffic; revisit if API quota becomes a problem).
- WordPress migration (deferred per user direction).
- Adding "Clubs" to the main nav (the index page is reachable; nav-level entry is a UX call for later).
