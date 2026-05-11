import type { ApiResponse } from "./types";

const API_BASE = "https://v3.football.api-sports.io";

export async function fetchApi<T>(
  endpoint: string,
  params: Record<string, string | number>,
  revalidate: number = 60,
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

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": apiKey,
    },
    next: { revalidate },
  });

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

  return data.response;
}
