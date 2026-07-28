import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret");

  if (!process.env.REVALIDATION_SECRET || secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { collection, slug, locale } = body;
    const locales = locale ? [locale] : ["ar", "fr", "en"];

    for (const loc of locales) {
      switch (collection) {
        case "articles":
          revalidatePath(`/${loc}/articles/${slug}`);
          revalidatePath(`/${loc}/articles`);
          revalidatePath(`/${loc}`);
          break;
        case "categories":
          revalidatePath(`/${loc}/category/${slug}`);
          break;
        case "tags":
          revalidatePath(`/${loc}/tag/${slug}`);
          break;
        case "authors":
          revalidatePath(`/${loc}/author/${slug}`);
          break;
        case "competitions":
          revalidatePath(`/${loc}/competition/${slug}`);
          break;
        case "clubs":
          revalidatePath(`/${loc}/club/${slug}`);
          break;
        case "pages":
          revalidatePath(`/${loc}/${slug}`);
          break;
        default:
          revalidatePath(`/${loc}`);
      }
    }

    // The sitemap caches for a day (see app/sitemap.ts). Any change to the set
    // of indexable articles therefore takes up to 24h to be advertised unless it
    // is busted explicitly — which matters most after a bulk import, where
    // thousands of URLs are otherwise invisible to crawlers for a day. Cheap to
    // do here: the sitemap is one cached render, not a per-article cost.
    if (collection === "articles" || collection === "sitemap") {
      revalidatePath("/sitemap.xml");
      revalidatePath("/news-sitemap.xml");
    }

    return NextResponse.json({ revalidated: true, collection, slug });
  } catch (error) {
    console.error("[Revalidate] Error:", error);
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
