/**
 * Articles `afterChange` hook: one web push when an editorial article is
 * published for the first time. The rules live in `decideArticlePush`; this
 * file is the wiring.
 *
 * Why `after()` and not an inline `await`: Payload runs `afterChange` INSIDE the
 * save's database transaction. Sending from here would notify 1,364 phones
 * about an article whose commit could still roll back, and would add OneSignal's
 * latency to the editor's Save. `after()` runs the task once the response has
 * been sent — i.e. after the commit — and Vercel keeps the function alive for
 * it (waitUntil). Outside a Next request (a CLI script) `after()` throws; the
 * catch below turns that into "not sent", which is the right outcome for a
 * script anyway.
 *
 * Nothing in here can fail the save: every path is caught and logged.
 */
import { after } from "next/server";
import type { CollectionAfterChangeHook } from "payload";
import { SITE_URL } from "@/lib/seo/siteUrl";
import {
  buildArticleNotification,
  decideArticlePush,
  ROUTINE_SKIPS,
  type NotifiableArticle,
  type PushEnv,
} from "./articleNotification";
import { sendOneSignalNotification } from "./onesignal";
import { ONESIGNAL_APP_ID } from "./webSdk";

export type NotifyDeps = {
  schedule: (task: () => Promise<void>) => void;
  send: typeof sendOneSignalNotification;
  env: () => PushEnv;
  now: () => Date;
  siteUrl: string;
};

const defaultDeps: NotifyDeps = {
  schedule: (task) => after(task),
  send: sendOneSignalNotification,
  env: () => ({
    VERCEL_ENV: process.env.VERCEL_ENV,
    ONESIGNAL_APP_API_KEY: process.env.ONESIGNAL_APP_API_KEY,
    NEXT_PUBLIC_ONESIGNAL_APP_ID: ONESIGNAL_APP_ID,
  }),
  now: () => new Date(),
  siteUrl: SITE_URL,
};

export function createNotifyArticlePublished(
  overrides: Partial<NotifyDeps> = {},
): CollectionAfterChangeHook {
  const deps: NotifyDeps = { ...defaultDeps, ...overrides };

  return async ({ doc, previousDoc, operation, req, context }) => {
    const logger = req.payload.logger;
    try {
      const env = deps.env();
      const decision = decideArticlePush({
        doc,
        previousDoc,
        operation,
        context,
        env,
        now: deps.now(),
      });
      if (!decision.send) {
        if (!ROUTINE_SKIPS.has(decision.reason)) {
          logger.info(
            { articleId: doc.id, reason: decision.reason },
            "[push] article published; notification skipped",
          );
        }
        return doc;
      }

      // Arabic regardless of the admin tab the editor saved from, depth 1 for
      // the featured image's URL, and `req` so the read happens inside this
      // save's transaction — on a create the row is not committed yet, and a
      // read on another connection would not find it.
      const article = await req.payload.findByID({
        collection: "articles",
        id: doc.id,
        locale: "ar",
        depth: 1,
        req,
        overrideAccess: true,
      });
      const body = buildArticleNotification(article as NotifiableArticle, {
        appId: env.NEXT_PUBLIC_ONESIGNAL_APP_ID as string,
        siteUrl: deps.siteUrl,
      });
      const apiKey = env.ONESIGNAL_APP_API_KEY as string;

      try {
        deps.schedule(async () => {
          const result = await deps.send(body, { apiKey });
          if (result.ok) {
            logger.info(
              { articleId: doc.id, notificationId: result.id, attempts: result.attempts },
              "[push] article notification sent",
            );
          } else {
            logger.error(
              { articleId: doc.id, status: result.status, error: result.error, attempts: result.attempts },
              "[push] article notification failed",
            );
          }
        });
      } catch (err) {
        logger.warn(
          { err, articleId: doc.id },
          "[push] no request scope to defer the send (script?); notification not sent",
        );
      }
    } catch (err) {
      logger.error(
        { err, articleId: doc.id },
        "[push] article publish hook failed; the save itself succeeded",
      );
    }
    return doc;
  };
}

export const notifyArticlePublished = createNotifyArticlePublished();
