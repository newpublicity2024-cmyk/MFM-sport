// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OneSignalLoader } from "@/components/push/OneSignalLoader";
import {
  ONESIGNAL_PAGE_SDK_URL,
  ONESIGNAL_WORKER_SOURCE,
  PROMPT_DELAY_MS,
  PROMPT_SESSION_KEY,
  PROMPT_TEXT,
  WELCOME_NOTIFICATION,
  buildOneSignalInitScript,
} from "../webSdk";

const APP_ID = "a32a8dec-858d-40eb-98d2-b6e447b78a34";
const SITE = "https://www.mfmsport.ma";
const ROOT = process.cwd();

type FakeEl = { id?: string; src?: string; defer?: boolean };
type Timer = { fn: () => void; ms: number };

/** A per-tab sessionStorage stand-in (a new one = a new visit). */
function fakeSessionStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

/** Runs the inline bootstrap against a stand-in window/document/location. */
function runBootstrap(
  origin: string,
  readyState: "loading" | "complete" = "loading",
  browser: {
    permission?: NotificationPermission | null; // null = no Notification API at all
    serviceWorker?: boolean;
    sessionStorage?: Storage;
  } = {},
) {
  const appended: FakeEl[] = [];
  const listeners: Record<string, () => void> = {};
  const timers: Timer[] = [];
  const document = {
    readyState,
    head: { appendChild: (el: FakeEl) => appended.push(el) },
    createElement: () => ({}) as FakeEl,
    getElementById: (id: string) => appended.find((el) => el.id === id) ?? null,
  };
  const permission = browser.permission === undefined ? "default" : browser.permission;
  const window: Record<string, unknown> = {
    addEventListener: (type: string, fn: () => void) => {
      listeners[type] = fn;
    },
    requestIdleCallback: (fn: () => void) => fn(),
    setTimeout: (fn: () => void, ms: number) => timers.push({ fn, ms }),
    navigator: browser.serviceWorker === false ? {} : { serviceWorker: {} },
    sessionStorage: browser.sessionStorage ?? fakeSessionStorage(),
    ...(permission === null ? {} : { Notification: { permission } }),
  };
  const code = buildOneSignalInitScript(APP_ID, SITE);
  const run = () => new Function("window", "document", "location", code)(window, document, { origin });
  run();
  return { window, appended, timers, fireLoad: () => listeners.load?.(), rerun: run };
}

/** What the SDK hands to a OneSignalDeferred callback, with the calls we care about. */
function fakeOneSignal(opts: { promptPush?: () => Promise<void> } = {}) {
  const prompts: unknown[] = [];
  return {
    prompts,
    sdk: {
      init: async () => undefined,
      Slidedown: {
        promptPush: (o: unknown) => {
          prompts.push(o);
          return opts.promptPush ? opts.promptPush() : Promise.resolve();
        },
      },
    },
  };
}

/** Runs the queued init the way the SDK would, then lets the ask() step run. */
async function initialise(env: ReturnType<typeof runBootstrap>, os = fakeOneSignal()) {
  const queue = env.window.OneSignalDeferred as Array<(sdk: unknown) => Promise<unknown>>;
  await queue[queue.length - 1](os.sdk);
  return os;
}

describe("OneSignal web SDK bootstrap", () => {
  it("serves the worker as exactly the v16 import line", () => {
    const file = readFileSync(join(ROOT, "public", "OneSignalSDKWorker.js"), "utf8").trim();
    expect(file).toBe(ONESIGNAL_WORKER_SOURCE);
  });

  it("keeps the Arabic prompt within OneSignal's limits (90 / 15 / 15)", () => {
    expect(PROMPT_TEXT.actionMessage.length).toBeLessThanOrEqual(90);
    expect(PROMPT_TEXT.acceptButton.length).toBeLessThanOrEqual(15);
    expect(PROMPT_TEXT.cancelButton.length).toBeLessThanOrEqual(15);
    for (const text of [...Object.values(PROMPT_TEXT), ...Object.values(WELCOME_NOTIFICATION)]) {
      expect(text).toMatch(/[؀-ۿ]/);
      expect(text).not.toMatch(/[A-Za-z]/);
    }
  });

  it("does nothing at all on any origin but production (previews, localhost)", () => {
    for (const origin of ["https://mfm-sport-git-x.vercel.app", "http://localhost:3000", "https://mfmsport.ma"]) {
      const env = runBootstrap(origin);
      env.fireLoad();
      expect(env.window.OneSignalDeferred).toBeUndefined();
      expect(env.appended).toHaveLength(0);
    }
  });

  it("on production queues one init with scope '/', the root worker and the Arabic prompt", async () => {
    const env = runBootstrap(SITE);
    const queue = env.window.OneSignalDeferred as Array<(os: unknown) => unknown>;
    expect(queue).toHaveLength(1);
    type CapturedInit = Record<string, unknown> & {
      promptOptions: { slidedown: { prompts: Array<Record<string, unknown> & { delay: { timeDelay: number } }> } };
    };
    let options: CapturedInit | undefined;
    await queue[0]({ init: async (o: Record<string, unknown>) => void (options = o as CapturedInit) });
    expect(options).toMatchObject({
      appId: APP_ID,
      serviceWorkerPath: "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
      autoResubscribe: true,
      notifyButton: { enable: false },
      welcomeNotification: { disable: false, title: "إم إف إم سبور", url: `${SITE}/ar` },
    });
    const prompt = options?.promptOptions.slidedown.prompts[0];
    // The text OneSignal uses for a manual promptPush(); its own scheduler is off.
    expect(prompt).toMatchObject({ type: "push", autoPrompt: false, text: PROMPT_TEXT });
  });

  it("asks on a visit: forces the Arabic slidedown a few seconds after the SDK is ready", async () => {
    const env = runBootstrap(SITE);
    const os = await initialise(env);
    expect(env.timers).toHaveLength(1);
    expect(env.timers[0].ms).toBe(PROMPT_DELAY_MS);
    expect(PROMPT_DELAY_MS).toBeLessThanOrEqual(5_000);
    expect(os.prompts).toHaveLength(0); // not before the delay
    env.timers[0].fn();
    // force: true is what skips OneSignal's days-long back-off after «لاحقًا»
    expect(os.prompts).toEqual([{ force: true }]);
    expect((env.window.sessionStorage as Storage).getItem(PROMPT_SESSION_KEY)).toBe("1");
  });

  it("asks once per visit: not again on the next page of the same tab", async () => {
    const tab = fakeSessionStorage();
    const first = runBootstrap(SITE, "loading", { sessionStorage: tab });
    (await initialise(first), first.timers[0].fn());
    const nextPage = runBootstrap(SITE, "loading", { sessionStorage: tab });
    const os = await initialise(nextPage);
    expect(nextPage.timers).toHaveLength(0);
    expect(os.prompts).toHaveLength(0);
  });

  it("asks again on a new visit after «لاحقًا» (a new tab session, permission still default)", async () => {
    const earlier = runBootstrap(SITE, "loading", { sessionStorage: fakeSessionStorage() });
    (await initialise(earlier), earlier.timers[0].fn());
    const laterVisit = runBootstrap(SITE, "loading", { sessionStorage: fakeSessionStorage() });
    const os = await initialise(laterVisit);
    laterVisit.timers[0].fn();
    expect(os.prompts).toEqual([{ force: true }]);
  });

  it("never asks a reader who has decided in the browser (granted or denied)", async () => {
    for (const permission of ["granted", "denied"] as const) {
      const env = runBootstrap(SITE, "loading", { permission });
      const os = await initialise(env);
      expect(env.timers).toHaveLength(0);
      expect(os.prompts).toHaveLength(0);
    }
  });

  it("never asks where web push cannot work (no Notification API, no service workers)", async () => {
    for (const browser of [{ permission: null }, { serviceWorker: false }] as const) {
      const env = runBootstrap(SITE, "loading", browser);
      const os = await initialise(env);
      expect(env.timers).toHaveLength(0);
      expect(os.prompts).toHaveLength(0);
    }
  });

  it("a blocked sessionStorage or a failing promptPush never escapes as a page error", async () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    const env = runBootstrap(SITE, "loading", { sessionStorage: blocked });
    const os = await initialise(env, fakeOneSignal({ promptPush: () => Promise.reject(new Error("opted out")) }));
    expect(() => env.timers[0].fn()).not.toThrow();
    expect(os.prompts).toEqual([{ force: true }]); // still asks, once per page
    await new Promise((r) => setTimeout(r, 0)); // the rejection is caught, not unhandled
  });

  it("fetches the SDK only after load, exactly once, even if the bootstrap runs twice", () => {
    const env = runBootstrap(SITE);
    expect(env.appended).toHaveLength(0); // not before `load`
    env.fireLoad();
    env.rerun();
    env.fireLoad();
    expect(env.appended).toHaveLength(1);
    expect(env.appended[0]).toMatchObject({ id: "onesignal-sdk", src: ONESIGNAL_PAGE_SDK_URL, defer: true });
  });

  it("loads immediately (in idle time) when the page has already finished loading", () => {
    const env = runBootstrap(SITE, "complete");
    expect(env.appended).toHaveLength(1);
  });

  it("cannot break out of its <script> tag whatever the configured values contain", () => {
    const code = buildOneSignalInitScript("</script><img src=x onerror=alert(1)>", SITE);
    expect(code).not.toMatch(/<\//);
    expect(code).not.toContain("<img");
  });
});

describe("<OneSignalLoader>", () => {
  it("renders nothing without an app id and one inline script with it", () => {
    expect(renderToStaticMarkup(createElement(OneSignalLoader, { appId: undefined }))).toBe("");
    const html = renderToStaticMarkup(createElement(OneSignalLoader, { appId: APP_ID }));
    expect(html.match(/<script id="onesignal-init">/g)).toHaveLength(1);
    expect(html).toContain(APP_ID);
  });

  it("is mounted in the (site) layout and nowhere above it (no 404s, no admin)", () => {
    const site = readFileSync(join(ROOT, "src/app/(frontend)/[locale]/(site)/layout.tsx"), "utf8");
    const frontend = readFileSync(join(ROOT, "src/app/(frontend)/layout.tsx"), "utf8");
    const locale = readFileSync(join(ROOT, "src/app/(frontend)/[locale]/layout.tsx"), "utf8");
    expect(site.match(/<OneSignalLoader\b/g)).toHaveLength(1);
    expect(frontend).not.toMatch(/OneSignal/);
    expect(locale).not.toMatch(/OneSignal/);
  });
});
