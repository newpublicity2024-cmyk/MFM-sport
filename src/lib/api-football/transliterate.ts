/**
 * Rule-based Latin → Arabic phonetic transliteration.
 *
 * This is the LAST-RESORT fallback for `localize*` helpers: it guarantees that
 * any team/player/league name renders in Arabic script even when no curated or
 * Wikidata-sourced name exists. It is an approximation, NOT a canonical name —
 * well-known entities should be covered by the dictionaries (which win). Tune
 * recognisable cases via the dictionaries' override layer, not here.
 *
 * Pure, deterministic, dependency-free. Latin scripts (en/fr/es/de/pt/…) only;
 * input already containing Arabic is returned unchanged.
 */

// Letters NFD does not decompose — map before stripping combining marks.
const SPECIAL: Record<string, string> = {
  ç: "s",
  ñ: "n",
  ø: "o",
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ł: "l",
  đ: "d",
  þ: "th",
  ð: "d",
};

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

// Multi-character sequences, matched longest-first before single letters.
const MULTI: [string, string][] = [
  ["tsch", "تش"],
  ["sch", "ش"],
  ["sch", "ش"],
  ["sh", "ش"],
  ["ch", "تش"],
  ["ph", "ف"],
  ["th", "ث"],
  ["gh", "غ"],
  ["kh", "خ"],
  ["ck", "ك"],
  ["qu", "كو"],
  ["ng", "نغ"],
  ["oo", "و"],
  ["ee", "ي"],
  ["ou", "و"],
  ["au", "او"],
  ["ai", "اي"],
  ["ay", "اي"],
  ["ei", "اي"],
  ["ey", "اي"],
];

const SINGLE: Record<string, string> = {
  a: "ا",
  e: "ي",
  i: "ي",
  o: "و",
  u: "و",
  y: "ي",
  b: "ب",
  c: "ك",
  d: "د",
  f: "ف",
  g: "غ",
  h: "ه",
  j: "ج",
  k: "ك",
  l: "ل",
  m: "م",
  n: "ن",
  p: "ب",
  q: "ق",
  r: "ر",
  s: "س",
  t: "ت",
  v: "ف",
  w: "و",
  x: "كس",
  z: "ز",
};

function normalize(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/[çñøßæœłđþð]/g, (c) => SPECIAL[c] ?? c);
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s;
}

function hasArabic(s: string): boolean {
  return /[؀-ۿ]/.test(s);
}

/** Transliterate a single whitespace-free token. */
function transliterateWord(word: string): string {
  let out = "";
  let i = 0;
  let firstLetter = true;

  while (i < word.length) {
    const ch = word[i];

    // Pass digits and any non a-z punctuation straight through.
    if (!/[a-z]/.test(ch)) {
      out += ch;
      i += 1;
      continue;
    }

    // Word-initial vowel needs a carrier alif so the syllable can begin.
    if (firstLetter && VOWELS.has(ch)) {
      if (ch === "a") out += "ا";
      else if (ch === "o" || ch === "u") out += "أو";
      else out += "إي"; // e, i, y
      firstLetter = false;
      i += 1;
      continue;
    }

    // Longest multigraph match.
    let matched = false;
    for (const [seq, ar] of MULTI) {
      if (word.startsWith(seq, i)) {
        out += ar;
        i += seq.length;
        matched = true;
        break;
      }
    }
    if (matched) {
      firstLetter = false;
      continue;
    }

    // Collapse doubled consonants ("Messi" -> ميسي).
    if (ch === word[i + 1] && !VOWELS.has(ch)) {
      i += 1;
      continue;
    }

    // Soft c / g before front vowels.
    const next = word[i + 1];
    if (ch === "c") {
      out += next === "e" || next === "i" || next === "y" ? "س" : "ك";
    } else if (ch === "g") {
      out += next === "e" || next === "i" || next === "y" ? "ج" : "غ";
    } else {
      out += SINGLE[ch] ?? ch;
    }

    firstLetter = false;
    i += 1;
  }

  return out;
}

/**
 * Transliterate a full Latin name to Arabic script. Preserves spacing and
 * hyphens between words. Returns the input unchanged if it already contains
 * Arabic or has no Latin letters.
 */
export function transliterateToArabic(input: string): string {
  if (!input) return input;
  if (hasArabic(input)) return input;
  if (!/[a-zA-Z]/.test(input)) return input;

  const normalized = normalize(input);
  // Split on runs of spaces/hyphens, keeping the separators.
  return normalized
    .split(/(\s+|-+)/)
    .map((part) => (/^(\s+|-+)$/.test(part) ? part : transliterateWord(part)))
    .join("");
}
