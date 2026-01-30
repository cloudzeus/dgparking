import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/dashboard/recognition-event/[id]
 * Update a recognition event (e.g. license plate after reevaluate).
 * Body: { licensePlate: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Event id required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const licensePlate = typeof body.licensePlate === "string" ? body.licensePlate.trim() : "";
    if (!licensePlate || licensePlate.length < 2) {
      return NextResponse.json(
        { success: false, error: "Valid licensePlate required (min 2 chars)" },
        { status: 400 }
      );
    }

    const updated = await prisma.lprRecognitionEvent.update({
      where: { id },
      data: { licensePlate: licensePlate.toUpperCase() },
      include: {
        camera: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      event: {
        ...updated,
        images: [],
      },
    });
  } catch (error) {
    console.error("[DASHBOARD] PATCH recognition-event error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update event" },
      { status: 500 }
    );
  }
}
