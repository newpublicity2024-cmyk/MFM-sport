// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { ONESIGNAL_NOTIFICATIONS_URL, sendOneSignalNotification } from "../onesignal";
import type { OneSignalPushBody } from "../articleNotification";

const BODY = {
  app_id: "a32a8dec-858d-40eb-98d2-b6e447b78a34",
  target_channel: "push",
  included_segments: ["Subscribed Users"],
  name: "article:1",
  headings: { en: "عنوان", ar: "عنوان" },
  contents: { en: "نص", ar: "نص" },
  url: "https://www.mfmsport.ma/ar/articles/x",
  chrome_web_icon: "https://www.mfmsport.ma/apple-icon.png",
  firefox_icon: "https://www.mfmsport.ma/apple-icon.png",
  web_push_topic: "article-1",
  ttl: 86400,
  idempotency_key: "ddc16a02-9182-5fc3-966b-424d3a365051",
} satisfies OneSignalPushBody;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("sendOneSignalNotification", () => {
  it("POSTs the body with the App key and returns the notification id", async () => {
    const fetchImpl = vi.fn(async () => json(200, { id: "b98881cc-1e94-4366-bbd9-db8f3429292b", external_id: null }));
    const result = await sendOneSignalNotification(BODY, { apiKey: "os_v2_app_k", fetchImpl });
    expect(result).toEqual({ ok: true, id: "b98881cc-1e94-4366-bbd9-db8f3429292b", attempts: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ONESIGNAL_NOTIFICATIONS_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Key os_v2_app_k");
    expect(JSON.parse(init.body as string)).toEqual(BODY);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports 'accepted but nobody to send to' as a failure without retrying", async () => {
    const fetchImpl = vi.fn(async () => json(200, { id: "", errors: ["All included players are not subscribed"] }));
    const result = await sendOneSignalNotification(BODY, { apiKey: "k", fetchImpl, retryDelayMs: 1 });
    expect(result).toEqual({ ok: false, status: 200, error: "All included players are not subscribed", attempts: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once on a 5xx and on a 429, then succeeds", async () => {
    for (const status of [503, 429]) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(json(status, { errors: ["busy"] }))
        .mockResolvedValueOnce(json(200, { id: "n-2" }));
      const result = await sendOneSignalNotification(BODY, { apiKey: "k", fetchImpl, retryDelayMs: 1 });
      expect(result).toEqual({ ok: true, id: "n-2", attempts: 2 });
    }
  });

  it("does not retry a client error (bad key, bad body)", async () => {
    for (const status of [400, 401, 403]) {
      const fetchImpl = vi.fn(async () => json(status, { errors: ["Access denied"] }));
      const result = await sendOneSignalNotification(BODY, { apiKey: "k", fetchImpl, retryDelayMs: 1 });
      expect(result).toMatchObject({ ok: false, status, error: "Access denied", attempts: 1 });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("settles within its bound against a server that never answers, and never throws", async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const started = Date.now();
    const result = await sendOneSignalNotification(BODY, { apiKey: "k", fetchImpl: hang, timeoutMs: 50, retryDelayMs: 10 });
    const elapsed = Date.now() - started;
    expect(result).toEqual({ ok: false, error: "timeout", attempts: 2 });
    expect(elapsed).toBeLessThan(1_000);
  });

  it("turns a network failure and a non-JSON error page into results, not exceptions", async () => {
    const boom = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(sendOneSignalNotification(BODY, { apiKey: "k", fetchImpl: boom, retryDelayMs: 1 })).resolves.toMatchObject({
      ok: false,
      attempts: 2,
    });
    const html = vi.fn(async () => new Response("<html>502</html>", { status: 502 }));
    await expect(sendOneSignalNotification(BODY, { apiKey: "k", fetchImpl: html, retryDelayMs: 1 })).resolves.toEqual({
      ok: false,
      status: 502,
      error: "HTTP 502",
      attempts: 2,
    });
  });
});
