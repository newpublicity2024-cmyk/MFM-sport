import type { ApiFixture } from "@/lib/api-football/types";
import { getMatchStatus } from "@/lib/api-football/types";

/**
 * Whether a fixture still accepts votes: only before kick-off, and only for a
 * match that is actually going ahead. Enforced on the server — the island
 * hides the buttons too, but that is presentation, not the rule.
 */
export function isVotingOpen(fixture: ApiFixture, now: Date = new Date()): boolean {
  if (getMatchStatus(fixture.fixture.status.short) !== "scheduled") return false;
  if (fixture.fixture.status.short === "TBD") return true;
  return new Date(fixture.fixture.date).getTime() > now.getTime();
}
