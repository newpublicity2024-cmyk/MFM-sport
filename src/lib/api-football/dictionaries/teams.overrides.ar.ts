// Hand-curated Arabic team names, keyed by api-football team id.
// These OVERRIDE the auto-generated values in `teams.generated.ar.ts`, so the
// generated layer can be regenerated freely without clobbering manual fixes.
// Source of truth for any team whose generated name is wrong or missing.
//
// IDs are the AUTHORITATIVE api-football ids harvested from live standings /
// fixtures (NOT the stale ids in scripts/seed.ts — e.g. Wydad is 968, not 965).
export const TEAMS_AR_OVERRIDES: Record<number, string> = {
  // --- Botola Pro (home league — top priority) ---
  // Spellings of the 2026/27 Botola Pro 1 clubs follow Kooora's standings
  // table (the reference Arabic-language football site), harvested by
  // scrape/scrape-kooora-botola.ts and diffed by scrape/diff-team-names.ts.
  // Without an entry here `localizeTeam` transliterates the Latin api-football
  // label, which produced "كاوكاب ماراكيتش" / "كودم ميكنيس" on the live table.
  962: "نهضة بركان", // Renaissance Berkane
  964: "الدفاع الحسني الجديدي", // Difaa El Jadida
  965: "المغرب التطواني", // Moghreb Tetouan
  968: "الوداد الرياضي", // Wydad AC
  969: "الجيش الملكي", // FAR Rabat (AS FAR)
  971: "الكوكب الرياضي المراكشي", // Kawkab Marrakech (KACM)
  973: "حسنية أغادير", // Hassania Agadir
  974: "إتحاد طنجة", // Ittihad Tanger
  975: "أولمبيك آسفي", // Olympique Safi
  976: "الرجاء البيضاوي", // Raja Casablanca
  977: "الفتح الرباطي", // FUS Rabat
  3449: "نهضة الزمامرة", // Renaissance Zemamra (api-football: KR Khemis Zemamra)
  3453: "المغرب الفاسي", // Maghreb Fès
  3454: "أولمبيك الدشيرة", // Olympique Dcheïra
  3455: "رجاء بني ملال", // Raja Beni Mellal
  3458: "وداد تمارة", // Wydad Temara
  6387: "شباب المحمدية", // Chabab Mohammédia
  14806: "إتحاد تواركة", // Union Touarga Sport (api-football: UTS Rabat)
  22218: "النادي المكناسي", // CODM Meknès
  // Kooora itself lists Amal Tiznit in Latin ("US Amal Tiznit"), so there was no
  // Arabic spelling to harvest. This is the club's own Arabic name; the fallback
  // transliteration of the api-football label rendered it as "امال تيزنيت".
  18753: "أمل تيزنيت", // US Amal Tiznit

  // --- Marquee European clubs missed by exact-label matching ---
  42: "آرسنال", // Arsenal
  85: "باريس سان جيرمان", // Paris Saint-Germain
  93: "ريمس", // Reims
  415: "توينتي", // Twente
  494: "أودينيزي", // Udinese
  496: "يوفنتوس", // Juventus
  505: "إنتر ميلان", // Inter — fixes generated "إنتر للنساء" (Inter Women)
  517: "فينيتسيا", // Venezia
  529: "برشلونة", // Barcelona
  530: "أتلتيكو مدريد", // Atletico Madrid
  727: "أوساسونا", // Osasuna
  1063: "سانت إتيان", // Saint-Étienne

  // --- Major African clubs (high value for an Arabic / Moroccan audience) ---
  1036: "بيراميدز", // Pyramids FC
  1577: "الأهلي", // Al Ahly
  2699: "ماميلودي صنداونز", // Mamelodi Sundowns
  2700: "أورلاندو بايرتس", // Orlando Pirates
  4922: "بترو دي لواندا", // Petro de Luanda
  5370: "يانغ أفريكانز", // Young Africans
  6432: "سيمبا", // Simba
  6435: "مازيمبي", // TP Mazembe
  // National teams are handled separately in national-teams.ar.ts (proper Arabic
  // country names), so they are intentionally NOT listed here.
};
