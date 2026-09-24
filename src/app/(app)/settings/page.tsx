import { redirect } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import type { WorkingHoursRow } from "@/components/settings/settings-client";
import type { MailgunSettingsData } from "@/components/settings/mailgun-settings-client";
import type {
  CronIntegrationRow,
  CronRuntimeStatus,
} from "@/components/settings/cron-settings-client";
import { getCronJobStatus } from "@/lib/cron-manager";
import {
  describeSchedule,
  evaluateSyncHealth,
  formatAgo,
  type IntegrationSchedule,
} from "@/lib/cron-schedule";

export const dynamic = "force-dynamic";

const DAYS = [
  { dayOfWeek: 0, label: "Κυριακή" },
  { dayOfWeek: 1, label: "Δευτέρα" },
  { dayOfWeek: 2, label: "Τρίτη" },
  { dayOfWeek: 3, label: "Τετάρτη" },
  { dayOfWeek: 4, label: "Πέμπτη" },
  { dayOfWeek: 5, label: "Παρασκευή" },
  { dayOfWeek: 6, label: "Σάββατο" },
];

/** Διαβάζει το `configJson.schedule` χωρίς να εμπιστεύεται το σχήμα του JSON. */
function readSchedule(configJson: unknown): IntegrationSchedule | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) return null;
  const schedule = (configJson as Record<string, unknown>).schedule;
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return null;

  const value = schedule as Record<string, unknown>;
  const str = (key: string): string | null =>
    typeof value[key] === "string" && value[key] !== "" ? (value[key] as string) : null;

  return {
    type: str("type"),
    presetSchedule: str("presetSchedule"),
    cronExpression: str("cronExpression"),
    scheduleDay: str("scheduleDay"),
    scheduleTime: str("scheduleTime"),
  };
}

async function loadWorkingHours(): Promise<WorkingHoursRow[]> {
  let rows: { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[] = [];

  try {
    rows = await prisma.parkingWorkingHours.findMany({ orderBy: { dayOfWeek: "asc" } });

    if (rows.length < 7) {
      const existingDays = new Set(rows.map((r) => r.dayOfWeek));
      for (const { dayOfWeek } of DAYS) {
        if (!existingDays.has(dayOfWeek)) {
          const created = await prisma.parkingWorkingHours.create({
            data: {
              dayOfWeek,
              openTime: "08:00",
              closeTime: "22:00",
              isClosed: dayOfWeek === 0,
            },
          });
          rows = [...rows, created].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
        }
      }
    }
  } catch (error) {
    console.error("[SETTINGS] Error loading working hours (table may not exist — run `npx prisma db push`):", error);
    rows = [];
  }

  return DAYS.map((d) => {
    const row = rows.find((r) => r.dayOfWeek === d.dayOfWeek);
    return {
      dayOfWeek: d.dayOfWeek,
      label: d.label,
      openTime: row?.openTime ?? "08:00",
      closeTime: row?.closeTime ?? "22:00",
      isClosed: row?.isClosed ?? d.dayOfWeek === 0,
    };
  });
}

async function loadMailgun(): Promise<MailgunSettingsData | null> {
  const settings = await prisma.mailgunSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) return null;

  return {
    domain: settings.domain,
    region: settings.region === "us" ? "us" : "eu",
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    recipientEmail: settings.recipientEmail,
    isActive: settings.isActive,
    // Το κλειδί δεν φεύγει ποτέ από τον server — στέλνουμε μόνο αν υπάρχει.
    hasApiKey: true,
    lastTestAt: settings.lastTestAt?.toISOString() ?? null,
    lastTestOk: settings.lastTestOk,
    lastTestError: settings.lastTestError,
  };
}

async function loadCronRows(registeredIds: Set<string>): Promise<CronIntegrationRow[]> {
  const integrations = await prisma.softOneIntegration.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      objectName: true,
      tableName: true,
      tableCaption: true,
      isActive: true,
      lastSyncAt: true,
      configJson: true,
      cronJobLogs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          duration: true,
          error: true,
        },
      },
    },
  });

  const now = new Date();

  return integrations.map((integration) => {
    const schedule = readSchedule(integration.configJson);
    const lastRun = integration.cronJobLogs[0] ?? null;

    return {
      id: integration.id,
      name: integration.name,
      objectName: integration.objectName,
      tableName: integration.tableName,
      tableCaption: integration.tableCaption,
      isActive: integration.isActive,
      lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
      lastSyncAgo: formatAgo(integration.lastSyncAt, now),
      cronExpression: schedule?.cronExpression ?? null,
      scheduleLabel: describeSchedule(schedule),
      presetSchedule: schedule?.presetSchedule ?? null,
      scheduleTime: schedule?.scheduleTime ?? null,
      scheduleDay: schedule?.scheduleDay ?? null,
      scheduleType: schedule?.presetSchedule ? "preset" : "custom",
      health: evaluateSyncHealth({
        isActive: integration.isActive,
        lastSyncAt: integration.lastSyncAt,
        schedule,
        now,
      }),
      isRegistered: registeredIds.has(integration.id),
      lastRun: lastRun
        ? {
            status: lastRun.status,
            startedAt: lastRun.startedAt.toISOString(),
            completedAt: lastRun.completedAt?.toISOString() ?? null,
            durationMs: lastRun.duration ?? null,
            error: lastRun.error,
          }
        : null,
    };
  });
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const isAdmin = session.user.role === "ADMIN";

  const workingHours = await loadWorkingHours();

  // Οι καρτέλες Email και cron είναι μόνο για διαχειριστές — ο υπεύθυνος βλέπει
  // μόνο το ωράριο, χωρίς να φορτώνονται καν τα δεδομένα τους.
  let mailgun: MailgunSettingsData | null = null;
  let cronIntegrations: CronIntegrationRow[] = [];
  let cronRuntime: CronRuntimeStatus = { totalJobs: 0, jobIds: [], isInitialized: false };

  if (isAdmin) {
    const status = getCronJobStatus();
    cronRuntime = {
      totalJobs: status.totalJobs,
      jobIds: status.jobIds,
      isInitialized: status.isInitialized,
    };

    try {
      mailgun = await loadMailgun();
    } catch (error) {
      console.error("[SETTINGS] Error loading Mailgun settings:", error);
    }

    try {
      cronIntegrations = await loadCronRows(new Set(status.jobIds));
    } catch (error) {
      console.error("[SETTINGS] Error loading integrations for cron tab:", error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ρυθμίσεις"
        description="Ωράριο λειτουργίας, αποστολή email και χρονοπρογραμματισμός των συγχρονισμών."
        icon={SettingsIcon}
      />
      <SettingsTabs
        workingHours={workingHours}
        isAdmin={isAdmin}
        mailgun={mailgun}
        cronIntegrations={cronIntegrations}
        cronRuntime={cronRuntime}
      />
    </div>
  );
}
