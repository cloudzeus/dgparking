import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";
import type { WorkingHoursRow } from "@/components/settings/settings-client";

const DAYS = [
  { dayOfWeek: 0, label: "Sunday" },
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
];

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  let rows: { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[] = [];

  try {
    rows = await prisma.parkingWorkingHours.findMany({
      orderBy: { dayOfWeek: "asc" },
    });

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

  const workingHours: WorkingHoursRow[] = DAYS.map((d) => {
    const row = rows.find((r) => r.dayOfWeek === d.dayOfWeek);
    return {
      dayOfWeek: d.dayOfWeek,
      label: d.label,
      openTime: row?.openTime ?? "08:00",
      closeTime: row?.closeTime ?? "22:00",
      isClosed: row?.isClosed ?? (d.dayOfWeek === 0),
    };
  });

  return <SettingsClient initialWorkingHours={workingHours} />;
}
