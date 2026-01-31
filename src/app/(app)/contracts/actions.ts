"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Agent, fetch as undiciFetch } from "undici";

export type SyncPlatesResult = {
  success?: boolean;
  error?: string;
  warning?: string;
  stats?: {
    erpToApp?: { created?: number; updated?: number };
    created?: number;
    updated?: number;
  };
};

/**
 * Server Action: Sync INSTLINES (plates) from ERP.
 * - syncAllPlates: true → fetch ALL INSTLINES from ERP, then filter by INST in date range (WDATEFROM 2m past, WDATETO 1m future), delete those in DB and bulk insert (massive update).
 * - syncAllPlates: false → sync only INSTLINES for the given instIds (e.g. current page contracts or single contract).
 */
export async function syncPlatesAction(integrationId: string, instIds: number[], syncAllPlates = false): Promise<SyncPlatesResult> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  const body = syncAllPlates
    ? { integrationId, syncAllPlates: true }
    : { integrationId, instIds };

  // Sync can take 30+ min (maxDuration 1800). Global fetch uses undici's default ~300s headers timeout.
  // Use undici fetch with a custom Agent so we don't get HeadersTimeoutError before the server responds.
  const SYNC_TIMEOUT_MS = 32 * 60 * 1000;
  const agent = new Agent({
    connectTimeout: 60_000,
    headersTimeout: SYNC_TIMEOUT_MS,
    bodyTimeout: SYNC_TIMEOUT_MS,
  });

  try {
    const res = await undiciFetch(`${base}/api/cron/sync-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(body),
      dispatcher: agent,
    });
    const data = (await res.json()) as SyncPlatesResult;
    if (data.success) {
      revalidatePath("/contracts");
    }
    return data;
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    const causeCode =
      cause && typeof cause === "object" && "code" in cause ? (cause as { code: string }).code : undefined;
    if (
      err instanceof Error &&
      (err.name === "AbortError" || causeCode === "UND_ERR_HEADERS_TIMEOUT")
    ) {
      return {
        success: false,
        error: "Sync timed out. The sync may still be running on the server. Refresh the page in a few minutes to see updated plates.",
      };
    }
    throw err;
  }
}
