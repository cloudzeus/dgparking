/**
 * Persist and restore cron job progress so we can resume after app restart.
 * All cron jobs should save where they stopped (offset, state) and load it on start.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const NORMALIZE = (s: string | null | undefined) => s ?? "";

export type CronProgressPayload = {
  lastOffset?: number;
  totalSeen?: number;
  completedIds?: number[];
  [key: string]: unknown;
};

/** Prisma client may not have cronJobProgress if generated before the model existed. */
function getCronProgressDelegate(): Pick<typeof prisma, "cronJobProgress">["cronJobProgress"] | null {
  const delegate = (prisma as { cronJobProgress?: unknown }).cronJobProgress;
  return delegate && typeof (delegate as { findUnique?: unknown }).findUnique === "function" ? (delegate as Pick<typeof prisma, "cronJobProgress">["cronJobProgress"]) : null;
}

/**
 * Load saved progress for a cron job. Returns null if none.
 * Uses empty string for optional integrationId/modelName so composite unique works.
 */
export async function getCronProgress(
  jobType: string,
  integrationId: string | null,
  modelName?: string | null
): Promise<{ lastOffset: number; totalSeen: number | null; payload: CronProgressPayload | null } | null> {
  const delegate = getCronProgressDelegate();
  if (!delegate) return null;
  const id = integrationId ?? "";
  const model = modelName ?? "";
  const row = await delegate.findUnique({
    where: {
      jobType_integrationId_modelName: {
        jobType,
        integrationId: id,
        modelName: model,
      },
    },
  });
  if (!row) return null;
  return {
    lastOffset: row.lastOffset,
    totalSeen: row.totalSeen,
    payload: (row.payload as CronProgressPayload) ?? null,
  };
}

/**
 * Save progress so we can resume after restart.
 * Call after each batch or at end of run.
 */
export async function saveCronProgress(
  jobType: string,
  integrationId: string | null,
  modelName: string | null | undefined,
  data: { lastOffset: number; totalSeen?: number | null; payload?: CronProgressPayload }
): Promise<void> {
  const delegate = getCronProgressDelegate();
  if (!delegate) return;
  const id = integrationId ?? "";
  const model = modelName ?? "";
  await delegate.upsert({
    where: {
      jobType_integrationId_modelName: {
        jobType,
        integrationId: id,
        modelName: model,
      },
    },
    create: {
      jobType,
      integrationId: id,
      modelName: model,
      lastOffset: data.lastOffset,
      totalSeen: data.totalSeen ?? undefined,
      payload: (data.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      lastOffset: data.lastOffset,
      totalSeen: data.totalSeen ?? undefined,
      payload: (data.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/**
 * Clear progress when a run completes fully (optional).
 */
export async function clearCronProgress(
  jobType: string,
  integrationId: string | null,
  modelName?: string | null
): Promise<void> {
  const delegate = getCronProgressDelegate();
  if (!delegate) return;
  const id = integrationId ?? "";
  const model = modelName ?? "";
  await delegate.deleteMany({
    where: {
      jobType,
      integrationId: id,
      modelName: model,
    },
  });
}
