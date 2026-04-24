"use client";

import type { MouseEvent, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function ClickStopper({ children, className }: Props) {
  const handle = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };
  return (
    <div className={className} onClick={handle}>
      {children}
    </div>
  );
}
