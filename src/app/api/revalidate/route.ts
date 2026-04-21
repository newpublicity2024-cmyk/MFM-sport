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

    return NextResponse.json({ revalidated: true, collection, slug });
  } catch (error) {
    console.error("[Revalidate] Error:", error);
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
