import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewsletterConfirmPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages: Record<string, { title: string; message: string }> = {
    ar: {
      title: "تم تأكيد اشتراكك!",
      message: "شكرا لك! ستتلقى آخر أخبار كرة القدم المغربية مباشرة في بريدك الإلكتروني.",
    },
    fr: {
      title: "Inscription confirmee !",
      message: "Merci ! Vous recevrez les dernieres actualites du football marocain directement dans votre boite mail.",
    },
    en: {
      title: "Subscription confirmed!",
      message: "Thank you! You'll receive the latest Moroccan football news directly in your inbox.",
    },
  };

  const { title, message } = messages[locale] || messages.en;

  return (
    <div className="container py-16 text-center max-w-lg">
      <div className="text-4xl mb-4">✓</div>
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
