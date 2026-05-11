import { notFound } from "next/navigation";

// Catch-all for any unmatched route under /[locale]/...
// Delegates to the localized not-found.tsx so the 404 renders with the
// site header/footer and the correct locale (instead of Next's framework default).
export default function CatchAllNotFound() {
  notFound();
}
