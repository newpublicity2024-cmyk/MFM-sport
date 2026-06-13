import type { ApiResponse } from "./types";

const API_BASE = "https://v3.football.api-sports.io";

// Either a plain revalidate (today's default) or an explicit cache mode. When a
// call is wrapped by the shared Redis cache, pass `{ cache: "no-store" }` so we
// don't double-cache (Redis is the source of truth there).
export type FetchOpts =
  | number
  | { revalidate?: number; cache?: "no-store" | "force-cache" };

export async function fetchApi<T>(
  endpoint: string,
  params: Record<string, string | number>,
  opts: FetchOpts = 60,
): Promise<T[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    console.warn(`[API-Football] No API_FOOTBALL_KEY configured — returning empty for ${endpoint}`);
    return [] as T[];
  }

  const url = new URL(endpoint, API_BASE);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );

  const normalized = typeof opts === "number" ? { revalidate: opts } : opts;
  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: { "x-apisports-key": apiKey },
  };
  if (normalized.cache) {
    // "no-store" and "next.revalidate" are mutually exclusive in Next.js.
    init.cache = normalized.cache;
  } else {
    init.next = { revalidate: normalized.revalidate ?? 60 };
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    console.error(`[API-Football] ${res.status} ${res.statusText} for ${endpoint}`);
    return [] as T[];
  }

  const data: ApiResponse<T[]> = await res.json();

  const errs = data.errors;
  const errEntries = Array.isArray(errs)
    ? errs
    : errs && typeof errs === "object"
      ? Object.entries(errs).filter(([, v]) => v != null && v !== "")
      : [];
  if (errEntries.length > 0) {
    console.error(
      `[API-Football] errors for ${endpoint} ${JSON.stringify(params)}: ${JSON.stringify(errs)}`,
    );
    return [] as T[];
  }

  return (data.response ?? []) as T[];
}
