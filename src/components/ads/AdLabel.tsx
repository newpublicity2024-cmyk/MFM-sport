"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function AdLabel({ children, className = "" }: Props) {
  const t = useTranslations("ads");
  const label = t("label");

  return (
    <aside
      aria-label={label}
      className={`ad-container border border-neutral-200 dark:border-neutral-800 rounded-md p-2 ${className}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      {children}
    </aside>
  );
}
