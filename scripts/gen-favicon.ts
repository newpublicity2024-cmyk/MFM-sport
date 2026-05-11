/**
 * Regenerate favicons from public/images/favicon-source.svg.
 *
 * Usage:
 *   pnpm tsx scripts/gen-favicon.ts
 *
 * Writes:
 *   src/app/icon.png (32x32)
 *   src/app/apple-icon.png (180x180)
 *
 * Re-run any time the source SVG changes. Not part of the build — the PNG
 * outputs are committed so production builds don't need sharp at build time
 * for this purpose.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = readFileSync(resolve(root, "public/images/favicon-source.svg"));

async function main() {
  await sharp(src).resize(32, 32).png().toFile(resolve(root, "src/app/icon.png"));
  console.log("✓ src/app/icon.png (32x32)");

  await sharp(src).resize(180, 180).png().toFile(resolve(root, "src/app/apple-icon.png"));
  console.log("✓ src/app/apple-icon.png (180x180)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
