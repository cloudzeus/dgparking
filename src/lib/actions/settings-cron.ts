"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  rescheduleAllIntegrations,
  scheduleIntegration,
  stopIntegration,
} from "@/lib/cron-manager";
import {
  cronFromPreset,
  isValidCronExpression,
  normalizeCronExpression,
  type IntegrationSchedule,
  type SchedulePresetId,
} from "@/lib/cron-schedule";

export type CronActionState = {
  error?: string;
  success?: string;
};

const PRESET_IDS = [
  "every-1-min",
  "every-5-min",
  "every-15-min",
  "every-30-min",
  "hourly",
  "every-6-hours",
  "every-12-hours",
  "daily",
  "weekly",
] as const;

const scheduleSchema = z
  .object({
    integrationId: z.string().min(1),
    type: z.enum(["preset", "custom"]),
    presetSchedule: z.enum(PRESET_IDS).nullable(),
    cronExpression: z.string().trim().nullable(),
    scheduleTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Η ώρα πρέπει να έχει μορφή ΩΩ:ΛΛ.")
      .nullable(),
    scheduleDay: z.string().regex(/^[0-6]$/, "Μη έγκυρη ημέρα.").nullable(),
  })
  .refine((v) => v.type === "custom" || v.presetSchedule !== null, {
    message: "Διάλεξε συχνότητα.",
  })
  .refine((v) => v.type === "preset" || (v.cronExpression !== null && v.cronExpression.length > 0), {
    message: "Συμπλήρωσε έκφραση cron.",
  });

/** Ο χρονοπρογραμματισμός είναι ρύθμιση συστήματος — μόνο διαχειριστές. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Δεν έχεις δικαίωμα σε αυτή την ενέργεια.");
  }
  return session.user;
}

/** Το υπάρχον `configJson` ως αντικείμενο, ώστε να γράφουμε μόνο το `schedule`. */
function asConfigObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

/**
 * Γράφει το νέο πρόγραμμα μέσα στο `configJson.schedule` της ενσωμάτωσης
 * (διαβάζει πρώτα το υπάρχον config και αλλάζει μόνο το `schedule`) και μετά
 * ξαναδηλώνει την εργασία στη μνήμη της διεργασίας.
 */
export async function updateIntegrationSchedule(
  _prev: CronActionState | undefined,
  formData: FormData
): Promise<CronActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Δεν έχεις δικαίωμα." };
  }

  const type = formData.get("type") === "custom" ? "custom" : "preset";
  const parsed = scheduleSchema.safeParse({
    integrationId: formData.get("integrationId"),
    type,
    presetSchedule: type === "preset" ? formData.get("presetSchedule") : null,
    cronExpression: type === "custom" ? formData.get("cronExpression") : null,
    scheduleTime: formData.get("scheduleTime") || null,
    scheduleDay: formData.get("scheduleDay") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Τα στοιχεία του προγράμματος δεν είναι έγκυρα." };
  }

  const data = parsed.data;
  const cronExpression =
    data.type === "custom"
      ? normalizeCronExpression(data.cronExpression ?? "")
      : cronFromPreset(
          data.presetSchedule as SchedulePresetId,
          data.scheduleTime,
          data.scheduleDay
        );

  if (!isValidCronExpression(cronExpression)) {
    return { error: `Η έκφραση cron «${cronExpression}» δεν είναι έγκυρη (5 πεδία: λεπτό ώρα ημέρα μήνας ημέρα-εβδομάδας).` };
  }

  const integration = await prisma.softOneIntegration.findUnique({
    where: { id: data.integrationId },
    select: { id: true, configJson: true },
  });

  if (!integration) {
    return { error: "Η ενσωμάτωση δεν βρέθηκε." };
  }

  const config = asConfigObject(integration.configJson);
  const schedule: IntegrationSchedule = {
    type: data.type,
    presetSchedule: data.type === "preset" ? data.presetSchedule : null,
    cronExpression,
    scheduleDay: data.type === "preset" && data.presetSchedule === "weekly" ? data.scheduleDay : null,
    scheduleTime:
      data.type === "preset" && (data.presetSchedule === "weekly" || data.presetSchedule === "daily")
        ? data.scheduleTime
        : null,
  };
  config.schedule = schedule;

  await prisma.softOneIntegration.update({
    where: { id: data.integrationId },
    data: { configJson: config as object },
  });

  // Η εργασία στη μνήμη πρέπει να ακολουθήσει αμέσως τη νέα έκφραση.
  await scheduleIntegration(data.integrationId);

  revalidatePath("/settings");
  revalidatePath("/integrations");
  return { success: "Το πρόγραμμα αποθηκεύτηκε και η εργασία επαναπρογραμματίστηκε." };
}

/** Ενεργοποίηση/απενεργοποίηση μιας ενσωμάτωσης μαζί με την εργασία της. */
export async function setIntegrationActive(
  integrationId: string,
  isActive: boolean
): Promise<CronActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Δεν έχεις δικαίωμα." };
  }

  const integration = await prisma.softOneIntegration.findUnique({
    where: { id: integrationId },
    select: { id: true },
  });
  if (!integration) return { error: "Η ενσωμάτωση δεν βρέθηκε." };

  await prisma.softOneIntegration.update({
    where: { id: integrationId },
    data: { isActive },
  });

  if (isActive) {
    await scheduleIntegration(integrationId);
  } else {
    stopIntegration(integrationId);
  }

  revalidatePath("/settings");
  revalidatePath("/integrations");
  return {
    success: isActive ? "Η ενσωμάτωση ενεργοποιήθηκε." : "Η ενσωμάτωση απενεργοποιήθηκε.",
  };
}

/** Εκτέλεση συγχρονισμού τώρα — καλεί την ίδια διαδρομή που καλεί και το cron. */
export async function runIntegrationNow(integrationId: string): Promise<CronActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Δεν έχεις δικαίωμα." };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/cron/sync-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cron-Secret": process.env.CRON_SECRET || "change-this-secret",
      },
      body: JSON.stringify({ integrationId }),
      cache: "no-store",
    });

    const text = await response.text();
    let payload: { success?: boolean; error?: string } = {};
    try {
      payload = JSON.parse(text) as { success?: boolean; error?: string };
    } catch {
      return { error: `Ο συγχρονισμός απάντησε με μη αναγνωρίσιμο περιεχόμενο (HTTP ${response.status}).` };
    }

    if (!response.ok || payload.success === false) {
      return { error: payload.error ?? `Ο συγχρονισμός απέτυχε (HTTP ${response.status}).` };
    }

    revalidatePath("/settings");
    return { success: "Ο συγχρονισμός ολοκληρώθηκε." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Ο συγχρονισμός δεν μπόρεσε να ξεκινήσει.",
    };
  }
}

/** Σταματά και ξαναδηλώνει όλες τις εργασίες στη μνήμη της διεργασίας. */
export async function restartAllCronJobs(): Promise<CronActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Δεν έχεις δικαίωμα." };
  }

  try {
    await rescheduleAllIntegrations();
    revalidatePath("/settings");
    return { success: "Όλες οι εργασίες επαναπρογραμματίστηκαν." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Η επανεκκίνηση των εργασιών απέτυχε.",
    };
  }
}
