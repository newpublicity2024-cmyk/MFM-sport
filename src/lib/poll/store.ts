import { sql } from "@payloadcms/db-postgres/drizzle";
import { getPayloadClient } from "@/lib/payload/queries";

export const POLL_CHOICES = ["home", "draw", "away"] as const;
export type PollChoice = (typeof POLL_CHOICES)[number];

export type PollCounts = Record<PollChoice, number>;

export const EMPTY_COUNTS: PollCounts = { home: 0, draw: 0, away: 0 };

export function isPollChoice(value: unknown): value is PollChoice {
  return typeof value === "string" && (POLL_CHOICES as readonly string[]).includes(value);
}

/**
 * Votes live in Postgres, next to everything else this site owns.
 *
 * The obvious home was the Upstash Redis the codebase already imports — but
 * that database was archived by Upstash for inactivity (Vercel's store record
 * says `uninstalled`; the function gets ENOTFOUND for its hostname), which is
 * also why the API-Football cache and the newsletter rate limiter have had
 * nothing to talk to. A poll is durable state the owner wants to keep, so it
 * goes in the database that is actually running.
 *
 * Table `match_poll_votes` (hand-applied DDL, see CLAUDE.md): one row per
 * (fixture_id, voter_id), CHECK on the choice, index on (fixture_id, choice).
 * It is deliberately NOT a Payload collection: votes are machine-written,
 * never edited in the admin, and a collection would put ~n rows of churn
 * through Payload's hooks for nothing.
 */

type CountRow = { choice: string; n: number };
type ChoiceRow = { choice: string };

function rowsOf<T>(result: unknown): T[] {
  // node-postgres hands back a QueryResult ({ rows }); other drivers return
  // the rows directly. Accept both rather than guess the driver.
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return rows ?? [];
}

function toCounts(rows: CountRow[]): PollCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const row of rows) {
    if (isPollChoice(row.choice)) counts[row.choice] = Number(row.n) || 0;
  }
  return counts;
}

/**
 * Percentages that always sum to 100 (largest-remainder), so the bar never
 * shows 33/33/33 with a gap. No votes → zeros, and the caller shows the
 * choices rather than a bar.
 */
export function toPercentages(counts: PollCounts): PollCounts {
  const total = totalVotes(counts);
  if (total === 0) return { ...EMPTY_COUNTS };
  const exact = POLL_CHOICES.map((c) => ({ c, value: (counts[c] * 100) / total }));
  const out = { ...EMPTY_COUNTS };
  let assigned = 0;
  for (const { c, value } of exact) {
    out[c] = Math.floor(value);
    assigned += out[c];
  }
  const remainders = exact
    .map(({ c, value }) => ({ c, rem: value - Math.floor(value) }))
    .sort((a, b) => b.rem - a.rem);
  for (let i = 0; assigned < 100; i++, assigned++) {
    out[remainders[i % remainders.length]!.c] += 1;
  }
  return out;
}

export function totalVotes(counts: PollCounts): number {
  return POLL_CHOICES.reduce((sum, c) => sum + counts[c], 0);
}

/** The slice of Payload's drizzle handle this module uses — lets tests inject a fake. */
export interface PollDb {
  execute(query: unknown): Promise<unknown>;
}

async function db(): Promise<PollDb | null> {
  try {
    const payload = await getPayloadClient();
    return payload.db.drizzle as unknown as PollDb;
  } catch (error) {
    console.error("[poll] no database handle:", error);
    return null;
  }
}

export async function readCounts(fixtureId: number, handle?: PollDb | null): Promise<PollCounts | null> {
  const conn = handle === undefined ? await db() : handle;
  if (!conn) return null;
  try {
    const result = await conn.execute(sql`
      SELECT choice, count(*)::int AS n
      FROM match_poll_votes
      WHERE fixture_id = ${fixtureId}
      GROUP BY choice
    `);
    return toCounts(rowsOf<CountRow>(result));
  } catch (error) {
    console.error(`[poll] read failed for fixture ${fixtureId}:`, error);
    return null;
  }
}

export async function readVote(
  fixtureId: number,
  voterId: string,
  handle?: PollDb | null,
): Promise<PollChoice | null> {
  const conn = handle === undefined ? await db() : handle;
  if (!conn) return null;
  try {
    const result = await conn.execute(sql`
      SELECT choice FROM match_poll_votes
      WHERE fixture_id = ${fixtureId} AND voter_id = ${voterId}::uuid
      LIMIT 1
    `);
    const choice = rowsOf<ChoiceRow>(result)[0]?.choice;
    return isPollChoice(choice) ? choice : null;
  } catch (error) {
    console.error(`[poll] vote read failed for fixture ${fixtureId}:`, error);
    return null;
  }
}

export type CastResult =
  | { status: "recorded" | "already-voted"; choice: PollChoice; counts: PollCounts }
  | { status: "unavailable" };

/**
 * Record one vote.
 *
 * `ON CONFLICT DO NOTHING` makes the primary key the referee: a repeat vote
 * from the same visitor returns no row, so it is reported as the choice they
 * already hold and no count moves. One statement, no read-then-write race.
 */
export async function castVote(
  fixtureId: number,
  voterId: string,
  choice: PollChoice,
  handle?: PollDb | null,
): Promise<CastResult> {
  const conn = handle === undefined ? await db() : handle;
  if (!conn) return { status: "unavailable" };
  try {
    const inserted = await conn.execute(sql`
      INSERT INTO match_poll_votes (fixture_id, voter_id, choice)
      VALUES (${fixtureId}, ${voterId}::uuid, ${choice})
      ON CONFLICT (fixture_id, voter_id) DO NOTHING
      RETURNING choice
    `);
    const recorded = rowsOf<ChoiceRow>(inserted).length > 0;
    const counts = (await readCounts(fixtureId, conn)) ?? EMPTY_COUNTS;
    if (recorded) return { status: "recorded", choice, counts };
    const existing = (await readVote(fixtureId, voterId, conn)) ?? choice;
    return { status: "already-voted", choice: existing, counts };
  } catch (error) {
    console.error(`[poll] vote failed for fixture ${fixtureId}:`, error);
    return { status: "unavailable" };
  }
}
