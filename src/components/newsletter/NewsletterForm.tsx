"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  locale: string;
};

export function NewsletterForm({ locale }: Props) {
  const t = useTranslations("newsletter");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-sm text-win font-medium">{t("success")}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
      <Input
        type="email"
        name="email"
        required
        placeholder={t("placeholder")}
        className="bg-background/50"
        disabled={status === "loading"}
      />
      <Button
        type="submit"
        disabled={status === "loading"}
        className="shrink-0"
      >
        {status === "loading" ? "..." : t("subscribe")}
      </Button>
    </form>
  );
}
