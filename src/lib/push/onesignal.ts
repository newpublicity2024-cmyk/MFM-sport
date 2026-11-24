/**
 * OneSignal REST client — the one function that sends a notification.
 *
 * Contract: it NEVER throws and ALWAYS settles within a bound. It runs inside
 * `after()` once the editor's save has already succeeded, so a OneSignal outage
 * costs a log line, never a failed publish. Every outbound call on this site
 * carries an explicit bound (see the CLAUDE.md landmine on 94-second TTFBs);
 * this one is ONESIGNAL_TIMEOUT_MS per attempt, two attempts at most.
 *
 * The retry is safe only because every article body carries a deterministic
 * `idempotency_key` — OneSignal answers a replay with the original result
 * instead of sending again.
 */
import type { OneSignalPushBody } from "./articleNotification";

export const ONESIGNAL_NOTIFICATIONS_URL = "https://api.onesignal.com/notifications";
export const ONESIGNAL_TIMEOUT_MS = 5_000;
export const ONESIGNAL_RETRY_DELAY_MS = 1_000;

export type SendResult =
  | { ok: true; id: string; attempts: number }
  | { ok: false; status?: number; error: string; attempts: number };

type SendOptions = {
  /** App API key (`os_v2_app_…`). An Organization key is refused by this endpoint. */
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  url?: string;
};

type Attempt = { result: SendResult; retryable: boolean };

async function attemptOnce(
  body: OneSignalPushBody,
  opts: Required<Omit<SendOptions, "retryDelayMs">>,
  attempt: number,
): Promise<Attempt> {
  let res: Response;
  try {
    res = await opts.fetchImpl(opts.url, {
      method: "POST",
      headers: {
        Authorization: `Key ${opts.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    const error = name === "TimeoutError" || name === "AbortError" ? "timeout" : `network: ${String(err)}`;
    return { result: { ok: false, error, attempts: attempt }, retryable: true };
  }

  let json: { id?: unknown; errors?: unknown } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    // A non-JSON body (an HTML error page from a proxy) is reported by status.
  }

  if (res.ok && typeof json.id === "string" && json.id.length > 0) {
    return { result: { ok: true, id: json.id, attempts: attempt }, retryable: false };
  }

  // HTTP 200 with no id means "accepted but nobody to send to" — e.g. the
  // segment is empty. Not a transport failure, so not retried.
  const errors = Array.isArray(json.errors)
    ? json.errors.map(String).join("; ")
    : json.errors && typeof json.errors === "object"
      ? JSON.stringify(json.errors)
      : "";
  return {
    result: {
      ok: false,
      status: res.status,
      error: errors || (res.ok ? "no notification id returned" : `HTTP ${res.status}`),
      attempts: attempt,
    },
    retryable: res.status === 429 || res.status >= 500,
  };
}

export async function sendOneSignalNotification(
  body: OneSignalPushBody,
  options: SendOptions,
): Promise<SendResult> {
  const opts = {
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? ONESIGNAL_TIMEOUT_MS,
    url: options.url ?? ONESIGNAL_NOTIFICATIONS_URL,
  };
  const retryDelayMs = options.retryDelayMs ?? ONESIGNAL_RETRY_DELAY_MS;
  try {
    const first = await attemptOnce(body, opts, 1);
    if (first.result.ok || !first.retryable) return first.result;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return (await attemptOnce(body, opts, 2)).result;
  } catch (err) {
    // attemptOnce already catches; this is the belt to its braces.
    return { ok: false, error: `unexpected: ${String(err)}`, attempts: 0 };
  }
}
