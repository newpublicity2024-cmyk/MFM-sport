import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-semibold text-primary">MFM Sport</h1>
        <p className="text-muted-foreground">
          {locale === "ar"
            ? "قريبا..."
            : locale === "fr"
              ? "Bientot..."
              : "Coming soon..."}
        </p>
      </div>
    </main>
  );
}
