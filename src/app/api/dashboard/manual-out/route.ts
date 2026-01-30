import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dashboard/manual-out
 * Record a manual "vehicle left" (OUT) event. Used when staff marks a car as left with a specific time.
 * Body: { licensePlate: string, recognitionTime: string (ISO date-time) }
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const licensePlate = typeof body.licensePlate === "string" ? body.licensePlate.trim() : "";
    const recognitionTimeRaw = body.recognitionTime;

    if (!licensePlate || licensePlate.length < 2) {
      return NextResponse.json(
        { success: false, error: "Valid licensePlate required" },
        { status: 400 }
      );
    }

    const recognitionTime = recognitionTimeRaw ? new Date(recognitionTimeRaw) : new Date();
    if (isNaN(recognitionTime.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid recognitionTime" },
        { status: 400 }
      );
    }

    const plate = licensePlate.toUpperCase();

    const created = await prisma.lprRecognitionEvent.create({
      data: {
        licensePlate: plate,
        recognitionTime,
        direction: "OUT",
        plateType: null,
        vehicleColor: null,
        vehicleBrand: null,
        vehicleType: null,
        plateColor: null,
      },
      include: {
        camera: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      event: {
        ...created,
        images: [],
      },
    });
  } catch (error) {
    console.error("[DASHBOARD] manual-out error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record manual OUT" },
      { status: 500 }
    );
  }
}
