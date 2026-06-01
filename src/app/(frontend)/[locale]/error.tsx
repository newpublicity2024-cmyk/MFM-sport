"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
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
    <div className="container mx-auto flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">حدث خطأ ما</h1>
      <p className="text-muted-foreground">Something went wrong loading this page.</p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md border px-4 py-2 hover:bg-muted"
        >
          إعادة المحاولة
        </button>
        <Link href="/" className="rounded-md border px-4 py-2 hover:bg-muted">
          الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
