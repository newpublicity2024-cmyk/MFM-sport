// Hand-curated Arabic player/coach names, keyed by api-football person id.
// These OVERRIDE the generated layer. Players not listed here fall back to the
// generated Wikidata name, then to transliteration — so the vast majority are
// still covered automatically; this list pins the most iconic names so a future
// regeneration can never drop or change them.
export const PEOPLE_AR_OVERRIDES: Record<number, string> = {
  // Morocco national-team stars (home audience — guaranteed correct & stable)
  9: "أشرف حكيمي", // Achraf Hakimi
  74: "سفيان أمرابط", // Sofyan Amrabat
  545: "نصير مزراوي", // Noussair Mazraoui
  548: "حكيم زياش", // Hakim Ziyech
  2719: "نورالدين أمرابط", // Nordin Amrabat
  21694: "نايف أكرد", // Nayef Aguerd
  47422: "يوسف النصيري", // Youssef En-Nesyri
  129678: "عز الدين أوناحي", // Azzedine Ounahi
  340573: "بلال الخنوس", // Bilal El Khannouss
  412: "أمين حارث", // Amine Harit
  445: "يونس بلهندة", // Younès Belhanda
  578: "عادل تاعرابت", // Adel Taarabt
  243: "زكرياء أبوخلال", // Zakaria Aboukhlal

  // Global icons
  306: "محمد صلاح", // Mohamed Salah
  278: "كيليان مبابي", // Kylian Mbappé
  1100: "إيرلينغ هالاند", // Erling Haaland
  762: "فينيسيوس جونيور", // Vinícius Júnior
  759: "كريم بنزيما", // Karim Benzema
  153: "عثمان ديمبيلي", // Ousmane Dembélé
};
