import { getMatchStatus, type ApiFixture } from "./types";

export type FixtureWindow = { last: number; next: number };

/**
 * The slice of a season worth putting on the homepage.
 *
 * The hero matches panel was handed the featured competition's ENTIRE season
 * — 240 fixtures for Botola Pro 1 — and rendered the open group in full: the
 * served homepage was 1.25 MB, 784 of its 864 `<img>` tags were team crests,
 * and ~650 KB of the RSC payload was fixture objects (measured 17 September
 * 2026). Nobody scrolls 240 rows in a sidebar panel. Keep every live fixture,
 * the `last` most recent results and the `next` nearest upcoming ones; the
 * panel's finished / live / scheduled tabs keep working on that.
 *
 * Order is preserved as given (the panel groups and sorts itself). Fixtures
 * with an "other" status (postponed, cancelled, awarded…) are dropped from
 * the window, not shown as results — a postponed match is not a result.
 */
export function windowFixtures(fixtures: ApiFixture[], window: FixtureWindow): ApiFixture[] {
  const live: ApiFixture[] = [];
  const finished: ApiFixture[] = [];
  const scheduled: ApiFixture[] = [];
  for (const f of fixtures) {
    switch (getMatchStatus(f.fixture.status.short)) {
      case "live":
        live.push(f);
        break;
      case "finished":
        finished.push(f);
        break;
      case "scheduled":
        scheduled.push(f);
        break;
      default:
        break;
    }
  }
  const byTime = (a: ApiFixture, b: ApiFixture) => a.fixture.timestamp - b.fixture.timestamp;
  const recent = new Set(finished.sort(byTime).slice(-window.last));
  const upcoming = new Set(scheduled.sort(byTime).slice(0, window.next));
  const keep = new Set<ApiFixture>([...live, ...recent, ...upcoming]);
  return fixtures.filter((f) => keep.has(f));
}
