import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; n: string }>;
};

// The videos page no longer paginates — it shows the two YouTube playlists as a
// single archive. Any old /videos/page/N link redirects to the videos page.
export default async function VideosPageN({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/videos`);
}
