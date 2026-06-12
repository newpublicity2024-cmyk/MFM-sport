import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

type Props = {
  size?: Size;
  priority?: boolean;
  className?: string;
};

const DIMENSIONS: Record<Size, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

export function BrandLogo({ size = "md", priority = false, className }: Props) {
  const dim = DIMENSIONS[size];
  return (
    <Image
      src="/images/mfm-sport-logo.png"
      alt="MFM Sport"
      width={dim}
      height={dim}
      priority={priority}
      // Pin the rendered size in CSS. Without this, `unoptimized` images fall
      // back to the PNG's full intrinsic resolution and render huge.
      style={{ width: dim, height: dim }}
      className={cn("block select-none", className)}
    />
  );
}
