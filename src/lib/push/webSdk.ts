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

/**
 * When to ask (owner's request, 24 November 2026: "whenever a user connects").
 *
 * On EVERY visit until the reader has decided in the browser — i.e. while
 * `Notification.permission` is still "default" — a few seconds after the SDK
 * is ready, at most once per tab session (not on every page of a visit).
 * `force: true` skips OneSignal's own back-off after «لاحقًا», which otherwise
 * hides the prompt for days. A reader who subscribed ("granted") or blocked
 * notifications ("denied") is never asked.
 *
 * Only this soft prompt repeats: the browser's own permission dialog appears
 * only after «اشترك», so its accept rate — which Chrome watches to decide
 * whether to quiet a site's prompts — stays high.
 */
export const PROMPT_DELAY_MS = 3_000;
/** sessionStorage marker: per tab, so a new visit (or tab) asks again. */
export const PROMPT_SESSION_KEY = "mfm-push-asked";

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
            // Shown by the bootstrap (see PROMPT_DELAY_MS), not by OneSignal's
            // scheduler, whose back-off after a dismissal lasts days. A manual
            // `Slidedown.promptPush()` still takes its text from this entry.
            autoPrompt: false,
            text: { ...PROMPT_TEXT },
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
    `w.OneSignalDeferred.push(function(OneSignal){return OneSignal.init(${scriptSafeJson(oneSignalInitOptions(appId, siteUrl))}).then(function(){ask(OneSignal);});});`,
    // The visit-level prompt (see PROMPT_DELAY_MS). Every step is guarded: a
    // storage or SDK failure must never surface as a page error.
    "function ask(OneSignal){",
    "try{if(!w.Notification||!w.navigator||!('serviceWorker' in w.navigator)||w.Notification.permission!=='default')return;}catch(e){return;}",
    `var k=${scriptSafeJson(PROMPT_SESSION_KEY)};try{if(w.sessionStorage.getItem(k))return;}catch(e){}`,
    "w.setTimeout(function(){try{w.sessionStorage.setItem(k,'1');}catch(e){}",
    "try{var p=OneSignal.Slidedown.promptPush({force:true});if(p&&p.catch)p.catch(function(){});}catch(e){}",
    `},${PROMPT_DELAY_MS});}`,
    "function load(){if(document.getElementById('onesignal-sdk'))return;",
    `var s=document.createElement('script');s.id='onesignal-sdk';s.src=${scriptSafeJson(ONESIGNAL_PAGE_SDK_URL)};s.defer=true;document.head.appendChild(s);}`,
    "function idle(){if('requestIdleCallback' in w){w.requestIdleCallback(load,{timeout:4000});}else{setTimeout(load,1);}}",
    "if(document.readyState==='complete'){idle();}else{w.addEventListener('load',idle,{once:true});}",
    "})();",
  ].join("");
}
