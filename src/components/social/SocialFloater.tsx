// src/components/social/SocialFloater.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FLOATER_DROPDOWN, FLOATER_MAIN } from "./socialLinks";

export function SocialFloater() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const MainIcon = FLOATER_MAIN.Icon;

  // Close when clicking/tapping anywhere outside the floater.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: Event) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [open]);

  function handleMainClick() {
    // First click opens the menu; a second click (while open) goes to Instagram
    // and intentionally leaves the menu open.
    if (!open) {
      setOpen(true);
      return;
    }
    window.open(FLOATER_MAIN.href, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      ref={rootRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3"
    >
      {/* Dropdown — stacks ABOVE the main button and animates upward. */}
      <div
        data-floater-menu
        aria-hidden={!open}
        className={cn(
          "flex flex-col items-center gap-3 transition-all duration-200",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        {FLOATER_DROPDOWN.map(({ name, href, Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            tabIndex={open ? 0 : -1}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border transition-colors hover:text-primary"
          >
            <Icon className="h-5 w-5" />
          </a>
        ))}
      </div>

      {/* Main Instagram trigger. */}
      <button
        type="button"
        onClick={handleMainClick}
        aria-expanded={open}
        aria-label={open ? "Open Instagram" : "Open social menu"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
      >
        <MainIcon className="h-7 w-7" />
      </button>
    </div>
  );
}
