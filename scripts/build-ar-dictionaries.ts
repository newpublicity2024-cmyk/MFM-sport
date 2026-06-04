/**
 * Offline sourcing of Arabic team names for the football-data localization
 * layer. Harvests the team roster of the curated competitions from API-Football
 * (authoritative ids + Latin names), resolves an Arabic label for each from
 * Wikidata in batches, and writes the GENERATED dictionary layer.
 *
 * Usage:
 *   pnpm build:ar-dicts                 # teams: harvest + Wikidata -> teams.generated.ar.ts
 *   pnpm build:ar-dicts -- --players    # players: squads + Wikidata -> people.generated.ar.ts
 *   pnpm build:ar-dicts -- --dry-run    # harvest + print roster only, NO Wikidata, NO write
 *   pnpm build:ar-dicts -- --players --dry-run  # print harvested squad players only
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
const PLAYERS = process.argv.includes("--players");

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
const BATCH_SIZE = 60;

// Entity-type WHERE fragments for Wikidata matching.
// Teams: instance of football club / national association football team.
const TEAM_TYPE_CLAUSE = `?item wdt:P31/wdt:P279* ?cls . VALUES ?cls { wd:Q476028 wd:Q6979593 }`;
// Players: occupation = association football player.
const PLAYER_TYPE_CLAUSE = `?item wdt:P106 wd:Q937857 .`;

// Teams whose current squads we pull to seed verified player names. Authoritative
// api-football ids (harvested live). Botola clubs + Morocco NT first (home
// audience), then global stars' clubs and major national teams.
const SQUAD_TEAM_IDS: number[] = [
  // Botola Pro
  962, 964, 965, 968, 969, 973, 974, 975, 976, 977, 3453, 3454, 3455, 6387,
  // Morocco + major national teams
  31, 28, 13, 1530, 1504, 23, 1569, 2, 9, 10, 27,
  // Global club stars
  541, 529, 530, 531, 536, 50, 40, 42, 49, 33, 47, 34, 85, 157, 165, 168, 173,
  496, 505, 489, 492, 497, 499, 487,
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasArabic(s: string): boolean {
  return /[؀-ۿ]/.test(s);
}

function sparqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Drop Wikidata disambiguation suffixes like " (لاعب كرة قدم مواليد 1999)". */
function cleanLabel(s: string): string {
  return s.replace(/\s*[(（].*$/, "").trim();
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
 * `typeClause` constrains the entity type (team vs player). Returns a map keyed
 * by the EXACT input name -> Arabic label.
 */
async function arabicLabelsForBatch(
  names: string[],
  typeClause: string,
): Promise<Map<string, string>> {
  const values = names.map((n) => `"${sparqlString(n)}"@en`).join(" ");
  const query = `
    SELECT ?en ?arLabel WHERE {
      VALUES ?en { ${values} }
      ?item rdfs:label|skos:altLabel ?en .
      ${typeClause}
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
    const ar = b.arLabel?.value ? cleanLabel(b.arLabel.value) : undefined;
    if (en && ar && hasArabic(ar) && !out.has(en)) out.set(en, ar);
  }
  return out;
}

type PlayersResponse = {
  player: { id: number; name: string; firstname: string | null; lastname: string | null };
};

// National-team ids in SQUAD_TEAM_IDS — query their WC-2022 season for squads.
const NATIONAL_TEAM_IDS = new Set([31, 28, 13, 1530, 1504, 23, 1569, 2, 9, 10, 27]);

/**
 * Collect a deduped id -> FULL Latin name map for the squads of SQUAD_TEAM_IDS.
 * Uses /players (full names) — NOT /players/squads, which only returns
 * abbreviated names like "A. Hakimi" that won't match Wikidata labels.
 */
async function harvestPlayers(): Promise<Map<number, string>> {
  const players = new Map<number, string>();
  for (const teamId of SQUAD_TEAM_IDS) {
    const season = NATIONAL_TEAM_IDS.has(teamId) ? 2022 : 2024;
    let found = 0;
    for (let page = 1; page <= 5; page++) {
      const rows = await fetchApi<PlayersResponse>(
        "/players",
        { team: teamId, season, page },
        0,
      );
      if (rows.length === 0) break;
      for (const r of rows) {
        const p = r.player;
        const full =
          p.firstname && p.lastname ? `${p.firstname} ${p.lastname}` : p.name;
        if (p.id != null && !players.has(p.id)) {
          players.set(p.id, full);
          found++;
        }
      }
      if (rows.length < 20) break; // last page
    }
    console.error(`[players] team ${teamId} (season ${season}): +${found} players`);
  }
  return players;
}

function renderGeneratedFile(
  entries: [number, string][],
  exportName: string,
  kindComment: string,
): string {
  const sorted = [...entries].sort((a, b) => a[0] - b[0]);
  const body = sorted.map(([id, name]) => `  ${id}: ${JSON.stringify(name)},`).join("\n");
  return `// AUTO-GENERATED by scripts/build-ar-dictionaries.ts — DO NOT EDIT BY HAND.
// ${kindComment}
export const ${exportName}: Record<number, string> = {
${body}
};
`;
}

/** Resolve a harvested id->name map against Wikidata, writing the generated file. */
async function resolveAndWrite(
  roster: Map<number, string>,
  typeClause: string,
  outRelPath: string,
  exportName: string,
  kindComment: string,
  overridesHint: string,
): Promise<void> {
  // name -> id (we query by name, then map the matched name back to its id).
  const nameToId = new Map<string, number>();
  for (const [id, name] of roster) nameToId.set(name, id);
  const allNames = [...nameToId.keys()];

  const resolved: [number, string][] = [];
  const resolvedNames = new Set<string>();

  for (let i = 0; i < allNames.length; i += BATCH_SIZE) {
    const chunk = allNames.slice(i, i + BATCH_SIZE);
    const labels = await arabicLabelsForBatch(chunk, typeClause);
    for (const [name, ar] of labels) {
      const id = nameToId.get(name);
      if (id != null) {
        resolved.push([id, ar]);
        resolvedNames.add(name);
      }
    }
    console.error(
      `[wikidata] batch ${i / BATCH_SIZE + 1}: ${labels.size}/${chunk.length} resolved ` +
        `(${resolved.length}/${roster.size} total)`,
    );
    await sleep(800);
  }

  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    outRelPath,
  );
  writeFileSync(outPath, renderGeneratedFile(resolved, exportName, kindComment), "utf8");
  console.error(`\nWrote ${resolved.length} generated entries to ${outPath}`);

  const unresolved = allNames.filter((n) => !resolvedNames.has(n));
  console.error(`\nUnresolved (${unresolved.length}) — add high-value ones to ${overridesHint}:`);
  for (const name of unresolved.sort()) {
    console.error(`  ${nameToId.get(name)}: "", // ${name}`);
  }
}

async function main() {
  if (!process.env.API_FOOTBALL_KEY) {
    console.error("ERROR: API_FOOTBALL_KEY is not set (.env). Aborting.");
    process.exit(1);
  }

  if (PLAYERS) {
    console.error("Harvesting squads from API-Football…");
    const players = await harvestPlayers();
    console.error(`\nHarvested ${players.size} distinct players.\n`);

    if (DRY_RUN) {
      for (const [id, name] of [...players.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(`${id}\t${name}`);
      }
      console.error("\n--dry-run: no Wikidata lookups, no file written.");
      return;
    }

    await resolveAndWrite(
      players,
      PLAYER_TYPE_CLAUSE,
      "../src/lib/api-football/dictionaries/people.generated.ar.ts",
      "PEOPLE_AR_GENERATED",
      "Arabic player/coach names sourced from Wikidata, keyed by api-football person id.\n" +
        "// Treat as a draft: hand-corrections belong in `people.overrides.ar.ts`.",
      "people.overrides.ar.ts",
    );
    return;
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

  await resolveAndWrite(
    teams,
    TEAM_TYPE_CLAUSE,
    "../src/lib/api-football/dictionaries/teams.generated.ar.ts",
    "TEAMS_AR_GENERATED",
    "Arabic team names sourced from Wikidata, keyed by api-football team id.\n" +
      "// Treat as a draft: hand-corrections belong in `teams.overrides.ar.ts`, which\n" +
      "// overrides anything here. Re-running the script rewrites this file in place.",
    "teams.overrides.ar.ts",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
