"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AdSlot } from "./AdSlot";

const DISMISS_KEY = "ad-sticky-dismissed";

export function StickyMobileAd() {
  const t = useTranslations("common");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div
      data-testid="sticky-mobile-ad"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background border-t border-neutral-200 dark:border-neutral-800 p-1"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="absolute top-0 right-1 text-xs text-muted-foreground px-1"
      >
        ×
      </button>
      <AdSlot slotName="stickyMobile" format="sticky-mobile" loading="lazy" />
    </div>
  );
}
