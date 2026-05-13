export type MockLocaleString = { en: string; ar: string; fr: string };

export type MockLeague = {
  id: string;
  name: MockLocaleString;
  logoUrl: string;
};

export type MockLeagueArticle = {
  id: string;
  leagueId: string;
  title: MockLocaleString;
  slug: string;
  imageUrl: string;
  category: MockLocaleString;
  publishedAt: string;
};

export const MOCK_LEAGUES: MockLeague[] = [
  {
    id: "botola-pro",
    name: { en: "Botola Pro", ar: "البطولة الاحترافية", fr: "Botola Pro" },
    logoUrl: "https://media.api-sports.io/football/leagues/200.png",
  },
  {
    id: "champions-league",
    name: { en: "Champions League", ar: "دوري أبطال أوروبا", fr: "Ligue des champions" },
    logoUrl: "https://media.api-sports.io/football/leagues/2.png",
  },
  {
    id: "premier-league",
    name: { en: "Premier League", ar: "الدوري الإنجليزي", fr: "Premier League" },
    logoUrl: "https://media.api-sports.io/football/leagues/39.png",
  },
  {
    id: "la-liga",
    name: { en: "La Liga", ar: "الدوري الإسباني", fr: "La Liga" },
    logoUrl: "https://media.api-sports.io/football/leagues/140.png",
  },
  {
    id: "serie-a",
    name: { en: "Serie A", ar: "الدوري الإيطالي", fr: "Serie A" },
    logoUrl: "https://media.api-sports.io/football/leagues/135.png",
  },
  {
    id: "ligue-1",
    name: { en: "Ligue 1", ar: "الدوري الفرنسي", fr: "Ligue 1" },
    logoUrl: "https://media.api-sports.io/football/leagues/61.png",
  },
];

function makeArticle(
  leagueId: string,
  index: number,
  base: MockLocaleString,
  category: MockLocaleString,
  publishedAt: string,
): MockLeagueArticle {
  return {
    id: `${leagueId}-${index}`,
    leagueId,
    title: base,
    slug: `${leagueId}-article-${index}`,
    imageUrl: `https://picsum.photos/seed/${leagueId}-${index}/640/360`,
    category,
    publishedAt,
  };
}

export const MOCK_LEAGUE_ARTICLES: MockLeagueArticle[] = [
  // Botola Pro
  makeArticle("botola-pro", 1, { en: "Raja secure derby victory over Wydad", ar: "الرجاء يحقق فوزا في الديربي على الوداد", fr: "Le Raja remporte le derby face au Wydad" }, { en: "Botola", ar: "البطولة", fr: "Botola" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("botola-pro", 2, { en: "AS FAR climb to top of Botola standings", ar: "الجيش الملكي يتصدر ترتيب البطولة", fr: "L'AS FAR prend la tête du classement" }, { en: "Botola", ar: "البطولة", fr: "Botola" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("botola-pro", 3, { en: "RS Berkane lift Confederation Cup again", ar: "نهضة بركان تتوج بكأس الكاف من جديد", fr: "La RS Berkane remporte à nouveau la Coupe de la CAF" }, { en: "Continental", ar: "قاري", fr: "Continental" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("botola-pro", 4, { en: "Moroccan U23 squad announced for friendlies", ar: "الإعلان عن لائحة المنتخب الأولمبي للمباريات الودية", fr: "Liste des U23 marocains pour les amicaux dévoilée" }, { en: "National Team", ar: "المنتخب", fr: "Sélection" }, "2026-05-10T12:00:00.000Z"),

  // Champions League
  makeArticle("champions-league", 1, { en: "Real Madrid edge Bayern in semi-final thriller", ar: "ريال مدريد يتجاوز بايرن في إثارة نصف النهائي", fr: "Real Madrid bat le Bayern dans un demi-finale haletante" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("champions-league", 2, { en: "Man City through after dramatic comeback", ar: "مانشستر سيتي يتأهل بعد عودة درامية", fr: "Manchester City se qualifie après une remontée dramatique" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("champions-league", 3, { en: "Champions League final venue confirmed", ar: "تأكيد ملعب نهائي دوري الأبطال", fr: "Le stade de la finale de la LDC confirmé" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("champions-league", 4, { en: "Hakimi's PSG eliminated in quarters", ar: "إقصاء حكيمي وباريس في ربع النهائي", fr: "Hakimi et le PSG éliminés en quarts" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-10T12:00:00.000Z"),

  // Premier League
  makeArticle("premier-league", 1, { en: "Arsenal close gap at the top of the table", ar: "أرسنال يقلص الفارق في الصدارة", fr: "Arsenal réduit l'écart en tête du classement" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("premier-league", 2, { en: "Liverpool clinch derby win at Anfield", ar: "ليفربول يحقق فوز الديربي في أنفيلد", fr: "Liverpool remporte le derby à Anfield" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("premier-league", 3, { en: "Ziyech rumoured to make Premier League return", ar: "أنباء عن عودة زياش إلى البريميرليغ", fr: "Ziyech vers un retour en Premier League" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("premier-league", 4, { en: "Title race goes to the final matchday", ar: "صراع اللقب يحسم في الجولة الأخيرة", fr: "La course au titre se jouera lors de la dernière journée" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, "2026-05-10T12:00:00.000Z"),

  // La Liga
  makeArticle("la-liga", 1, { en: "Real Madrid crowned La Liga champions", ar: "ريال مدريد بطلا للدوري الإسباني", fr: "Le Real Madrid sacré champion de La Liga" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("la-liga", 2, { en: "Barcelona youngster signs new long-term deal", ar: "موهبة برشلونة توقع عقدا طويل الأمد", fr: "Le jeune barcelonais prolonge son contrat" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("la-liga", 3, { en: "Atletico clinch Champions League spot", ar: "أتلتيكو يضمن مقعدا في دوري الأبطال", fr: "L'Atlético décroche son ticket pour la LDC" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("la-liga", 4, { en: "Sevilla appoint new head coach", ar: "إشبيلية يعين مدربا جديدا", fr: "Séville nomme un nouvel entraîneur" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, "2026-05-10T12:00:00.000Z"),

  // Serie A
  makeArticle("serie-a", 1, { en: "Inter retain Scudetto with games to spare", ar: "إنتر يحتفظ بالسكوديتو قبل نهاية الموسم", fr: "L'Inter conserve le Scudetto avant la fin de saison" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("serie-a", 2, { en: "Juventus rebuild continues with new signings", ar: "يوفنتوس يواصل إعادة البناء بصفقات جديدة", fr: "La Juventus poursuit sa reconstruction avec de nouvelles recrues" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("serie-a", 3, { en: "Napoli search for next coach", ar: "نابولي يبحث عن مدرب جديد", fr: "Naples cherche son prochain entraîneur" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("serie-a", 4, { en: "Milan derby ends in dramatic draw", ar: "ديربي ميلانو ينتهي بتعادل مثير", fr: "Le derby de Milan se termine sur un nul dramatique" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, "2026-05-10T12:00:00.000Z"),

  // Ligue 1
  makeArticle("ligue-1", 1, { en: "PSG seal another Ligue 1 title", ar: "باريس يحسم لقب الليغ آن مجددا", fr: "Le PSG décroche un nouveau titre de Ligue 1" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("ligue-1", 2, { en: "Monaco confirm European football return", ar: "موناكو يؤكد العودة إلى المسابقات الأوروبية", fr: "Monaco confirme son retour en coupe d'Europe" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("ligue-1", 3, { en: "Marseille hire new sporting director", ar: "مارسيليا يعين مديرا رياضيا جديدا", fr: "Marseille recrute un nouveau directeur sportif" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("ligue-1", 4, { en: "Lyon clinch final European spot", ar: "ليون يخطف آخر مقعد أوروبي", fr: "Lyon arrache la dernière place européenne" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-10T12:00:00.000Z"),
];

export function getArticlesForLeague(leagueId: string): MockLeagueArticle[] {
  return MOCK_LEAGUE_ARTICLES.filter((a) => a.leagueId === leagueId).slice(0, 4);
}
