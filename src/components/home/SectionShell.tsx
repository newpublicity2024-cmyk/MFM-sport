import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  variant?: "light" | "navy";
  className?: string;
};

export function SectionShell({ children, variant = "light", className }: Props) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-3 sm:p-4 lg:p-5",
        variant === "navy"
          ? "border-white/10 bg-navy text-navy-foreground"
          : "border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}
