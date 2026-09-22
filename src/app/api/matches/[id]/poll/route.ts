import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getFixtureById } from "@/lib/api-football/fixtures";
import { checkRateLimit } from "@/lib/rate-limit";
import { isVotingOpen } from "@/lib/poll/voting";
import {
  castVote,
  isPollChoice,
  readCounts,
  readVote,
  toPercentages,
  totalVotes,
} from "@/lib/poll/store";

/**
 * The match-page winner poll.
 *
 * GET returns the counts; POST records one vote per visitor. Deliberately a
 * POST route and not a link: a crawler follows links, so `?vote=home` would
 * both cast votes and mint crawlable URLs. Counts never appear in the page
 * HTML — the island fetches them — so a vote never invalidates the ISR cache.
 */
export const dynamic = "force-dynamic";

const VOTER_COOKIE = "mfm_voter";
const VOTER_MAX_AGE = 180 * 24 * 60 * 60;

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function body(counts: Awaited<ReturnType<typeof readCounts>>, extra: Record<string, unknown> = {}) {
  if (!counts) return { available: false, ...extra };
  return {
    available: true,
    counts,
    percentages: toPercentages(counts),
    total: totalVotes(counts),
    ...extra,
  };
}

export async function GET(_req: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const store = await cookies();
  const voterId = store.get(VOTER_COOKIE)?.value ?? null;
  const [counts, myVote] = await Promise.all([
    readCounts(id),
    voterId ? readVote(id, voterId) : Promise.resolve(null),
  ]);
  return NextResponse.json(body(counts, { myVote }), {
    // Per-visitor (myVote) and short-lived: never shared by a CDN.
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(req: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const { success } = await checkRateLimit(`poll:${ip}`);
  if (!success) return NextResponse.json({ error: "too many requests" }, { status: 429 });

  let choice: unknown;
  try {
    ({ choice } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!isPollChoice(choice)) {
    return NextResponse.json({ error: "choice must be home, draw or away" }, { status: 400 });
  }

  const fixture = await getFixtureById(id);
  if (!fixture) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isVotingOpen(fixture)) {
    const counts = await readCounts(id);
    return NextResponse.json(body(counts, { error: "voting closed" }), { status: 409 });
  }

  const store = await cookies();
  let voterId = store.get(VOTER_COOKIE)?.value;
  let isNewVoter = false;
  if (!voterId) {
    voterId = randomUUID();
    isNewVoter = true;
  }

  const result = await castVote(id, voterId, choice);
  if (result.status === "unavailable") {
    return NextResponse.json({ available: false }, { status: 503 });
  }

  const res = NextResponse.json(
    body(result.counts, { myVote: result.choice, recorded: result.status === "recorded" }),
    { headers: { "cache-control": "private, no-store" } },
  );
  if (isNewVoter) {
    // First-party, httpOnly, per-visitor id — no IP is stored, which keeps the
    // poll clear of personal-data obligations (Law 09-08).
    res.cookies.set(VOTER_COOKIE, voterId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VOTER_MAX_AGE,
    });
  }
  return res;
}
