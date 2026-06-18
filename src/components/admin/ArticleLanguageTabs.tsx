"use client";

import { useLocale, useTranslation } from "@payloadcms/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// The three content languages, shown each in its own script (the conventional
// way to label a language switcher). These are the content-localization locales
// from payload.config.ts — NOT the admin UI language.
const LANGUAGES: { code: string; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

// Hint shown to the editor, in whatever language their admin panel is set to.
const HINTS: Record<string, string> = {
  ar: "اختر اللغة التي تريد تحرير المقال بها:",
  fr: "Choisissez la langue de l'article à modifier :",
  en: "Choose the article language to edit:",
};

/**
 * Language tabs for the Article editor. Each tab switches Payload's active
 * content locale (the same mechanism as the built-in locale dropdown), so the
 * title / excerpt / body fields show that language's version. One language is
 * edited at a time; save before switching to keep your changes.
 */
export function ArticleLanguageTabs() {
  const locale = useLocale();
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = locale?.code;
  const hint = HINTS[i18n.language] ?? HINTS.en;

  const switchTo = (code: string) => {
    if (code === current) return;
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set("locale", code);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.8rem",
          color: "var(--theme-elevation-500)",
        }}
      >
        {hint}
      </p>
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--theme-elevation-150)",
          paddingBottom: "0.5rem",
        }}
      >
        {LANGUAGES.map((lang) => {
          const active = lang.code === current;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => switchTo(lang.code)}
              aria-pressed={active}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "var(--style-radius-s, 4px)",
                border: "1px solid",
                borderColor: active ? "var(--theme-elevation-200)" : "transparent",
                background: active ? "var(--theme-elevation-100)" : "transparent",
                color: active ? "var(--theme-text)" : "var(--theme-elevation-500)",
                fontWeight: active ? 600 : 400,
                cursor: active ? "default" : "pointer",
              }}
            >
              {lang.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
