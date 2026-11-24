/**
 * scripts/verify-push.ts
 *
 * Gates for the OneSignal article push (src/lib/push). Every subcommand prints
 * a success-only marker after its last assertion and exits non-zero on the
 * first failure, so it can back an unlazy gate (.unlazy/GATES-onesignal-push.md).
 *
 *   pnpm exec tsx scripts/verify-push.ts decide | payload | hook | sender | loader
 *   pnpm exec tsx scripts/verify-push.ts no-secret | static | suite
 *   pnpm exec tsx scripts/verify-push.ts live                  # OneSignal API, sends to NOBODY
 *   pnpm exec tsx scripts/verify-push.ts vercel-env            # Vercel CLI with access to the team
 *   pnpm exec tsx scripts/verify-push.ts served <base-url>     # served bytes
 *   pnpm exec tsx scripts/verify-push.ts prompt <base-url> [--no-route]
 *   pnpm exec tsx scripts/verify-push.ts prod-sent --since <ISO instant of the deploy>
 *
 * Secrets: `live` and `prod-sent` read ONESIGNAL_APP_API_KEY from the
 * environment or .env.local and never print it.
 *
 * Protected previews (Vercel Authentication): run `served` / `prompt` under
 *   vercel env run --scope newpublicitys-projects --project mfm-sport -- pnpm exec tsx scripts/verify-push.ts served <preview-url>
 * which provides a short-lived VERCEL_OIDC_TOKEN; it is sent as
 * `x-vercel-trusted-oidc-idp-token` to *.vercel.app hosts only, never printed.
 *
 * `live` is built so that it CANNOT reach a subscriber: it strips the segment
 * from the real payload, targets one freshly generated subscription id that
 * does not exist, and asserts both before sending.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PUSH_SEGMENT,
  buildArticleNotification,
  decideArticlePush,
} from "../src/lib/push/articleNotification";
import { sendOneSignalNotification } from "../src/lib/push/onesignal";
import {
  ONESIGNAL_APP_ID,
  ONESIGNAL_WORKER_SOURCE,
  PROMPT_TEXT,
  buildOneSignalInitScript,
} from "../src/lib/push/webSdk";

const ROOT = process.cwd();
const PROD_ORIGIN = "https://www.mfmsport.ma";
const UA = "mfm-verify-push/1.0 (+https://www.mfmsport.ma)";

// ---------------------------------------------------------------------------
// assertion helpers
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`  FAIL ${message}`);
    process.exit(1);
  }
  console.log(`  ok   ${message}`);
}

function assertEq(actual: unknown, expected: unknown, message: string): void {
  assert(actual === expected, `${message} (expected ${String(expected)}, got ${String(actual)})`);
}

function readDotEnv(file = join(ROOT, ".env.local")): Record<string, string> {
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*?)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function appApiKey(): string {
  const key = process.env.ONESIGNAL_APP_API_KEY || readDotEnv().ONESIGNAL_APP_API_KEY;
  assert(key && key.startsWith("os_v2_app_"), "an App API key (os_v2_app_…) is available — value not printed");
  return key;
}

// ---------------------------------------------------------------------------
// vitest-backed gates: the tests are the assertions; the gate proves they RAN
// ---------------------------------------------------------------------------

type AssertionResult = { ancestorTitles: string[]; title: string; status: string };

function runTestFile(file: string): AssertionResult[] {
  const dir = mkdtempSync(join(tmpdir(), "verify-push-"));
  const out = join(dir, "vitest.json");
  try {
    const res = spawnSync(
      "pnpm",
      ["exec", "vitest", "run", "--config", "vitest.config.ts", file, "--reporter=json", `--outputFile=${out}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5 * 60_000 },
    );
    let report: { testResults?: Array<{ assertionResults?: AssertionResult[] }> };
    try {
      report = JSON.parse(readFileSync(out, "utf8"));
    } catch {
      console.error((res.stderr || res.stdout || "").slice(-3000));
      assert(false, `vitest produced a JSON report for ${file}`);
    }
    const results = (report.testResults ?? []).flatMap((r) => r.assertionResults ?? []);
    const failed = results.filter((r) => r.status !== "passed");
    for (const f of failed) console.error(`  FAIL ${[...f.ancestorTitles, f.title].join(" > ")} [${f.status}]`);
    assertEq(failed.length, 0, `no test in ${file} failed or was skipped`);
    assertEq(res.status, 0, "vitest exited 0");
    return results;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function requireTests(results: AssertionResult[], suite: string, titles: string[]): void {
  for (const title of titles) {
    const hit = results.find((r) => r.ancestorTitles.includes(suite) && r.title === title);
    assert(hit?.status === "passed", `ran and passed: ${suite} > ${title}`);
  }
}

const TEST_DIR = "src/lib/push/__tests__";

function checkDecide(): void {
  const results = runTestFile(`${TEST_DIR}/articleNotification.test.ts`);
  requireTests(results, "decideArticlePush", [
    "sends on the first publish of a draft (draft → published)",
    "sends when an article is created already published",
    "skips a re-save of an already-published article",
    "skips a draft save",
    "skips both archive tiers and fails closed on a missing tier",
    "skips bulk-script saves (disableRevalidate, disablePush)",
    "skips preview and local environments, which share the production database",
    "skips when the app key or the app id is missing",
    "sends inside the freshness window and skips just outside it",
    "skips when publishedAt is missing or unparseable",
  ]);
  // Independent of the test file: the single most expensive mistake — an
  // archive-import row, on production, with a key — must not send.
  const now = new Date();
  const env = { VERCEL_ENV: "production", ONESIGNAL_APP_API_KEY: "os_v2_app_x", NEXT_PUBLIC_ONESIGNAL_APP_ID: ONESIGNAL_APP_ID };
  const importRow = { id: 1, status: "published", seoTier: "archive-full", publishedAt: now.toISOString() };
  const d1 = decideArticlePush({ doc: importRow, operation: "create", context: { disableRevalidate: true }, env, now });
  assertEq(d1.send, false, "an archive import row on production does not send");
  const d2 = decideArticlePush({ doc: { ...importRow, seoTier: "editorial" }, operation: "create", context: {}, env, now });
  assertEq(d2.send, true, "positive control: the same row as an editorial publish does send");
  console.log("DECIDE GATE OK");
}

function checkPayload(): void {
  const results = runTestFile(`${TEST_DIR}/articleNotification.test.ts`);
  requireTests(results, "buildArticleNotification", [
    "puts the Arabic title in both the en and ar headings",
    "uses the body's opening as the lede when there is no excerpt, cut at a word boundary within budget",
    "links to the absolute www article URL whose path decodes back to the slug",
    "uses the 1200×630 hero image, resolves a relative URL, and drops a non-https one",
    "targets every subscriber over push, expires in 24 h, and groups by article",
  ]);
  requireTests(results, "articlePushIdempotencyKey", [
    "is an RFC 9562 version-5 UUID, stable per article and distinct across articles",
    "does not change across releases (changing it would re-send the last 30 days)",
  ]);
  requireTests(results, "truncateAtWord", [
    "cuts long text at a space, inside the budget, without trailing punctuation",
  ]);
  console.log("PAYLOAD GATE OK");
}

function checkHook(): void {
  const results = runTestFile(`${TEST_DIR}/notifyArticlePublished.test.ts`);
  requireTests(results, "notifyArticlePublished hook", [
    "defers the send until after the response, then sends the Arabic notification once",
    "reads the article in Arabic, depth 1, inside the save's transaction",
    "schedules nothing and logs nothing on a routine save",
    "never fails the save when the read throws",
    "sends nothing and does not throw without a request scope (a CLI script)",
    "is wired into Articles.afterChange after revalidation",
  ]);
  console.log("HOOK GATE OK");
}

function checkSender(): void {
  const results = runTestFile(`${TEST_DIR}/onesignal.test.ts`);
  requireTests(results, "sendOneSignalNotification", [
    "POSTs the body with the App key and returns the notification id",
    "settles within its bound against a server that never answers, and never throws",
    "retries once on a 5xx and on a 429, then succeeds",
    "does not retry a client error (bad key, bad body)",
    "turns a network failure and a non-JSON error page into results, not exceptions",
  ]);
  console.log("SENDER GATE OK");
}

function checkLoader(): void {
  const worker = readFileSync(join(ROOT, "public", "OneSignalSDKWorker.js"), "utf8").trim();
  assertEq(worker, ONESIGNAL_WORKER_SOURCE, "public/OneSignalSDKWorker.js is exactly the v16 import line");
  const script = buildOneSignalInitScript(ONESIGNAL_APP_ID);
  assert(script.includes('"scope":"/"'), "the init registers the worker at scope '/' (the WordPress plugin's scope)");
  assert(script.includes(`location.origin!==${JSON.stringify(PROD_ORIGIN)}`), "the init is guarded to the production origin");
  const results = runTestFile(`${TEST_DIR}/webSdk.test.ts`);
  requireTests(results, "OneSignal web SDK bootstrap", [
    "keeps the Arabic prompt within OneSignal's limits (90 / 15 / 15)",
    "does nothing at all on any origin but production (previews, localhost)",
    "on production queues one init with scope '/', the root worker and the Arabic prompt",
    "fetches the SDK only after load, exactly once, even if the bootstrap runs twice",
    "cannot break out of its <script> tag whatever the configured values contain",
  ]);
  requireTests(results, "<OneSignalLoader>", [
    "renders nothing without an app id and one inline script with it",
    "is mounted in the (site) layout and nowhere above it (no 404s, no admin)",
  ]);
  console.log("LOADER GATE OK");
}

// ---------------------------------------------------------------------------
// no-secret
// ---------------------------------------------------------------------------

const KEY_PATTERN = /os_v2_(?:org|app)_[a-z0-9]{40,}/i;

function findKeys(text: string): number {
  return (text.match(new RegExp(KEY_PATTERN.source, "gi")) ?? []).length;
}

function checkNoSecret(): void {
  // Positive control first: the scanner must flag a planted key, or "zero
  // found" below means nothing.
  const planted = `ONESIGNAL_APP_API_KEY=os_v2_app_${"a1b2c3d4e5".repeat(10)}`;
  assertEq(findKeys(planted), 1, "positive control: the scanner flags a planted app key");
  assertEq(findKeys(planted.replace("_app_", "_org_")), 1, "positive control: the scanner flags a planted org key");

  const list = (args: string[]) =>
    spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout.split("\0").filter(Boolean);
  // Tracked files plus untracked-but-not-ignored ones (what the next commit could add).
  const files = [...new Set([...list(["ls-files", "-z"]), ...list(["ls-files", "-z", "--others", "--exclude-standard"])])];
  assert(files.length > 500, `scanned the repository (${files.length} files)`);
  const hits: string[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(join(ROOT, f), "utf8");
    } catch {
      continue; // deleted in the working tree
    }
    if (findKeys(text) > 0) hits.push(f);
  }
  for (const h of hits) console.error(`  key literal in: ${h}`);
  assertEq(hits.length, 0, "no OneSignal key literal in any tracked or committable file");
  console.log("NO SECRET GATE OK");
}

// ---------------------------------------------------------------------------
// static + suite
// ---------------------------------------------------------------------------

function checkStatic(): void {
  const pnpm = spawnSync("pnpm", ["--version"], { encoding: "utf8" }).stdout.trim();
  assertEq(pnpm, "8.15.9", "pnpm matches packageManager (a newer pnpm exits 0 without running scripts)");

  const tsc = spawnSync("pnpm", ["exec", "tsc", "--noEmit", "--extendedDiagnostics"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60_000,
  });
  const tscOut = `${tsc.stdout}${tsc.stderr}`;
  const errors = tscOut.match(/error TS\d+/g) ?? [];
  for (const line of tscOut.split("\n").filter((l) => l.includes("error TS")).slice(0, 20)) console.error(`  ${line}`);
  assertEq(errors.length, 0, "tsc reports zero errors");
  assertEq(tsc.status, 0, "tsc exited 0");
  const files = Number(tscOut.match(/^Files:\s+(\d+)/m)?.[1] ?? 0);
  assert(files >= 4000, `tsc actually checked the program (${files} files >= 4000 floor)`);

  const dir = mkdtempSync(join(tmpdir(), "verify-push-eslint-"));
  const out = join(dir, "eslint.json");
  try {
    const eslint = spawnSync("pnpm", ["exec", "eslint", ".", "-f", "json", "-o", out], {
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "--no-deprecation" },
      timeout: 10 * 60_000,
    });
    const report = JSON.parse(readFileSync(out, "utf8")) as Array<{
      filePath: string;
      errorCount: number;
      messages: Array<{ severity: number; line: number; ruleId: string | null; message: string }>;
    }>;
    const errorCount = report.reduce((n, f) => n + f.errorCount, 0);
    for (const f of report)
      for (const m of f.messages)
        if (m.severity === 2) console.error(`  ${f.filePath.replace(`${ROOT}/`, "")}:${m.line} ${m.ruleId} ${m.message}`);
    assertEq(errorCount, 0, "eslint reports zero errors");
    assertEq(eslint.status, 0, "eslint exited 0");
    assert(report.length >= 350, `eslint actually linted the repository (${report.length} files >= 350 floor)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log("STATIC GATE OK");
}

/** A floor, not the expected count: it catches a runner that exits 0 without
 *  executing anything. 899 tests existed when this gate was written. */
const MIN_EXPECTED_TESTS = 890;

function checkSuite(): void {
  const dir = mkdtempSync(join(tmpdir(), "verify-push-suite-"));
  const out = join(dir, "vitest.json");
  try {
    const res = spawnSync(
      "pnpm",
      ["exec", "vitest", "run", "--config", "vitest.config.ts", "--reporter=json", `--outputFile=${out}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15 * 60_000 },
    );
    let report: { numTotalTests?: number; numPassedTests?: number; numFailedTests?: number };
    try {
      report = JSON.parse(readFileSync(out, "utf8"));
    } catch {
      console.error((res.stderr || res.stdout || "").slice(-3000));
      assert(false, "vitest produced a JSON report");
    }
    const total = report.numTotalTests ?? 0;
    assertEq(report.numFailedTests ?? -1, 0, "no test failed");
    assertEq(report.numPassedTests, total, "every test that ran passed");
    assert(total >= MIN_EXPECTED_TESTS, `the runner executed the suite (${total} >= ${MIN_EXPECTED_TESTS} floor)`);
    assertEq(res.status, 0, "vitest exited 0");
    console.log(`SUITE GATE OK (${total} tests)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// live — OneSignal accepts the key, the segment and the payload; nobody receives anything
// ---------------------------------------------------------------------------

const FIXTURE_ARTICLE = {
  id: "verify-push",
  title: "تجربة تقنية — لا تُرسل",
  slug: "تجربة-تقنية",
  body: { root: { type: "root", children: [{ type: "paragraph", children: [{ type: "text", text: "نص تجريبي للتحقق من قبول الحمولة دون إرسال." }] }] } },
  featuredImage: { url: `${PROD_ORIGIN}/images/mfm-sport-logo.png` },
};

async function checkLive(): Promise<void> {
  const key = appApiKey();
  const auth = { Authorization: `Key ${key}`, Accept: "application/json" };

  const segRes = await fetch(`https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/segments?offset=0&limit=300`, {
    headers: auth,
    signal: AbortSignal.timeout(15_000),
  });
  assertEq(segRes.status, 200, "the App key can read app mfmsport.ma's segments");
  const segJson = (await segRes.json()) as { segments?: Array<{ name?: string; is_active?: boolean }> };
  const names = (segJson.segments ?? []).map((s) => s.name);
  assert(names.includes(PUSH_SEGMENT), `the targeted segment "${PUSH_SEGMENT}" exists (found: ${names.join(", ")})`);

  // The production payload, re-addressed so it CANNOT reach anyone.
  const real = buildArticleNotification(FIXTURE_ARTICLE, { appId: ONESIGNAL_APP_ID, siteUrl: PROD_ORIGIN });
  const { included_segments: _dropped, ...rest } = real;
  const nobody = randomUUID();
  const probe = { ...rest, name: "verify-push:no-op", idempotency_key: randomUUID(), include_subscription_ids: [nobody] };
  assert(!("included_segments" in probe) && !("filters" in probe), "guard: the probe carries no segment and no filter");
  assert(probe.include_subscription_ids.length === 1 && probe.include_subscription_ids[0] === nobody, "guard: the probe targets one freshly generated id");

  // Through the real sender, so its handling of the response is exercised too.
  const result = await sendOneSignalNotification(probe as unknown as typeof real, { apiKey: key, retryDelayMs: 500 });
  console.log(`  …    OneSignal answered: ${JSON.stringify(result)}`);
  if (result.ok) {
    // Some API versions create a 0-recipient message; prove it reached nobody.
    const detail = await fetch(`https://api.onesignal.com/notifications/${result.id}?app_id=${ONESIGNAL_APP_ID}`, {
      headers: auth,
      signal: AbortSignal.timeout(15_000),
    });
    const d = (await detail.json()) as { successful?: number; remaining?: number };
    assertEq(d.successful ?? 0, 0, "the accepted probe was delivered to nobody");
  } else {
    assertEq(result.status, 200, "the payload was accepted (HTTP 200) — key, app and fields are valid");
    assert(/not subscribed|no.*(recipients|subscriptions)|invalid.*(player|subscription)/i.test(result.error), `…and had nobody to deliver to ("${result.error}")`);
  }

  // Control: the same request with a corrupted key must be refused, or the
  // check above proves nothing about authentication.
  const broken = `${key.slice(0, -4)}${key.slice(-4) === "aaaa" ? "bbbb" : "aaaa"}`;
  const refused = await sendOneSignalNotification(probe as unknown as typeof real, { apiKey: broken, retryDelayMs: 500 });
  assert(!refused.ok && (refused.status === 401 || refused.status === 403), `control: a corrupted key is refused (status ${String(!refused.ok && refused.status)})`);
  console.log("LIVE GATE OK");
}

// ---------------------------------------------------------------------------
// vercel-env — names and targets only; values are never requested
// ---------------------------------------------------------------------------

// The project moved from team `mfm-sport-s-projects` to `newpublicitys-projects`
// (same project id) — read 24 November 2026 from `vercel project inspect`.
const VERCEL_SCOPE = "newpublicitys-projects";
const VERCEL_PROJECT = "prj_yLFKRNjsrMdH31Kc2or1W5VVAcKL";

/** Name → type for one target, from the CLI's table ("Hidden" in the value
 *  column — `--json` is never used, it decrypts). */
function vercelEnv(target: string): Map<string, string> {
  const res = spawnSync("vercel", ["env", "ls", target, "--scope", VERCEL_SCOPE, "--project", VERCEL_PROJECT], {
    encoding: "utf8",
    timeout: 120_000,
  });
  const text = `${res.stdout}${res.stderr}`;
  assertEq(res.status, 0, `vercel env ls ${target} succeeded${res.status === 0 ? "" : `: ${text.trim().split("\n").slice(-2).join(" ")}`}`);
  const rows = [...text.matchAll(/^\s*([A-Z][A-Z0-9_]+)\s+\S+\s+(Secret|Sensitive|Encrypted|Config|Plain)\b/gm)];
  return new Map(rows.map((m) => [m[1], m[2]]));
}

function checkVercelEnv(): void {
  const productionTypes = vercelEnv("production");
  const production = [...productionTypes.keys()];
  assert(production.length >= 5, `read the production variable list (${production.length} names)`);
  assert(production.includes("DATABASE_URL"), "positive control: the parser sees DATABASE_URL in production");
  assert(production.includes("ONESIGNAL_APP_API_KEY"), "ONESIGNAL_APP_API_KEY is set for production");
  const keyType = productionTypes.get("ONESIGNAL_APP_API_KEY") ?? "";
  assert(["Secret", "Sensitive"].includes(keyType), `…stored as a secret, not readable config (${keyType})`);
  for (const target of ["preview", "development"]) {
    assert(!vercelEnv(target).has("ONESIGNAL_APP_API_KEY"), `ONESIGNAL_APP_API_KEY is NOT set for ${target}`);
  }
  const orgLike = production.filter((n) => /ONESIGNAL/.test(n) && n !== "ONESIGNAL_APP_API_KEY" && n !== "NEXT_PUBLIC_ONESIGNAL_APP_ID");
  assertEq(orgLike.length, 0, `no other OneSignal credential (e.g. an org key) in production (${orgLike.join(", ")})`);
  console.log("VERCEL ENV GATE OK");
}

// ---------------------------------------------------------------------------
// served — the bytes a browser receives
// ---------------------------------------------------------------------------

/** Counts REAL loader tags. The RSC payload carries the same element as JSON
 *  (`["$","script",null,{"id":"onesignal-init",…`), which this deliberately
 *  does not match — see docs/verification-principles.md. */
function countLoaderTags(html: string): number {
  return (html.match(/<script id="onesignal-init">/g) ?? []).length;
}

/** Vercel's Trusted Sources header for a protected deployment — only ever sent
 *  to a *.vercel.app host, and only when `vercel env run` provided a token. */
function protectionHeaders(url: string): Record<string, string> {
  const token = process.env.VERCEL_OIDC_TOKEN;
  return token && new URL(url).hostname.endsWith(".vercel.app") ? { "x-vercel-trusted-oidc-idp-token": token } : {};
}

async function get(url: string): Promise<{ status: number; type: string; body: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...protectionHeaders(url) },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
}

async function checkServed(baseArg: string | undefined): Promise<void> {
  assert(baseArg && /^https:\/\//.test(baseArg), "a base URL was given");
  const base = baseArg.replace(/\/+$/, "");

  // Positive/negative control for the counter itself.
  assertEq(countLoaderTags('<script id="onesignal-init">x</script>'), 1, "control: the counter sees a real tag");
  assertEq(countLoaderTags('["$","script",null,{"id":"onesignal-init"}]'), 0, "control: the counter ignores the RSC copy");

  const worker = await get(`${base}/OneSignalSDKWorker.js`);
  if (worker.type.startsWith("text/html") && /vercel\.com\/(login|sso)|Vercel Authentication/i.test(worker.body)) {
    console.error("  (Vercel Authentication page: run under `vercel env run --scope … --project …` — see the header comment)");
  }
  assertEq(worker.status, 200, "/OneSignalSDKWorker.js answers 200");
  assert(/javascript/.test(worker.type), `…as JavaScript (${worker.type})`);
  assertEq(worker.body.trim(), ONESIGNAL_WORKER_SOURCE, "…with exactly the v16 import line");

  const home = await get(`${base}/ar`);
  assertEq(home.status, 200, "/ar answers 200");
  assertEq(countLoaderTags(home.body), 1, "/ar carries exactly one loader tag");
  const tag = home.body.match(/<script id="onesignal-init">([\s\S]*?)<\/script>/)?.[1] ?? "";
  assert(tag.includes(ONESIGNAL_APP_ID), "the loader carries the app id");
  assert(tag.includes('"scope":"/"') && tag.includes("OneSignalSDKWorker.js"), "the loader registers the root worker at scope '/'");

  const articleHref = home.body.match(/href="(\/ar\/articles\/(?!page\/)[^"?#]+)"/)?.[1];
  assert(articleHref, "found an article link on /ar");
  const article = await get(`${base}${articleHref}`);
  assertEq(article.status, 200, `an article page answers 200 (${decodeURIComponent(articleHref)})`);
  assertEq(countLoaderTags(article.body), 1, "the article page carries exactly one loader tag");

  const missing = await get(`${base}/ar/articles/verify-push-no-such-article-${Date.now()}`);
  assertEq(missing.status, 404, "a missing article answers 404");
  assertEq(countLoaderTags(missing.body), 0, "the 404 page carries no loader");

  const admin = await get(`${base}/admin`);
  assert(admin.status < 500, `/admin answers (${admin.status})`);
  assertEq(countLoaderTags(admin.body) + (admin.body.includes("OneSignalSDK") ? 1 : 0), 0, "the admin carries no OneSignal code");
  console.log("SERVED GATE OK");
}

// ---------------------------------------------------------------------------
// prompt — the slidedown as a reader sees it (Playwright)
// ---------------------------------------------------------------------------

/** Never let a headless browser fetch ads or count as a visit. */
const BLOCKED_THIRD_PARTIES =
  /googlesyndication|doubleclick|googletagmanager|google-analytics|adservice|\/_vercel\/(insights|speed-insights)\//;

async function checkPrompt(baseArg: string | undefined, noRoute: boolean): Promise<void> {
  assert(baseArg && /^https:\/\//.test(baseArg), "a base URL was given");
  const base = baseArg.replace(/\/+$/, "");
  if (noRoute) assertEq(base, PROD_ORIGIN, "--no-route runs against the production origin itself");
  const { chromium } = await import("playwright");
  const shots = process.env.VERIFY_PUSH_SHOTS || tmpdir();
  // Full Chromium in new-headless mode, NOT the default headless shell: the
  // shell reports Notification.permission === "denied", and OneSignal (rightly)
  // never prompts a browser that has refused — the check would fail for a
  // reason no reader ever has. Needs `pnpm exec playwright install chromium`.
  const browser = await chromium.launch({ channel: "chromium" });
  try {
    for (const vp of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "ar-MA", userAgent: undefined });
      await context.route(BLOCKED_THIRD_PARTIES, (route) => route.abort());
      if (!noRoute) {
        // Serve the candidate build under the production origin: the only
        // origin the OneSignal app accepts.
        await context.route(`${PROD_ORIGIN}/**`, async (route) => {
          const u = new URL(route.request().url());
          const target = `${base}${u.pathname}${u.search}`;
          const response = await route.fetch({
            url: target,
            headers: { ...route.request().headers(), ...protectionHeaders(target) },
          });
          await route.fulfill({ response });
        });
      }
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.goto(`${PROD_ORIGIN}/ar`, { waitUntil: "load", timeout: 60_000 });

      const dialog = page.locator("#onesignal-slidedown-dialog");
      await dialog.waitFor({ state: "visible", timeout: 60_000 });
      // "Visible" fires while the dialog is still sliding in from above the
      // viewport (measured: y = -231 px on mobile). Let it settle, then require
      // it to be on screen — present-but-off-screen is a failure for a reader.
      await page.waitForTimeout(2_500);
      const box = await dialog.boundingBox();
      assert(
        box && box.y >= -1 && box.x >= -1 && box.y + box.height <= vp.height + 1 && box.x + box.width <= vp.width + 1,
        `${vp.name}: the slidedown sits inside the viewport (${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}` : "no box"})`,
      );
      const message = (await page.locator(".slidedown-body-message").innerText()).trim();
      const allow = (await page.locator("#onesignal-slidedown-allow-button").innerText()).trim();
      const cancel = (await page.locator("#onesignal-slidedown-cancel-button").innerText()).trim();
      const direction = await dialog.evaluate((el) => getComputedStyle(el).direction);
      const shot = join(shots, `onesignal-slidedown-${vp.name}${noRoute ? "-prod" : ""}.png`);
      await page.screenshot({ path: shot });
      console.log(`  …    screenshot: ${shot}`);

      assertEq(message, PROMPT_TEXT.actionMessage, `${vp.name}: the slidedown shows the Arabic message`);
      assertEq(allow, PROMPT_TEXT.acceptButton, `${vp.name}: the accept button reads "${PROMPT_TEXT.acceptButton}"`);
      assertEq(cancel, PROMPT_TEXT.cancelButton, `${vp.name}: the cancel button reads "${PROMPT_TEXT.cancelButton}"`);
      assertEq(direction, "rtl", `${vp.name}: the slidedown lays out right-to-left`);

      const state = await page.evaluate(async () => {
        const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
        let subscribed = false;
        for (const r of regs) if (await r.pushManager?.getSubscription()) subscribed = true;
        return { permission: Notification.permission, subscribed };
      });
      assertEq(state.permission, "default", `${vp.name}: no permission was granted by the check`);
      assertEq(state.subscribed, false, `${vp.name}: no push subscription was created`);
      const oneSignalErrors = errors.filter((e) => /onesignal/i.test(e));
      for (const e of oneSignalErrors) console.error(`  page error: ${e}`);
      assertEq(oneSignalErrors.length, 0, `${vp.name}: OneSignal raised no page error`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log("PROMPT GATE OK");
}

// ---------------------------------------------------------------------------
// prod-sent — real publishes after the deploy each produced exactly one push
// ---------------------------------------------------------------------------

type OsNotification = {
  id: string;
  name?: string;
  url?: string;
  queued_at?: number;
  successful?: number;
  failed?: number;
  errored?: number;
  remaining?: number;
};

const decodePath = (u: string) => decodeURIComponent(new URL(u).pathname);

async function checkProdSent(args: string[]): Promise<void> {
  const sinceArg = args[args.indexOf("--since") + 1];
  const since = Date.parse(sinceArg ?? "");
  assert(args.includes("--since") && !Number.isNaN(since), `--since is an instant (${sinceArg})`);
  const key = appApiKey();

  const sitemap = await get(`${PROD_ORIGIN}/news-sitemap.xml`);
  assertEq(sitemap.status, 200, "the news sitemap answers 200");
  const published = [...sitemap.body.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((m) => ({
      loc: m[1].match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "",
      date: Date.parse(m[1].match(/<news:publication_date>([^<]+)<\/news:publication_date>/)?.[1] ?? ""),
    }))
    .filter((a) => a.loc && a.date >= since);
  assert(published.length >= 1, `at least one article was published since the deploy (${published.length}) — otherwise there is nothing to verify yet`);

  const res = await fetch(`https://api.onesignal.com/notifications?app_id=${ONESIGNAL_APP_ID}&limit=50&offset=0`, {
    headers: { Authorization: `Key ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  assertEq(res.status, 200, "OneSignal's message list is readable with the App key");
  const list = ((await res.json()) as { notifications?: OsNotification[] }).notifications ?? [];
  const ours = list.filter((n) => n.name?.startsWith("article:") && (n.queued_at ?? 0) * 1000 >= since);

  const locs = new Set(published.map((a) => decodePath(a.loc)));
  for (const n of ours) {
    assert(n.url && locs.has(decodePath(n.url)), `notification ${n.id} points at an article published since the deploy (${n.url ? decodePath(n.url) : "no url"})`);
  }
  for (const a of published) {
    const hits = ours.filter((n) => n.url && decodePath(n.url) === decodePath(a.loc));
    assertEq(hits.length, 1, `exactly one notification for ${decodePath(a.loc)}`);
    const n = hits[0];
    console.log(`  …    ${n.id}: successful=${n.successful} failed=${n.failed} errored=${n.errored} remaining=${n.remaining}`);
    assert((n.successful ?? 0) >= 1, "…and it reached at least one subscriber");
    const page = await get(a.loc);
    assertEq(page.status, 200, "…and the article it links to answers 200");
  }
  console.log(`PROD SENT GATE OK (${published.length} article(s), ${ours.length} notification(s))`);
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  const commands: Record<string, () => void | Promise<void>> = {
    decide: checkDecide,
    payload: checkPayload,
    hook: checkHook,
    sender: checkSender,
    loader: checkLoader,
    "no-secret": checkNoSecret,
    static: checkStatic,
    suite: checkSuite,
    live: checkLive,
    "vercel-env": checkVercelEnv,
    served: () => checkServed(args[0]),
    prompt: () => checkPrompt(args[0], args.includes("--no-route")),
    "prod-sent": () => checkProdSent(args),
  };
  const run = cmd ? commands[cmd] : undefined;
  if (!run) {
    console.error(`usage: verify-push.ts <${Object.keys(commands).join("|")}>`);
    process.exit(2);
  }
  await run();
}

main().catch((err) => {
  console.error(`  FAIL unexpected: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
