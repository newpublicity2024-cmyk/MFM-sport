"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>حدث خطأ ما</h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Something went wrong. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{ padding: "0.6rem 1.4rem", borderRadius: "8px", border: "1px solid #ccc", cursor: "pointer" }}
        >
          إعادة المحاولة / Retry
        </button>
      </body>
    </html>
  );
}
