"use server";

import { cookies } from "next/headers";

/**
 * Server Action: Sync INSTLINES (plates) from ERP for the given contracts.
 * Runs the sync API server-side with the user's session so auth works.
 * The API uses parallel GetTable calls (25 at a time) for much faster sync.
 */
export async function syncPlatesAction(integrationId: string, instIds: number[]) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  const res = await fetch(`${base}/api/cron/sync-integration`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ integrationId, instIds }),
  });

  const data = await res.json();
  return data;
}
