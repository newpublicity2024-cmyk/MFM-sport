import { buildOneSignalInitScript } from "@/lib/push/webSdk";

/**
 * Web-push subscription bootstrap (OneSignal). Rendered once, from
 * `[locale]/(site)/layout.tsx` — the same boundary as the ads — so 404 pages
 * and the Payload admin never ask anyone to subscribe.
 *
 * A plain inline <script>, not next/script: it is a real tag in the served
 * HTML (countable by `scripts/verify-push.ts served`), it runs once per
 * document load, and the layout persists across client navigations so it is
 * never re-run. All it does synchronously is queue the init; the SDK itself is
 * fetched after `load`, in idle time, and only on the production origin.
 */
export function OneSignalLoader({ appId }: { appId: string | undefined }) {
  if (!appId) return null;
  return (
    <script
      id="onesignal-init"
      dangerouslySetInnerHTML={{ __html: buildOneSignalInitScript(appId) }}
    />
  );
}
