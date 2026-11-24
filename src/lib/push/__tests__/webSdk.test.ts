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
  PROMPT_TEXT,
  WELCOME_NOTIFICATION,
  buildOneSignalInitScript,
} from "../webSdk";

const APP_ID = "a32a8dec-858d-40eb-98d2-b6e447b78a34";
const SITE = "https://www.mfmsport.ma";
const ROOT = process.cwd();

type FakeEl = { id?: string; src?: string; defer?: boolean };

/** Runs the inline bootstrap against a stand-in window/document/location. */
function runBootstrap(origin: string, readyState: "loading" | "complete" = "loading") {
  const appended: FakeEl[] = [];
  const listeners: Record<string, () => void> = {};
  const document = {
    readyState,
    head: { appendChild: (el: FakeEl) => appended.push(el) },
    createElement: () => ({}) as FakeEl,
    getElementById: (id: string) => appended.find((el) => el.id === id) ?? null,
  };
  const window: Record<string, unknown> = {
    addEventListener: (type: string, fn: () => void) => {
      listeners[type] = fn;
    },
    requestIdleCallback: (fn: () => void) => fn(),
  };
  const code = buildOneSignalInitScript(APP_ID, SITE);
  new Function("window", "document", "location", code)(window, document, { origin });
  return { window, appended, fireLoad: () => listeners.load?.(), rerun: () => new Function("window", "document", "location", code)(window, document, { origin }) };
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
    expect(prompt).toMatchObject({ type: "push", autoPrompt: true, text: PROMPT_TEXT });
    expect(prompt?.delay.timeDelay).toBeGreaterThanOrEqual(10);
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
