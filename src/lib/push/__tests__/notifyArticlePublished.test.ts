// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createNotifyArticlePublished, type NotifyDeps } from "../notifyArticlePublished";
import { Articles } from "@/collections/Articles";
import { notifyArticlePublished } from "../notifyArticlePublished";
import { revalidateArticleChange } from "@/lib/payload/revalidate";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const ENV = {
  VERCEL_ENV: "production",
  ONESIGNAL_APP_API_KEY: "os_v2_app_k",
  NEXT_PUBLIC_ONESIGNAL_APP_ID: "a32a8dec-858d-40eb-98d2-b6e447b78a34",
};
const DOC = { id: 77, status: "published", seoTier: "editorial", publishedAt: NOW.toISOString(), title: "Titre FR" };
const AR = {
  ...DOC,
  title: "عنوان عربي",
  slug: "عنوان-عربي",
  body: { root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "نص المقال" }] }] } },
};

function harness(over: Partial<NotifyDeps> = {}, findByID = vi.fn(async () => AR)) {
  const tasks: Array<() => Promise<void>> = [];
  const send = vi.fn(async () => ({ ok: true as const, id: "n-1", attempts: 1 }));
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const hook = createNotifyArticlePublished({
    schedule: (task) => {
      tasks.push(task);
    },
    send,
    env: () => ENV,
    now: () => NOW,
    siteUrl: "https://www.mfmsport.ma",
    ...over,
  });
  const req = { payload: { logger, findByID }, locale: "fr" };
  const run = (args: Record<string, unknown> = {}) =>
    // The hook only reads these fields; the full Payload arg type is not needed here.
    hook({ doc: DOC, previousDoc: { status: "draft" }, operation: "update", req, context: {}, ...args } as never);
  return { tasks, send, logger, findByID, req, run };
}

describe("notifyArticlePublished hook", () => {
  it("defers the send until after the response, then sends the Arabic notification once", async () => {
    const h = harness();
    const returned = await h.run();
    expect(returned).toBe(DOC);
    expect(h.send).not.toHaveBeenCalled(); // nothing leaves inside the transaction
    expect(h.tasks).toHaveLength(1);
    await h.tasks[0]();
    expect(h.send).toHaveBeenCalledTimes(1);
    const [body, opts] = h.send.mock.calls[0] as unknown as [{ headings: { ar: string }; app_id: string }, { apiKey: string }];
    expect(body.headings.ar).toBe("عنوان عربي");
    expect(body.app_id).toBe(ENV.NEXT_PUBLIC_ONESIGNAL_APP_ID);
    expect(opts.apiKey).toBe(ENV.ONESIGNAL_APP_API_KEY);
    expect(h.logger.info).toHaveBeenCalledWith(expect.objectContaining({ notificationId: "n-1" }), expect.any(String));
  });

  it("reads the article in Arabic, depth 1, inside the save's transaction", async () => {
    const h = harness();
    await h.run();
    expect(h.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "articles", id: 77, locale: "ar", depth: 1, req: h.req }),
    );
  });

  it("schedules nothing and logs nothing on a routine save", async () => {
    const h = harness();
    await h.run({ previousDoc: { status: "published" } });
    await h.run({ doc: { ...DOC, status: "draft" } });
    expect(h.tasks).toHaveLength(0);
    expect(h.findByID).not.toHaveBeenCalled();
    expect(h.logger.info).not.toHaveBeenCalled();
  });

  it("logs the reason when a publish is deliberately not notified", async () => {
    const h = harness({ env: () => ({ ...ENV, VERCEL_ENV: "preview" }) });
    await h.run();
    expect(h.tasks).toHaveLength(0);
    expect(h.logger.info).toHaveBeenCalledWith(expect.objectContaining({ reason: "not-production" }), expect.any(String));
  });

  it("never fails the save when the read throws", async () => {
    const h = harness({}, vi.fn(async () => {
      throw new Error("db down");
    }));
    await expect(h.run()).resolves.toBe(DOC);
    expect(h.tasks).toHaveLength(0);
    expect(h.logger.error).toHaveBeenCalled();
  });

  it("sends nothing and does not throw without a request scope (a CLI script)", async () => {
    const h = harness({
      schedule: () => {
        throw new Error("`after` was called outside a request scope.");
      },
    });
    await expect(h.run()).resolves.toBe(DOC);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.logger.warn).toHaveBeenCalled();
  });

  it("logs a failed send as an error", async () => {
    const h = harness({ send: vi.fn(async () => ({ ok: false as const, status: 403, error: "Access denied", attempts: 1 })) });
    await h.run();
    await h.tasks[0]();
    expect(h.logger.error).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }), expect.any(String));
  });

  it("is wired into Articles.afterChange after revalidation", () => {
    expect(Articles.hooks?.afterChange).toEqual([revalidateArticleChange, notifyArticlePublished]);
  });
});
