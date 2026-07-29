/**
 * Task 8 §A2 — the actual deliverable. Drives a REAL browser against the REAL admin UI
 * (a running `pnpm dev`, never production) to prove, by observation and not by reading
 * config, that:
 *
 *   1. All four blocks (socialEmbed, gallery, audio, embedFrame) appear in the fixed
 *      toolbar's "+" blocks dropdown with their ARABIC labels.
 *   2. Inserting a block while the caret sits mid-way through the first of two typed
 *      paragraphs lands the block BETWEEN them — not appended at the end of the document.
 *   3. Both of the above hold at a 390px-wide (phone) viewport AND a desktop viewport.
 *   4. Uploading a media item with no alt text is rejected with a real, visible
 *      validation error — not saved silently.
 *
 * This is a re-runnable regression tool, not a one-shot probe — kept committed for the
 * same reason scripts/probe-block-hook.ts was: it is the artefact that generated this
 * task's central evidence, and it is safe to run again after any future change to the
 * fixed toolbar, the block definitions, or Media's alt-text requirement.
 *
 * SAFETY: this script never touches Postgres directly — it only drives a browser against
 * an HTTP origin you provide (ADMIN_BASE_URL, default a localhost port). There is no
 * production connection string anywhere in this file, so there is nothing here that can
 * reach production regardless of environment. The dev server it targets must itself be
 * started against a throwaway DATABASE_URL — see the Task 8 report for the exact command.
 * It logs in with scripts/seed-admin-toolbar-probe.ts's throwaway credentials; run that
 * script first (against the same throwaway branch) so the login exists.
 *
 * Usage:
 *   pnpm tsx scripts/verify-toolbar-admin-ux.ts
 *   ADMIN_BASE_URL=http://localhost:3100 pnpm tsx scripts/verify-toolbar-admin-ux.ts
 *
 * Requires the `playwright` devDependency (added for this task — see the report) and the
 * Chromium build already cached at ~/AppData/Local/ms-playwright by a prior Claude Code
 * session. No browser download is triggered by this script.
 */

import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.ADMIN_BASE_URL || "http://localhost:3100";

// Deliberately NOT imported from scripts/seed-admin-toolbar-probe.ts: that module runs
// its production guard (assertNotProduction) at module top-level, on purpose, so it
// fails before Payload ever loads — importing it here just for these two constants would
// run that guard (which checks DATABASE_URL) even though this script never touches
// Postgres at all. Duplicated instead; keep in sync with that file if either changes.
export const TOOLBAR_PROBE_EMAIL = "task8-toolbar-probe@example.invalid";
export const TOOLBAR_PROBE_PASSWORD = "Task8-Toolbar-Probe-2026!";

// Cached by a prior session at ~/AppData/Local/ms-playwright — never downloaded by this
// script. See the Task 8 report for why chrome-win64 (not chrome-headless-shell) is used:
// both were tested; behaviour was identical for every check in this file.
const CHROME_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  "AppData",
  "Local",
  "ms-playwright",
  "chromium-1208",
  "chrome-win64",
  "chrome.exe",
);

const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  ".superpowers",
  "sdd",
  "2026-07-29-journalist-authoring-blocks",
  "task-8-evidence",
);
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// A tiny (68-byte), valid, transparent 1x1 PNG — content is irrelevant to this test; only
// "a real file was attached" matters. Generated inline so this script has no fixture
// dependency.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const TINY_PNG_PATH = path.join(EVIDENCE_DIR, "tiny-fixture.png");
fs.writeFileSync(TINY_PNG_PATH, TINY_PNG);

// The Arabic label declared on each block's `labels.singular` in src/blocks/*.ts — the
// thing a journalist actually reads in the rendered dropdown, copied here so the
// assertion is against a literal expectation, not a re-derivation of the source.
const EXPECTED_BLOCK_LABELS: Record<string, string> = {
  "block-socialEmbed": "تضمين منشور",
  "block-gallery": "معرض صور",
  "block-audio": "ملف صوتي",
  "block-embedFrame": "إطار مضمّن",
};

type CheckResult = { pass: boolean; detail: unknown };
const results: Record<string, CheckResult> = {};
let anyFailure = false;

function record(name: string, pass: boolean, detail: unknown) {
  results[name] = { pass, detail };
  console.log(`\n[${pass ? "PASS" : "FAIL"}] ${name}`);
  console.log(JSON.stringify(detail, null, 2));
  if (!pass) anyFailure = true;
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "networkidle" });
  await page.fill("#field-email", TOOLBAR_PROBE_EMAIL);
  await page.fill("#field-password", TOOLBAR_PROBE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/admin`, { timeout: 15000 });
}

/** Switches the ADMIN UI chrome language (distinct from content locale) to Arabic via
 *  the real account-settings language selector — the same control a journalist would
 *  use, not a cookie injected behind the scenes. This is what makes block labels render
 *  in Arabic: BlocksFeatureClient resolves each label via getTranslation(label, i18n),
 *  where i18n.language is this admin-UI language, not the content locale. */
async function switchAdminLanguageToArabic(page: Page) {
  await page.goto(`${BASE_URL}/admin/account`, { waitUntil: "networkidle" });
  await page.locator("#language-select").click();
  await page.getByRole("option", { name: "العربية", exact: true }).click();
  await page.waitForURL(`${BASE_URL}/admin/account`, { timeout: 15000 });
  await page.waitForTimeout(500);
}

/** Opens the fixed toolbar's "blocks" dropdown and reads back every item's key + the
 *  exact text a journalist would read — via Playwright's layout-aware innerText(), not
 *  textContent, so a hidden/uninserted node could not produce a false pass. */
async function readBlockDropdownLabels(page: Page): Promise<Record<string, string>> {
  const dropdownBtn = page.locator('button[data-dropdown-key="blocks"]');
  await dropdownBtn.waitFor({ state: "visible", timeout: 10000 });
  await dropdownBtn.click();
  const items = page.locator("button.toolbar-popup__dropdown-item");
  await items.first().waitFor({ state: "visible", timeout: 5000 });
  const count = await items.count();
  const labels: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const key = await item.getAttribute("data-item-key");
    const text = (await item.innerText()).trim();
    if (key) labels[key] = text;
  }
  await page.keyboard.press("Escape");
  return labels;
}

async function verifyBlockLabels(page: Page, viewportName: string) {
  await page.goto(`${BASE_URL}/admin/collections/articles/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const labels = await readBlockDropdownLabels(page);

  const expectedKeys = Object.keys(EXPECTED_BLOCK_LABELS).sort();
  const actualKeys = Object.keys(labels).sort();
  const keysMatch = JSON.stringify(expectedKeys) === JSON.stringify(actualKeys);
  const allLabelsMatch = expectedKeys.every((k) => labels[k] === EXPECTED_BLOCK_LABELS[k]);

  record(`A2.1 [${viewportName}] four blocks appear with Arabic labels`, keysMatch && allLabelsMatch, {
    expected: EXPECTED_BLOCK_LABELS,
    actual: labels,
  });
}

type EditorChild = { tag: string; cls: string; text: string };

async function readEditorChildren(page: Page): Promise<EditorChild[]> {
  const editor = page.locator('[contenteditable="true"]');
  // Deliberately NOT trimmed per-fragment: when a paragraph is split at the cursor, the
  // boundary can fall exactly on a space, and trimming each fragment independently before
  // reassembling them would silently eat that space — a test-script bug, not a product
  // one, caught by the very reconstruction check below failing on a case where the split
  // landed on whitespace. Trim only the whole reconstructed string where it matters.
  return editor.evaluate((el) =>
    Array.from(el.children).map((c) => ({
      tag: c.tagName,
      cls: (c as HTMLElement).className,
      text: c.textContent || "",
    })),
  );
}

async function verifyCursorInsertion(page: Page, viewportName: string) {
  await page.goto(`${BASE_URL}/admin/collections/articles/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const PARA1 = `فقرة أولى ${viewportName} قبل نقطة الإدراج مباشرة`;
  const PARA2 = `فقرة ثانية ${viewportName} بعد نقطة الإدراج مباشرة`;

  const editor = page.locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.type(PARA1, { delay: 15 });
  await page.keyboard.press("Enter");
  await page.keyboard.type(PARA2, { delay: 15 });
  await page.waitForTimeout(300);

  const before = await readEditorChildren(page);

  // Place the caret at the midpoint of paragraph 1's TEXT via the native Selection API,
  // rather than a pixel-position mouse click. Disclosed deviation: an RTL paragraph's
  // bounding box spans the full editor column width (it is a block element), not the
  // width of its own glyphs, which are right-aligned within it — clicking at the box's
  // horizontal midpoint therefore lands in the empty space past the visual end of a short
  // line, not mid-text (confirmed empirically: it collapsed the caret to the END of the
  // paragraph). Setting a native Range/Selection on the actual Text node and firing
  // `selectionchange` is the standard, deterministic way to place a caret inside
  // real, rendered text in a real browser — Lexical reconciles its own selection model
  // from exactly this native browser event, so this does not bypass Lexical in any way.
  const midOffset = Math.floor(PARA1.length / 2);
  await editor.evaluate((el, offset) => {
    el.focus();
    const firstParagraph = el.children[0];
    // Plain TreeWalker rather than a named recursive helper: a named function declared
    // inside a page.evaluate() callback gets compiled (by tsx/esbuild) with a `__name(...)`
    // wrapper for Function.prototype.name preservation, defined at the MODULE's top level —
    // but Playwright serialises only the callback's own source text to send to the browser,
    // so that wrapper reference doesn't exist there and the callback throws
    // "ReferenceError: __name is not defined". Observed directly (see the Task 8 report).
    const walker = document.createTreeWalker(firstParagraph, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode() as Text | null;
    if (!textNode) throw new Error("No text node found in first paragraph");
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }, midOffset);
  await page.waitForTimeout(200);

  await page.locator('button[data-dropdown-key="blocks"]').click();
  await page.waitForTimeout(300);
  await page.locator('button[data-item-key="block-socialEmbed"]').click();
  await page.waitForTimeout(1200);

  const after = await readEditorChildren(page);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, `insertion-${viewportName}.png`) }).catch(() => {});

  // Structural assertions, tolerant of exactly where in paragraph 1 the split fell (Task
  // 8 report explains the two shapes actually observed), but strict about the property
  // that matters: the block is neither first nor last, and paragraph 2 survives intact
  // at the very end.
  const blockIndices = after
    .map((c, i) => (c.tag === "DIV" && c.cls.includes("LexicalEditorTheme__block") ? i : -1))
    .filter((i) => i >= 0);
  const exactlyOneBlock = blockIndices.length === 1;
  const blockIndex = blockIndices[0];
  const notFirst = exactlyOneBlock && blockIndex > 0;
  const notLast = exactlyOneBlock && blockIndex < after.length - 1;
  const lastChildIsPara2 = after.length > 0 && after[after.length - 1].text === PARA2;
  // Every fragment OTHER than the block itself and the final (paragraph-2) node belongs
  // to paragraph 1 — whether that is one intact node or two split halves around the
  // block. Concatenated in order, it must reconstitute paragraph 1 exactly, proving no
  // characters were silently dropped or duplicated by the split.
  const para1Fragments = exactlyOneBlock
    ? after.slice(0, after.length - 1).filter((_, i) => i !== blockIndex)
    : [];
  const reconstructedPara1 = para1Fragments.map((c) => c.text).join("");
  const para1FullyPreserved = reconstructedPara1 === PARA1;
  const blockCarriesArabicLabel = exactlyOneBlock && after[blockIndex].text.includes("تضمين منشور");

  const pass =
    before.length === 2 &&
    before[0].text === PARA1 &&
    before[1].text === PARA2 &&
    exactlyOneBlock &&
    notFirst &&
    notLast &&
    lastChildIsPara2 &&
    para1FullyPreserved &&
    blockCarriesArabicLabel;

  record(`A2.2 [${viewportName}] block insertion lands at the cursor, not appended last`, pass, {
    before,
    after,
    blockIndex,
    notFirst,
    notLast,
    lastChildIsPara2,
    reconstructedPara1,
    para1FullyPreserved,
    blockCarriesArabicLabel,
  });
}

async function verifyMissingAltValidation(page: Page) {
  await page.goto(`${BASE_URL}/admin/collections/media/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.setInputFiles('input[type="file"]', TINY_PNG_PATH);
  await page.waitForTimeout(500);

  // waitForResponse (not a "response" listener) so a race against unrelated responses
  // (fonts, HMR pings, etc. firing first) cannot cause this to miss the one that matters —
  // an earlier version used page.once("response", ...) and it silently never matched.
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/media") && res.request().method() === "POST",
      { timeout: 10000 },
    ),
    page.locator("#action-save").click(),
  ]);
  const responseStatus = response.status();
  const responseBody = await response.text().catch(() => "");
  await page.waitForTimeout(1500);

  const urlAfter = page.url();
  const errorToast = page.locator(".payload-toast-item.toast-error");
  const toastVisible = (await errorToast.count()) > 0;
  const toastText = toastVisible ? (await errorToast.first().innerText()).trim() : "";
  const fieldErrorVisible = (await page.locator(".field-type.error").count()) > 0;

  await page.screenshot({ path: path.join(EVIDENCE_DIR, "missing-alt-validation.png") }).catch(() => {});

  const pass =
    responseStatus === 400 &&
    /alt/.test(responseBody) &&
    toastVisible &&
    fieldErrorVisible &&
    urlAfter === `${BASE_URL}/admin/collections/media/create`;

  record("A2.4 missing alt text is rejected, not saved silently", pass, {
    responseStatus,
    responseBody,
    toastVisible,
    toastText,
    fieldErrorVisible,
    urlAfter,
  });
}

async function main() {
  console.log(`Target: ${BASE_URL}`);
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await login(page);
  await switchAdminLanguageToArabic(page);

  const viewports: { name: string; width: number; height: number }[] = [
    { name: "phone-390", width: 390, height: 844 },
    { name: "desktop-1440", width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await verifyBlockLabels(page, vp.name);
    await verifyCursorInsertion(page, vp.name);
  }

  await verifyMissingAltValidation(page);

  await browser.close();

  const summaryPath = path.join(EVIDENCE_DIR, "results.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nFull evidence written to: ${summaryPath}`);

  console.log("\n=== SUMMARY ===");
  for (const [name, r] of Object.entries(results)) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${name}`);
  }

  if (anyFailure) {
    console.error("\nAt least one check FAILED. See detail above / results.json.");
    process.exit(1);
  }
  console.log("\nAll checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
