/**
 * One-time script: load ALL INSTLINES (e.g. 34k) in a single API request.
 * Fetches all from ERP once, then processes and upserts in batches inside the server.
 *
 * Usage (no ID needed – finds INSTLINES integration from DB):
 *   npx tsx scripts/sync-instlines-once.ts
 *
 * Optional: INTEGRATION_ID=<id> or pass id as first arg to use a specific integration.
 *
 * Requires:
 *   - App running (e.g. npm run dev)
 *   - CRON_SECRET in .env
 *   - At least one SoftOne integration for the INSTLINES table in the app
 *
 * Note: The request may take several minutes (e.g. 5–15 min for 34k records).
 * Do not close the terminal until it finishes.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fetch, Agent } from "undici";

const prisma = new PrismaClient();

async function findInstlinesIntegrationId(): Promise<string> {
  const integration = await prisma.softOneIntegration.findFirst({
    where: {
      OR: [
        { tableName: "INSTLINES" },
        { tableDbname: "instlines" },
      ],
    },
    select: { id: true, name: true },
  });
  if (!integration) {
    throw new Error("No INSTLINES integration found. Create one in the app (Integrations) first.");
  }
  return integration.id;
}

async function main() {
  let integrationId = process.env.INTEGRATION_ID ?? process.argv[2];
  if (integrationId === "your-integration-id" || integrationId === "your-id") {
    integrationId = undefined;
  }
  if (!integrationId) {
    console.log("[sync-instlines-once] No integration ID given – looking up INSTLINES integration from DB...");
    try {
      integrationId = await findInstlinesIntegrationId();
      console.log("[sync-instlines-once] Using INSTLINES integration:", integrationId);
    } catch (e) {
      console.error("[sync-instlines-once]", (e as Error).message);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  const baseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const cronSecret = process.env.CRON_SECRET ?? "change-this-secret";

  console.log("[sync-instlines-once] One-time full load of ALL INSTLINES");
  console.log("[sync-instlines-once] Base URL:", baseUrl);
  console.log("[sync-instlines-once] Integration ID:", integrationId);
  const fetchTimeoutMs = 35 * 60 * 1000; // 35 min – server has maxDuration 30 min for 34k records
  console.log("[sync-instlines-once] This may take several minutes (e.g. 15–30 min for 34k records). Please wait...");
  console.log("[sync-instlines-once] Request timeout:", Math.round(fetchTimeoutMs / 60000), "min");
  console.log("");

  const dispatcher = new Agent({
    connect: { timeout: 60000 },
    headersTimeout: fetchTimeoutMs,
    bodyTimeout: fetchTimeoutMs,
  });

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/cron/sync-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cron-Secret": cronSecret,
      },
      body: JSON.stringify({ integrationId, fullSync: true }),
      dispatcher,
    } as RequestInit & { dispatcher?: Agent });
  } catch (err: unknown) {
    const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: { code?: string } }).cause : null;
    const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code: string }).code : "";
    if (code === "ECONNREFUSED") {
      console.error("[sync-instlines-once] Connection refused. Is the app running?");
      console.error("[sync-instlines-once] Start the app in another terminal: npm run dev");
      console.error("[sync-instlines-once] Then run this script again. Tried URL:", baseUrl);
    } else if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
      console.error("[sync-instlines-once] Request timed out. The server may still be processing.");
      console.error("[sync-instlines-once] Check server logs; if sync completed there, you can ignore this.");
    } else {
      console.error("[sync-instlines-once] Fetch failed:", err);
    }
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[sync-instlines-once] API error", res.status, text);
    if (res.status === 401) {
      console.error("[sync-instlines-once] 401 Unauthorized: Check that CRON_SECRET in .env matches the server.");
      console.error("[sync-instlines-once] The script sends X-Cron-Secret from env CRON_SECRET.");
    }
    if (res.status === 404) {
      console.error("[sync-instlines-once] 404: Integration not found. Use the correct INSTLINES integration ID from the app.");
    }
    process.exit(1);
  }

  const data = await res.json();
  if (!data.success) {
    console.error("[sync-instlines-once] API returned success: false", data);
    process.exit(1);
  }

  const stats = data.stats as { created?: number; updated?: number; errors?: number; synced?: number };
  const progress = data.instlinesProgress as
    | { total: number; completedFrom: number; completedTo: number; hasMore: boolean }
    | undefined;

  console.log("[sync-instlines-once] Done.");
  if (stats) {
    const created = stats.created ?? 0;
    const updated = stats.updated ?? 0;
    console.log("[sync-instlines-once] Created:", created);
    console.log("[sync-instlines-once] Updated:", updated);
    console.log("[sync-instlines-once] Errors:", stats.errors ?? 0);
    console.log("[sync-instlines-once] Synced:", stats.synced ?? 0);
    if (created === 0 && updated === 0 && (progress?.total ?? 0) > 0) {
      console.warn("[sync-instlines-once] No records inserted. Sync INST (contracts) first, then run this script again.");
    }
  }
  if (progress) {
    console.log("[sync-instlines-once] Total from ERP:", progress.total);
    console.log("[sync-instlines-once] Processed:", progress.completedFrom, "–", progress.completedTo);
  }
}

main().catch((err) => {
  console.error("[sync-instlines-once] Fatal:", err);
  process.exit(1);
});
