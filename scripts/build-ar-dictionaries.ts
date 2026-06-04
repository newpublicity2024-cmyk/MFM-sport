/**
 * Offline sourcing of Arabic team names for the football-data localization
 * layer. Harvests the team roster of the curated competitions from API-Football
 * (authoritative ids + Latin names), resolves an Arabic label for each from
 * Wikidata in batches, and writes the GENERATED dictionary layer.
 *
 * Usage:
 *   pnpm build:ar-dicts                 # harvest + Wikidata + write generated file
 *   pnpm build:ar-dicts -- --dry-run    # harvest + print roster only, NO Wikidata, NO write
 *
 * Requires: API_FOOTBALL_KEY (in .env). Network access to api-sports.io and
 * query.wikidata.org.
 *
 * IMPORTANT: output is a DRAFT. Wikidata name-matching is exact (label/altLabel)
 * so some clubs whose api-football name differs from the Wikidata label (e.g.
 * "Barcelona" vs "FC Barcelona") will not resolve and fall back to Latin.
 * Review the diff and put high-value / wrong names in `teams.overrides.ar.ts`
 * (which wins over this generated layer). Re-running rewrites ONLY the generated
 * file.
 */

import "dotenv/config";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { fetchApi } from "../src/lib/api-football/client";
import type { ApiStandingsResponse, ApiFixture } from "../src/lib/api-football/types";

const DRY_RUN = process.argv.includes("--dry-run");

// The curated competition set (id + season), mirroring scripts/seed.ts.
const COMPETITIONS: { id: number; season: number; label: string }[] = [
  { id: 200, season: 2024, label: "Botola Pro 1" },
  { id: 12, season: 2024, label: "CAF Champions League" },
  { id: 20, season: 2024, label: "CAF Confederation Cup" },
  { id: 6, season: 2024, label: "Africa Cup of Nations" },
  { id: 1, season: 2022, label: "FIFA World Cup" },
  { id: 39, season: 2024, label: "Premier League" },
  { id: 140, season: 2024, label: "La Liga" },
  { id: 78, season: 2024, label: "Bundesliga" },
  { id: 135, season: 2024, label: "Serie A" },
  { id: 61, season: 2024, label: "Ligue 1" },
  { id: 2, season: 2024, label: "UEFA Champions League" },
  { id: 3, season: 2024, label: "UEFA Europa League" },
];

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "mfm-sport-ar-dictionaries/1.0 (https://mfm-sport-kappa.vercel.app; localization seeding)";
// Wikidata classes: football club, national association football team.
const TEAM_CLASSES = ["wd:Q476028", "wd:Q6979593"];
const BATCH_SIZE = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasArabic(s: string): boolean {
  return /[؀-ۿ]/.test(s);
}

function sparqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Collect a deduped id -> Latin name map for every team across the curated set. */
async function harvestTeams(): Promise<Map<number, string>> {
  const teams = new Map<number, string>();

  for (const comp of COMPETITIONS) {
    let found = 0;

    // 1) Standings: covers all groups (ApiStandingsResponse.standings is grouped).
    const standings = await fetchApi<ApiStandingsResponse>(
      "/standings",
      { league: comp.id, season: comp.season },
      0,
    );
    for (const block of standings) {
      for (const group of block.league?.standings ?? []) {
        for (const row of group) {
          if (!teams.has(row.team.id)) {
            teams.set(row.team.id, row.team.name);
            found++;
          }
        }
      }
    }

    // 2) Fixtures: catches teams not present in a standings table (knockout-only).
    const fixtures = await fetchApi<ApiFixture>(
      "/fixtures",
      { league: comp.id, season: comp.season },
      0,
    );
    for (const f of fixtures) {
      for (const side of [f.teams.home, f.teams.away]) {
        if (side && !teams.has(side.id)) {
          teams.set(side.id, side.name);
          found++;
        }
      }
    }

    console.error(`[harvest] ${comp.label} (${comp.id}/${comp.season}): +${found} teams`);
  }

  return teams;
}

/**
 * Resolve Arabic labels for a batch of English names in one SPARQL request.
 * Returns a map keyed by the EXACT input name -> Arabic label.
 */
async function arabicLabelsForBatch(names: string[]): Promise<Map<string, string>> {
  const values = names.map((n) => `"${sparqlString(n)}"@en`).join(" ");
  const classes = TEAM_CLASSES.join(" ");
  const query = `
    SELECT ?en ?arLabel WHERE {
      VALUES ?en { ${values} }
      ?item rdfs:label|skos:altLabel ?en .
      ?item wdt:P31/wdt:P279* ?cls . VALUES ?cls { ${classes} }
      ?item rdfs:label ?arLabel . FILTER(LANG(?arLabel) = "ar")
    }`;

  const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    console.error(`[wikidata] ${res.status} ${res.statusText} for batch of ${names.length}`);
    return new Map();
  }
  const json = (await res.json()) as {
    results?: { bindings?: { en?: { value?: string }; arLabel?: { value?: string } }[] };
  };

  const out = new Map<string, string>();
  for (const b of json.results?.bindings ?? []) {
    const en = b.en?.value;
    const ar = b.arLabel?.value;
    if (en && ar && hasArabic(ar) && !out.has(en)) out.set(en, ar);
  }
  return out;
}

function renderGeneratedFile(entries: [number, string][]): string {
  const sorted = [...entries].sort((a, b) => a[0] - b[0]);
  const body = sorted.map(([id, name]) => `  ${id}: ${JSON.stringify(name)},`).join("\n");
  return `// AUTO-GENERATED by scripts/build-ar-dictionaries.ts — DO NOT EDIT BY HAND.
// Arabic team names sourced from Wikidata, keyed by api-football team id.
// Treat as a draft: hand-corrections belong in \`teams.overrides.ar.ts\`, which
// overrides anything here. Re-running the script rewrites this file in place.
export const TEAMS_AR_GENERATED: Record<number, string> = {
${body}
};
`;
}

async function main() {
  if (!process.env.API_FOOTBALL_KEY) {
    console.error("ERROR: API_FOOTBALL_KEY is not set (.env). Aborting.");
    process.exit(1);
  }

  console.error("Harvesting team roster from API-Football…");
  const teams = await harvestTeams();
  console.error(`\nHarvested ${teams.size} distinct teams.\n`);

  if (DRY_RUN) {
    for (const [id, name] of [...teams.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`${id}\t${name}`);
    }
    console.error("\n--dry-run: no Wikidata lookups, no file written.");
    return;
  }

  // name -> id (we query by name, then map the matched name back to its id).
  const nameToId = new Map<string, number>();
  for (const [id, name] of teams) nameToId.set(name, id);
  const allNames = [...nameToId.keys()];

  const resolved: [number, string][] = [];
  const resolvedNames = new Set<string>();

  for (let i = 0; i < allNames.length; i += BATCH_SIZE) {
    const chunk = allNames.slice(i, i + BATCH_SIZE);
    const labels = await arabicLabelsForBatch(chunk);
    for (const [name, ar] of labels) {
      const id = nameToId.get(name);
      if (id != null) {
        resolved.push([id, ar]);
        resolvedNames.add(name);
      }
    }
    console.error(
      `[wikidata] batch ${i / BATCH_SIZE + 1}: ${labels.size}/${chunk.length} resolved ` +
        `(${resolved.length}/${teams.size} total)`,
    );
    await sleep(800);
  }

  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/lib/api-football/dictionaries/teams.generated.ar.ts",
  );
  writeFileSync(outPath, renderGeneratedFile(resolved), "utf8");

  console.error(`\nWrote ${resolved.length} generated entries to ${outPath}`);

  const unresolved = allNames.filter((n) => !resolvedNames.has(n));
  console.error(
    `\nUnresolved (${unresolved.length}) — add high-value ones to teams.overrides.ar.ts after review:`,
  );
  for (const name of unresolved.sort()) {
    console.error(`  ${nameToId.get(name)}: "", // ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
