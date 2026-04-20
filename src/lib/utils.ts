import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(
    locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
}

export function formatTime(date: string, locale: string): string {
  return new Date(date).toLocaleTimeString(
    locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

export function getImageUrl(
  image: any,
  size: "thumbnail" | "card" | "hero" = "card",
): string | null {
  if (!image || typeof image === "string") return null;
  return image.sizes?.[size]?.url || image.url || null;
}

export function getImageAlt(image: any): string {
  if (!image || typeof image === "string") return "";
  return image.alt || "";
}
