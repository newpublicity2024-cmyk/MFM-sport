import { LEAGUES_AR } from "./dictionaries/leagues.ar";
import { TEAMS_AR } from "./dictionaries/teams.ar";
import { NATIONAL_TEAMS_AR } from "./dictionaries/national-teams.ar";
import { PEOPLE_AR } from "./dictionaries/people.ar";
import { transliterateToArabic } from "./transliterate";

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
  if (id != null && dict[id]) return dict[id];
  // No curated/sourced Arabic name — transliterate so nothing stays Latin.
  return transliterateToArabic(latin);
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
  // National teams use the proper Arabic country name (translation), not a
  // transliteration of the English. Checked first; clubs are unaffected.
  if (locale === "ar" && id != null && NATIONAL_TEAMS_AR[id]) return NATIONAL_TEAMS_AR[id];
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

const ARABIC_LETTERS: Record<string, string> = {
  A: "أ",
  B: "ب",
  C: "ج",
  D: "د",
  E: "هـ",
  F: "و",
  G: "ز",
  H: "ح",
  I: "ط",
  J: "ي",
  K: "ك",
  L: "ل",
};

function arabicLetter(c: string): string {
  return ARABIC_LETTERS[c.toUpperCase()] ?? c;
}

type Rule = { re: RegExp; ar: (m: RegExpMatchArray) => string };

const ROUND_RULES: Rule[] = [
  { re: /^Regular Season - (\d+)$/i, ar: (m) => `الأسبوع ${m[1]}` },
  { re: /^Matchday (\d+)$/i, ar: (m) => `الجولة ${m[1]}` },
  { re: /^Round of (\d+)$/i, ar: (m) => `دور الـ${m[1]}` },
  { re: /^(\d+)(?:st|nd|rd|th) Round$/i, ar: (m) => `الدور ${m[1]}` },
  { re: /^Quarter[- ]?finals?$/i, ar: () => "ربع النهائي" },
  { re: /^Semi[- ]?finals?$/i, ar: () => "نصف النهائي" },
  { re: /^3rd Place Final$/i, ar: () => "مباراة المركز الثالث" },
  { re: /^Final$/i, ar: () => "النهائي" },
  {
    re: /^Group Stage(?: - (\d+))?$/i,
    ar: (m) => (m[1] ? `دور المجموعات ${m[1]}` : "دور المجموعات"),
  },
  { re: /^Group ([A-Z])$/i, ar: (m) => `المجموعة ${arabicLetter(m[1])}` },
  { re: /^Preliminary Round$/i, ar: () => "الدور التمهيدي" },
  { re: /^Knockout Round Play-?offs?$/i, ar: () => "ملحق الأدوار الإقصائية" },
  { re: /^Play-?offs?$/i, ar: () => "الملحق" },
];

function applyRules(value: string, locale: string): string {
  if (locale !== "ar" || !value) return value;
  for (const rule of ROUND_RULES) {
    const m = value.match(rule.re);
    if (m) return rule.ar(m);
  }
  return value; // honest Latin fallback
}

export function localizeRound(round: string, locale: string): string {
  return applyRules(round, locale);
}

export function localizeGroup(group: string, locale: string): string {
  return applyRules(group, locale);
}
