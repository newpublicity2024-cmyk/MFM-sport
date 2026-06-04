import { LEAGUES_AR } from "./dictionaries/leagues.ar";
import { TEAMS_AR } from "./dictionaries/teams.ar";
import { PEOPLE_AR } from "./dictionaries/people.ar";

export type LocaleString = { en: string; ar: string; fr: string };

/** Single source of truth for locale selection across the app. */
export function pickLocale(name: LocaleString, locale: string): string {
  if (locale === "ar") return name.ar;
  if (locale === "fr") return name.fr;
  return name.en;
}

function lookup(
  dict: Record<number, string>,
  id: number | null | undefined,
  latin: string,
  locale: string,
): string {
  if (locale !== "ar") return latin;
  if (id == null) return latin;
  return dict[id] ?? latin;
}

export function localizeLeague(
  id: number | null | undefined,
  latin: string,
  locale: string,
): string {
  return lookup(LEAGUES_AR, id, latin, locale);
}

export function localizeTeam(
  id: number | null | undefined,
  latin: string,
  locale: string,
): string {
  return lookup(TEAMS_AR, id, latin, locale);
}

/** Players and coaches share one curated dictionary keyed by api-football person id. */
export function localizePerson(
  id: number | null | undefined,
  latin: string,
  locale: string,
): string {
  return lookup(PEOPLE_AR, id, latin, locale);
}
