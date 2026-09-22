import { Redis } from "@upstash/redis";
import { REDIS_COMMAND_TIMEOUT_MS } from "@/lib/cache";

export const POLL_CHOICES = ["home", "draw", "away"] as const;
export type PollChoice = (typeof POLL_CHOICES)[number];

export type PollCounts = Record<PollChoice, number>;

export function isPollChoice(value: unknown): value is PollChoice {
  return typeof value === "string" && (POLL_CHOICES as readonly string[]).includes(value);
}

/** The subset of Redis the poll uses — lets tests inject a fake. */
export interface PollRedis {
  hgetall(key: string): Promise<Record<string, unknown> | null>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<unknown>;
}

const PREFIX = "poll:";
/**
 * Votes outlive the match by a season: a finished match keeps showing what
 * people expected, and the key set stays bounded without a sweeper.
 */
const TTL_SECONDS = 180 * 24 * 60 * 60;

export function countsKey(fixtureId: number): string {
  return `${PREFIX}c:${fixtureId}`;
}
export function voterKey(fixtureId: number, voterId: string): string {
  return `${PREFIX}v:${fixtureId}:${voterId}`;
}

export const EMPTY_COUNTS: PollCounts = { home: 0, draw: 0, away: 0 };

function toCounts(raw: Record<string, unknown> | null): PollCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const choice of POLL_CHOICES) {
    const n = Number(raw?.[choice] ?? 0);
    counts[choice] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return counts;
}

/**
 * Percentages that always sum to 100 (largest-remainder), so the bar never
 * shows 33/33/33 with a gap. No votes → zeros, and the caller shows the
 * choices rather than a bar.
 */
export function toPercentages(counts: PollCounts): PollCounts {
  const total = POLL_CHOICES.reduce((sum, c) => sum + counts[c], 0);
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

let _redis: PollRedis | null | undefined;

/**
 * The poll's Redis client, or null when no store is configured.
 *
 * Accepts Vercel's `KV_REST_API_*` names as well as `UPSTASH_REDIS_REST_*`:
 * this project's Vercel environment exposes the store under the KV names, and
 * a poll that silently accepts no votes is worse than one that is visibly off.
 * Same bounds as lib/cache: one retry, a per-command timeout.
 */
export function pollRedis(): PollRedis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  _redis = url && token
    ? (new Redis({
        url,
        token,
        retry: { retries: 1, backoff: () => 200 },
        signal: () => AbortSignal.timeout(REDIS_COMMAND_TIMEOUT_MS),
      }) as unknown as PollRedis)
    : null;
  return _redis;
}

/** Test seam. */
export function __setPollRedis(client: PollRedis | null | undefined): void {
  _redis = client;
}

export async function readCounts(fixtureId: number, redis = pollRedis()): Promise<PollCounts | null> {
  if (!redis) return null;
  try {
    return toCounts(await redis.hgetall(countsKey(fixtureId)));
  } catch (error) {
    console.error(`[poll] read failed for fixture ${fixtureId}:`, error);
    return null;
  }
}

export async function readVote(
  fixtureId: number,
  voterId: string,
  redis = pollRedis(),
): Promise<PollChoice | null> {
  if (!redis) return null;
  try {
    const value = await redis.get(voterKey(fixtureId, voterId));
    return isPollChoice(value) ? value : null;
  } catch (error) {
    console.error(`[poll] vote read failed for fixture ${fixtureId}:`, error);
    return null;
  }
}

export type CastResult =
  | { status: "recorded" | "already-voted"; choice: PollChoice; counts: PollCounts }
  | { status: "unavailable" };

/**
 * Record one vote. The voter key is written with NX, so a repeat vote from the
 * same cookie never increments a counter — the returned choice is the one
 * already held. Counters are incremented only after the claim succeeds.
 */
export async function castVote(
  fixtureId: number,
  voterId: string,
  choice: PollChoice,
  redis = pollRedis(),
): Promise<CastResult> {
  if (!redis) return { status: "unavailable" };
  try {
    const claim = await redis.set(voterKey(fixtureId, voterId), choice, {
      nx: true,
      ex: TTL_SECONDS,
    });
    const won = claim === "OK" || claim === true;
    if (!won) {
      const existing = (await readVote(fixtureId, voterId, redis)) ?? choice;
      const counts = (await readCounts(fixtureId, redis)) ?? EMPTY_COUNTS;
      return { status: "already-voted", choice: existing, counts };
    }
    await redis.hincrby(countsKey(fixtureId), choice, 1);
    // Keep the counter hash alive as long as the votes that built it.
    try {
      await redis.set(`${PREFIX}t:${fixtureId}`, 1, { ex: TTL_SECONDS });
    } catch {
      /* the marker is a nicety, not the vote */
    }
    const counts = (await readCounts(fixtureId, redis)) ?? EMPTY_COUNTS;
    return { status: "recorded", choice, counts };
  } catch (error) {
    console.error(`[poll] vote failed for fixture ${fixtureId}:`, error);
    return { status: "unavailable" };
  }
}
