#!/usr/bin/env node
/**
 * Oracles for the September 2026 homepage refresh (big-four hero panel,
 * latest-news tag chips, single channel video feed). Each mode prints a
 * success-only marker after every assertion passes and exits 1 otherwise.
 *
 *   node scripts/verify-home-refresh.mjs videos        → VIDEOS OK
 *   node scripts/verify-home-refresh.mjs no-key        → NO-KEY OK
 *   node scripts/verify-home-refresh.mjs no-leftovers  → NO-LEFTOVERS OK
 *   node scripts/verify-home-refresh.mjs lint          → LINT CLEAN
 *   node scripts/verify-home-refresh.mjs tests         → SUITE OK
 *
 * Portable: Node only, no grep/sed. Reads the tracked tree via `git ls-files`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function trackedFiles() {
  // Tracked + not-yet-committed new files, so a fresh branch is measured too.
  // `git rm`-ed paths stay in the index until commit, so drop deleted ones.
  const out = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--deleted"],
    { cwd: root, encoding: "utf8" },
  );
  const deleted = new Set(
    execFileSync("git", ["ls-files", "--deleted"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean),
  );
  return [...new Set(out.split("\n").filter(Boolean))].filter((f) => !deleted.has(f));
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

if (mode === "videos") {
  const page = read("src/app/(frontend)/[locale]/(site)/page.tsx");
  const sections = count(page, "<VideosSection");
  if (sections !== 1) fail(`homepage renders ${sections} <VideosSection>, expected 1`);

  const yt = read("src/lib/youtube.ts");
  const channel = /YOUTUBE_CHANNEL_ID\s*=\s*"(UC[\w-]{22})"/.exec(yt);
  if (!channel) fail("no YOUTUBE_CHANNEL_ID (UC…) constant in lib/youtube.ts");
  if (!/uploadsPlaylistId\(YOUTUBE_CHANNEL_ID\)/.test(yt)) {
    fail("FEEDS does not derive its playlist from the channel id");
  }
  if (/playlistId:\s*"PL/.test(yt)) fail("a hand-picked PL… playlist id is still configured");
  const feeds = count(yt, "key: \"");
  if (feeds !== 1) fail(`${feeds} feeds configured, expected 1`);

  const sync = read("src/lib/youtube-sync.ts");
  if (!sync.includes("FEEDS")) fail("youtube-sync does not iterate FEEDS");
  if (/PLAYLISTS/.test(sync)) fail("youtube-sync still references PLAYLISTS");

  const listing = read("src/components/videos/VideosListing.tsx");
  if (count(listing, "<VideosSection") !== 1) fail("/videos listing does not render exactly one section");
  console.log("VIDEOS OK");
} else if (mode === "no-key") {
  // Google API keys are "AIza" + 35 url-safe chars. Self-test on a positive
  // control first so a broken pattern cannot report a clean tree.
  const pattern = /AIza[0-9A-Za-z_-]{35}/;
  const control = "YOUTUBE_API_KEY=AIza" + "S".repeat(35);
  if (!pattern.test(control)) fail("negative control: the key pattern did not match a synthetic key");
  const hits = [];
  for (const f of trackedFiles()) {
    if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|xml)$/i.test(f)) continue;
    let text;
    try {
      text = read(f);
    } catch {
      continue;
    }
    if (pattern.test(text)) hits.push(f);
  }
  if (hits.length > 0) fail(`API key literal found in: ${hits.join(", ")}`);
  console.log("NO-KEY OK");
} else if (mode === "no-leftovers") {
  const needles = [
    "LeagueNewsSection",
    "LeaguesPanel",
    "resolveNewsFilters",
    "newsFilters",
    "byLeague",
    "videoThirdHalf",
    "videoFromStadiums",
    // The retired playlist keys may survive as comments / prune fixtures, but
    // never as a live query or an admin option.
    'getVideos("the-third-half"',
    'getVideos("from-the-stadiums"',
    'value: "from-the-stadiums"',
    'value: "the-third-half"',
    "PLAYLISTS",
    "heroMatches?.competition",
    "heroMatches.competition",
  ];
  const hits = [];
  for (const f of trackedFiles()) {
    if (!/^(src|messages|scripts)\//.test(f)) continue;
    if (f === "src/payload-types.ts") continue;
    if (f === "scripts/verify-home-refresh.mjs") continue;
    const text = read(f);
    for (const n of needles) if (text.includes(n)) hits.push(`${f}: ${n}`);
  }
  if (hits.length > 0) fail(`leftovers:\n  ${hits.join("\n  ")}`);
  // Positive control: the needle list itself must be non-trivial.
  if (needles.length < 5) fail("needle list too short to mean anything");
  console.log("NO-LEFTOVERS OK");
} else if (mode === "lint" || mode === "tests") {
  const version = execFileSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" }).trim();
  const pinned = /"packageManager":\s*"pnpm@([\d.]+)"/.exec(read("package.json"))?.[1];
  if (version !== pinned) fail(`pnpm ${version} running, package.json pins ${pinned}`);
  const args = mode === "lint" ? ["exec", "eslint", "."] : ["exec", "vitest", "run", "--config", "vitest.config.ts"];
  const res = spawnSync("pnpm", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = `${res.stdout}\n${res.stderr}`;
  if (mode === "lint") {
    const m = /✖ \d+ problems \((\d+) errors?, \d+ warnings?\)/.exec(out);
    const errors = m ? Number(m[1]) : /^\s*$/.test(res.stdout ?? "") ? 0 : NaN;
    if (Number.isNaN(errors)) fail(`could not read the eslint summary:\n${out.slice(-2000)}`);
    if (errors !== 0) fail(`eslint reports ${errors} errors`);
    console.log(`eslint errors: ${errors}`);
    console.log("LINT CLEAN");
  } else {
    const m = /Tests\s+(\d+) passed \((\d+)\)/.exec(out);
    if (res.status !== 0 || !m) fail(`vitest did not pass:\n${out.slice(-3000)}`);
    const passed = Number(m[1]);
    const total = Number(m[2]);
    // The summary lines are the oracle; a test's own log line may say "failed".
    if (/Test Files\s+\d+ failed|Tests\s+\d+ failed/.test(out)) fail("vitest summary reports failures");
    if (passed !== total) fail(`${passed}/${total} tests passed`);
    if (total < 640) fail(`only ${total} tests ran; the pre-change suite had 640`);
    console.log(`vitest: ${passed}/${total} passed`);
    console.log("SUITE OK");
  }
} else {
  fail(`unknown mode "${mode}"`);
}
