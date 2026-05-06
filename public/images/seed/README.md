# Seed Images

Bundled royalty-free photos used by `scripts/seed-preview.ts` to give
the 18 demo articles a featured image during the boss-preview phase.

**Source:** [Lorem Picsum](https://picsum.photos/) — random high-quality photos served
from Unsplash contributors (https://unsplash.com/license — free, attribution appreciated).
Seeds used: `football1`–`football6`, `soccer1`–`soccer3`, `sports1`–`sports3`.

> **Note:** Picsum images are generic landscape photos, not football-specific.
> They were used as a fallback because direct HTTPS connections to Pexels
> timed out in this environment (SSL/TLS issue). The images provide a
> professional-looking placeholder layout without any misleading sports branding.

**Replacement:** These are removed once the WordPress migration runs and real
article imagery lands in Vercel Blob via Payload's `featuredImage` upload field.
