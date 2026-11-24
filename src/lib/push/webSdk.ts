/**
 * OneSignal Web SDK (v16) — page-side configuration, as data.
 *
 * Why these exact values:
 *
 * - **Worker at `/OneSignalSDKWorker.js`, scope `/`.** The WordPress plugin
 *   registered its worker with scope `/` on this same origin (archived homepage,
 *   March 2025: `SERVICE_WORKER_PARAM = { scope: "/" }`). A registration is keyed
 *   by origin + scope, so registering the new script at the same scope is an
 *   UPDATE of the old registration, and its push subscription carries over.
 *   Any other scope would create a second registration and a second
 *   subscription — returning subscribers would get every article twice.
 *   It also matches the app's dashboard config (path "/", scope "/").
 *
 * - **Options in code take effect.** The app's dashboard integration is still
 *   "wordpress", which the SDK treats like "custom" (it honours init options);
 *   verified in OneSignalSDK.page.es6.js: `case "custom": case "wordpress":
 *   return {configuration: 1}`. Every prompt is disabled in the dashboard, so
 *   without the slidedown below nobody would ever be asked.
 *
 * - **Origin guard.** The app only accepts https://www.mfmsport.ma; on a preview
 *   or localhost the SDK would throw. The guard also keeps previews from
 *   loading a third-party script for nothing.
 *
 * - **After `load`, in idle time.** The SDK is not part of reading an article;
 *   it must not compete with the LCP image.
 */
import { SITE_NAME_AR } from "@/lib/seo/siteIdentity";
import { SITE_URL } from "@/lib/seo/siteUrl";

/**
 * The OneSignal app `mfmsport.ma` (created 2019 by the WordPress plugin; origin
 * https://www.mfmsport.ma). Public by design — the SDK puts it in every page —
 * so it is a constant like SITE_URL, overridable by env. Only the App API key
 * (ONESIGNAL_APP_API_KEY) is a secret.
 */
export const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "a32a8dec-858d-40eb-98d2-b6e447b78a34";

export const ONESIGNAL_PAGE_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
export const ONESIGNAL_WORKER_FILE = "OneSignalSDKWorker.js";
export const ONESIGNAL_WORKER_SCOPE = "/";
/** The exact content of public/OneSignalSDKWorker.js (checked by verify-push). */
export const ONESIGNAL_WORKER_SOURCE =
  'importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");';

/** OneSignal's documented limits: actionMessage ≤ 90, buttons ≤ 15 characters. */
export const PROMPT_TEXT = {
  actionMessage: "فعّل الإشعارات لتصلك أهم أخبار الرياضة فور نشرها. يمكنك إيقافها متى شئت.",
  acceptButton: "اشترك",
  cancelButton: "لاحقًا",
} as const;

/** Replaces the dashboard's English "Thanks for subscribing!". */
export const WELCOME_NOTIFICATION = {
  title: SITE_NAME_AR,
  message: "شكرًا لاشتراكك! ستصلك أهم الأخبار فور نشرها.",
} as const;

export function oneSignalInitOptions(appId: string, siteUrl: string = SITE_URL) {
  return {
    appId,
    serviceWorkerPath: ONESIGNAL_WORKER_FILE,
    serviceWorkerParam: { scope: ONESIGNAL_WORKER_SCOPE },
    // Returning WordPress-era subscribers whose browser still grants permission
    // are re-attached silently instead of being asked again.
    autoResubscribe: true,
    notifyButton: { enable: false },
    welcomeNotification: {
      disable: false,
      title: WELCOME_NOTIFICATION.title,
      message: WELCOME_NOTIFICATION.message,
      url: `${siteUrl}/ar`,
    },
    promptOptions: {
      slidedown: {
        prompts: [
          {
            type: "push",
            autoPrompt: true,
            text: { ...PROMPT_TEXT },
            // The soft prompt first; the browser's own permission dialog only
            // after "اشترك". Not on arrival: a reader gets 15 s with the page.
            delay: { pageViews: 1, timeDelay: 15 },
          },
        ],
      },
    },
  };
}

/** JSON that is safe inside an inline <script>: no `</script>` breakout. */
function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c");
}

/** The inline bootstrap rendered once by <OneSignalLoader>. */
export function buildOneSignalInitScript(appId: string, siteUrl: string = SITE_URL): string {
  const origin = new URL(siteUrl).origin;
  return [
    "(function(){",
    `if(location.origin!==${scriptSafeJson(origin)})return;`,
    "var w=window;w.OneSignalDeferred=w.OneSignalDeferred||[];",
    `w.OneSignalDeferred.push(function(OneSignal){return OneSignal.init(${scriptSafeJson(oneSignalInitOptions(appId, siteUrl))});});`,
    "function load(){if(document.getElementById('onesignal-sdk'))return;",
    `var s=document.createElement('script');s.id='onesignal-sdk';s.src=${scriptSafeJson(ONESIGNAL_PAGE_SDK_URL)};s.defer=true;document.head.appendChild(s);}`,
    "function idle(){if('requestIdleCallback' in w){w.requestIdleCallback(load,{timeout:4000});}else{setTimeout(load,1);}}",
    "if(document.readyState==='complete'){idle();}else{w.addEventListener('load',idle,{once:true});}",
    "})();",
  ].join("");
}
