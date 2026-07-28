import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function UnsubscribePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages: Record<string, { title: string; message: string }> = {
    ar: {
      title: "تم إلغاء اشتراكك",
      message: "تم إلغاء اشتراكك بنجاح. لن تتلقى المزيد من رسائل البريد الإلكتروني.",
    },
    fr: {
      title: "Desinscription effectuee",
      message: "Vous avez ete desinscrit avec succes. Vous ne recevrez plus d'emails.",
    },
    en: {
      title: "Unsubscribed",
      message: "You have been successfully unsubscribed. You will no longer receive emails.",
    },
  };

  const { title, message } = messages[locale] || messages.en;

  return (
    <div className="container py-16 text-center max-w-lg">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
