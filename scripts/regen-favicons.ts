import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const SOURCE = path.join(repoRoot, "public/images/mfm-sport-logo.png");
const FAVICON_OUT = path.join(repoRoot, "src/app/icon.png");
const APPLE_OUT = path.join(repoRoot, "src/app/apple-icon.png");

async function main() {
  await sharp(SOURCE)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(FAVICON_OUT);
  console.log(`wrote ${FAVICON_OUT} (32x32)`);

  await sharp(SOURCE)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(APPLE_OUT);
  console.log(`wrote ${APPLE_OUT} (180x180)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
