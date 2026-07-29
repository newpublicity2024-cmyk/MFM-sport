/**
 * ONE-TIME SETUP for Task 8 §A2: ensures a throwaway admin login exists so a browser
 * session can authenticate against /admin and drive the fixed-toolbar / block-insertion
 * verification. Idempotent — safe to re-run; does nothing if the user already exists.
 *
 * This is fixture setup, not evidence. The actual proof of Task 8 §A2 is produced by
 * driving a real browser (see scripts/verify-toolbar-admin-ux.ts) against whatever admin
 * account this script ensures exists.
 *
 * SAFETY: same guard pattern as scripts/probe-block-hook.ts. Reads DATABASE_URL from the
 * environment; never edits .env. Run with an explicit throwaway override:
 *
 *   DATABASE_URL="<throwaway-branch-connection-string>" pnpm tsx scripts/seed-admin-toolbar-probe.ts
 *
 * Credentials are fixed and printed to stdout — this is a throwaway Neon branch, not
 * production, so there is no secret to protect here. Not a real person's login.
 */

// Must precede the @payload-config import — see normalize-redirects.ts.
import "dotenv/config";

// Same production endpoint id scripts/probe-block-hook.ts guards against. Project
// broad-snow-50246164, branch br-royal-wildflower-a21skzaw ("production").
const PRODUCTION_ENDPOINT_ID = "ep-rough-moon-a2j3hgj8";

function assertNotProduction(rawDatabaseUrl: string | undefined): void {
  if (!rawDatabaseUrl) {
    console.error("DATABASE_URL is not set. Refusing to run without an explicit connection string.");
    process.exit(1);
  }

  let displayHost = "(could not parse DATABASE_URL as a URL)";
  try {
    displayHost = new URL(rawDatabaseUrl).host;
  } catch {
    // Parsing is only for the printout below; see probe-block-hook.ts.
  }
  console.log(`This script is about to write to: ${displayHost}`);

  if (rawDatabaseUrl.includes(PRODUCTION_ENDPOINT_ID)) {
    console.error(
      `\nREFUSING TO RUN: DATABASE_URL resolves to production (endpoint id ` +
        `${PRODUCTION_ENDPOINT_ID}, branch br-royal-wildflower-a21skzaw). This script ` +
        `calls payload.create() and must only ever run against a throwaway Neon branch.\n\n` +
        `Pass an explicit override:\n` +
        `  DATABASE_URL="<throwaway-branch-connection-string>" pnpm tsx scripts/seed-admin-toolbar-probe.ts\n`,
    );
    process.exit(1);
  }
}

assertNotProduction(process.env.DATABASE_URL);

export const TOOLBAR_PROBE_EMAIL = "task8-toolbar-probe@example.invalid";
export const TOOLBAR_PROBE_PASSWORD = "Task8-Toolbar-Probe-2026!";

async function main() {
  // Dynamic imports, exactly as in probe-block-hook.ts: nothing Payload- or DB-related
  // loads until after the guard above has already run and passed.
  const { getPayload } = await import("payload");
  const { default: config } = await import("@payload-config");

  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: "users",
    where: { email: { equals: TOOLBAR_PROBE_EMAIL } },
    limit: 1,
  });

  if (existing.docs.length > 0) {
    console.log(`Already exists: user id ${existing.docs[0].id} (${TOOLBAR_PROBE_EMAIL})`);
    process.exit(0);
  }

  const created = await payload.create({
    collection: "users",
    data: {
      email: TOOLBAR_PROBE_EMAIL,
      password: TOOLBAR_PROBE_PASSWORD,
      name: "Task 8 Toolbar Probe",
      role: "admin",
    },
  });

  console.log(`Created user id ${created.id} (${TOOLBAR_PROBE_EMAIL})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
