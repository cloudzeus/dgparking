/**
 * Sync all INSTLINES from ERP in batches of 500.
 *
 * Usage:
 *   INTEGRATION_ID=your-integration-id npx tsx scripts/sync-instlines.ts
 *   npx tsx scripts/sync-instlines.ts <integration-id>
 *
 * Requires:
 *   - App running (e.g. npm run dev) or set APP_URL to your deployed URL
 *   - CRON_SECRET in .env (same as used by cron) for API auth
 *   - INTEGRATION_ID or first argument = SoftOne integration id for the INSTLINES table
 *
 * Example: INTEGRATION_ID=clxxx... npx tsx scripts/sync-instlines.ts
 */

const BATCH_SIZE = 500;

async function main() {
  const integrationId =
    process.env.INTEGRATION_ID ?? process.argv[2];
  if (!integrationId) {
    console.error("Usage: INTEGRATION_ID=<id> npx tsx scripts/sync-instlines.ts");
    console.error("   or: npx tsx scripts/sync-instlines.ts <integration-id>");
    process.exit(1);
  }

  const baseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET ?? "change-this-secret";

  console.log(`[sync-instlines] Base URL: ${baseUrl}`);
  console.log(`[sync-instlines] Integration ID: ${integrationId}`);
  console.log(`[sync-instlines] Batch size: ${BATCH_SIZE}`);
  console.log("");

  let offset = 0;
  let batchNumber = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  while (true) {
    batchNumber++;
    const body = { integrationId, limit: BATCH_SIZE, offset };
    console.log(`[sync-instlines] Batch ${batchNumber}: requesting offset=${offset}, limit=${BATCH_SIZE}...`);

    const res = await fetch(`${baseUrl}/api/cron/sync-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cron-Secret": cronSecret,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[sync-instlines] API error ${res.status}: ${text}`);
      process.exit(1);
    }

    const data = await res.json();
    if (!data.success) {
      console.error("[sync-instlines] API returned success: false", data);
      process.exit(1);
    }

    const stats = data.stats as { created?: number; updated?: number; errors?: number } | undefined;
    if (stats) {
      totalCreated += stats.created ?? 0;
      totalUpdated += stats.updated ?? 0;
      totalErrors += stats.errors ?? 0;
    }

    const progress = data.instlinesProgress as
      | { total: number; completedFrom: number; completedTo: number; nextOffset: number; hasMore: boolean }
      | undefined;

    if (!progress) {
      console.log("[sync-instlines] Response has no instlinesProgress (not INSTLINES sync?). Done.");
      break;
    }

    console.log(
      `[sync-instlines] Batch ${batchNumber}: ${progress.completedFrom}–${progress.completedTo} of ${progress.total} | hasMore: ${progress.hasMore}`
    );

    if (!progress.hasMore) {
      console.log("");
      console.log("[sync-instlines] Sync complete.");
      console.log(`[sync-instlines] Total: ${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors`);
      break;
    }

    offset = progress.nextOffset;
    if (offset >= progress.total) {
      console.log("[sync-instlines] Reached end (nextOffset >= total). Done.");
      break;
    }
  }
}

main().catch((err) => {
  console.error("[sync-instlines] Fatal:", err);
  process.exit(1);
});
