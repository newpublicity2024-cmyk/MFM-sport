import { cn } from "@/lib/utils";

/**
 * Reserved space while a block streams in. The height is fixed per block so
 * the page does not shift when the real content lands (CLS is 0 today and
 * should stay there).
 */
export function BlockSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("mb-8 rounded-lg border border-border bg-card animate-pulse", className)}
    />
  );
}
