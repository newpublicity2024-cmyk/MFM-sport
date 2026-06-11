/**
 * MFM Sport — Ads Seed
 *
 * Usage:
 *   pnpm seed:ads
 *
 * Migrates the four existing static homepage banners (public/images/*.jpeg)
 * into the admin-managed `ads` collection so the live site looks identical
 * after the switchover, and the team can then add more ads per slot to make
 * each placeholder a rotating slider.
 *
 * Idempotent: skips an ad whose `name` already exists.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPayload } from "payload";
import config from "../src/payload.config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicImages = path.resolve(dirname, "../public/images");

// Maps the current static banners to their placements (see homepage history).
const SEED = [
  { name: "OCP — SIAM (seed)", file: "ocp-banner.jpeg", placement: "top-banner", alt: "OCP — SIAM" },
  { name: "MSC (seed)", file: "cargo-banner.jpeg", placement: "hero-news", alt: "MSC" },
  { name: "OMODA C5 (seed)", file: "car1-banner.jpeg", placement: "news-videos", alt: "OMODA C5" },
  { name: "JETOUR (seed)", file: "car2-banner.jpeg", placement: "videos-matches", alt: "JETOUR" },
] as const;

async function main() {
  const payload = await getPayload({ config });

  for (const item of SEED) {
    const existing = await payload.find({
      collection: "ads",
      where: { name: { equals: item.name } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      console.log(`skip (exists): ${item.name}`);
      continue;
    }

    const buf = fs.readFileSync(path.join(publicImages, item.file));
    const media = await payload.create({
      collection: "media",
      data: { alt: item.alt },
      file: {
        data: buf,
        mimetype: "image/jpeg",
        name: item.file,
        size: buf.byteLength,
      },
    });

    await payload.create({
      collection: "ads",
      data: {
        name: item.name,
        type: "image",
        image: media.id,
        placement: item.placement,
        active: true,
        order: 0,
      },
    });
    console.log(`created ad: ${item.name} (${item.placement})`);
  }

  console.log("seed-ads done");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
