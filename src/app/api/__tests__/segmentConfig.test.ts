// src/app/api/__tests__/segmentConfig.test.ts
//
// Route segment config exports must be statically analyzable literals.
//
// This exists because of a build this branch actually broke. `revalidate` was
// written as `export const revalidate = TTL.FIXTURE_BY_ID` so the value had a
// single source of truth — and `tsc --noEmit`, eslint, 887 unit tests and a
// 68-assertion request-budget verifier all passed while `next build` failed
// with:
//
//     ⨯ Invalid segment configuration export detected.
//
// Next reads these exports by static analysis, before any module is evaluated,
// so an imported constant is invisible to it. The config is then silently not
// applied — which on this codebase means a route quietly losing its caching,
// the exact failure mode that `docs/verification-principles.md` was written
// about and that the whole API-Football quota investigation turned on.
//
// The numbers are therefore duplicated in the route files, and these tests are
// what stop the duplication from drifting. They read the files as text rather
// than importing them: an import would evaluate the module (pulling in Payload
// and a database connection for some routes) and, more importantly, would
// assert the evaluated value rather than the literal Next actually parses.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { TTL } from "@/lib/api-football/ttl";

const APP_DIR = join(process.cwd(), "src", "app");

/** Config exports Next resolves by static analysis, not by evaluation. */
const SEGMENT_CONFIG_KEYS = [
  "revalidate",
  "dynamic",
  "dynamicParams",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
] as const;

function routeAndPageFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      routeAndPageFiles(full, found);
    } else if (/^(route|page|layout)\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

/** Strips line and block comments so a commented example is not a finding. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

type Offender = { file: string; key: string; value: string };

function nonLiteralSegmentConfigs(files: string[]): Offender[] {
  const offenders: Offender[] = [];
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf8"));
    for (const key of SEGMENT_CONFIG_KEYS) {
      const match = new RegExp(
        `export\\s+const\\s+${key}\\s*(?::[^=]+)?=\\s*([^;\\n]+)`,
      ).exec(code);
      if (!match) continue;
      const value = match[1]!.trim();
      // A literal number, a quoted string, true/false, or `onDemandOnly`-style
      // identifiers are not segment config values we need to police here —
      // only `revalidate` and friends assigned from a member expression or a
      // call, which is what Next cannot see.
      const isLiteral =
        /^-?\d+(\.\d+)?$/.test(value) ||
        /^(['"`]).*\1$/.test(value) ||
        value === "true" ||
        value === "false";
      if (!isLiteral) offenders.push({ file: relative(process.cwd(), file), key, value });
    }
  }
  return offenders;
}

describe("route segment config exports", () => {
  const files = routeAndPageFiles(APP_DIR);

  it("finds the app router files to check", () => {
    // Guards the detector itself: a broken walk would make every absence
    // assertion below vacuously true.
    expect(files.length).toBeGreaterThan(20);
  });

  it("are all statically analyzable literals", () => {
    const offenders = nonLiteralSegmentConfigs(files);
    expect(
      offenders,
      offenders.length
        ? `Next resolves these by static analysis and would silently drop them:\n` +
          offenders.map((o) => `  ${o.file}: export const ${o.key} = ${o.value}`).join("\n")
        : "",
    ).toEqual([]);
  });

  // POSITIVE CONTROL: the detector must actually fail on the shape that broke
  // the build. Without this, "0 offenders" could just mean the regex is wrong.
  it("detects a non-literal export when one is present", () => {
    const sample = `
      import { TTL } from "@/lib/api-football/ttl";
      export const revalidate = TTL.FIXTURE_BY_ID;
    `;
    const code = stripComments(sample);
    const match = /export\s+const\s+revalidate\s*(?::[^=]+)?=\s*([^;\n]+)/.exec(code);
    expect(match).not.toBeNull();
    const value = match![1]!.trim();
    expect(/^-?\d+(\.\d+)?$/.test(value)).toBe(false);
  });

  it("ignores a non-literal that only appears inside a comment", () => {
    const sample = `
      // export const revalidate = TTL.LIVE_ALL;
      export const revalidate = 30;
    `;
    const code = stripComments(sample);
    const match = /export\s+const\s+revalidate\s*(?::[^=]+)?=\s*([^;\n]+)/.exec(code);
    expect(match![1]!.trim()).toBe("30");
  });
});

describe("the duplicated revalidate literals match ttl.ts", () => {
  /** Reads the literal Next will parse, not an evaluated module value. */
  function revalidateLiteral(file: string): number {
    const code = stripComments(readFileSync(join(process.cwd(), file), "utf8"));
    const match = /export\s+const\s+revalidate\s*(?::[^=]+)?=\s*([^;\n]+)/.exec(code);
    if (!match) throw new Error(`${file}: no revalidate export found`);
    const value = Number(match[1]!.trim());
    if (!Number.isFinite(value)) throw new Error(`${file}: revalidate is not a literal number`);
    return value;
  }

  it.each([
    ["src/app/api/fixtures/[id]/route.ts", "FIXTURE_BY_ID"],
    ["src/app/api/fixtures/live/route.ts", "LIVE_ALL"],
    ["src/app/api/standings/route.ts", "STANDINGS_LIVE"],
  ] as const)("%s equals TTL.%s", (file, key) => {
    expect(revalidateLiteral(file)).toBe(TTL[key]);
  });
});
