import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DAYS = [
  { dayOfWeek: 0, label: "Sunday" },
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
];

/** GET: return working hours for all weekdays (create defaults if missing). */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rows = await prisma.parkingWorkingHours.findMany({
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

    const workingHours = DAYS.map((d) => {
      const row = rows.find((r) => r.dayOfWeek === d.dayOfWeek);
      return {
        dayOfWeek: d.dayOfWeek,
        label: d.label,
        openTime: row?.openTime ?? "08:00",
        closeTime: row?.closeTime ?? "22:00",
        isClosed: row?.isClosed ?? (d.dayOfWeek === 0),
      };
    });

    return NextResponse.json({ success: true, workingHours });
  } catch (error) {
    console.error("[SETTINGS] GET working-hours error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load working hours" },
      { status: 500 }
    );
  }
}

/** PUT: update working hours. Body: { workingHours: { dayOfWeek, openTime?, closeTime?, isClosed }[] } */
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const workingHours = body?.workingHours;
    if (!Array.isArray(workingHours) || workingHours.length === 0) {
      return NextResponse.json(
        { success: false, error: "workingHours array required" },
        { status: 400 }
      );
    }

    for (const row of workingHours) {
      const dayOfWeek = Number(row.dayOfWeek);
      if (dayOfWeek < 0 || dayOfWeek > 6) continue;
      const openTime =
        row.isClosed === true ? null : (row.openTime ?? "08:00");
      const closeTime =
        row.isClosed === true ? null : (row.closeTime ?? "22:00");
      await prisma.parkingWorkingHours.upsert({
        where: { dayOfWeek },
        create: {
          dayOfWeek,
          openTime,
          closeTime,
          isClosed: Boolean(row.isClosed),
        },
        update: {
          openTime,
          closeTime,
          isClosed: Boolean(row.isClosed),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS] PUT working-hours error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save working hours" },
      { status: 500 }
    );
  }
}
