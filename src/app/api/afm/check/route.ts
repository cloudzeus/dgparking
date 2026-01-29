import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/afm/check
 * Check if AFM already exists in CUSTORMER model
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { afm, excludeRecordId } = body; // excludeRecordId for edit mode

    if (!afm || typeof afm !== "string") {
      return NextResponse.json(
        { success: false, error: "AFM is required" },
        { status: 400 }
      );
    }

    const afmToCheck = afm.trim();

    if (!afmToCheck) {
      return NextResponse.json(
        { success: true, exists: false },
      );
    }

    // Check if AFM exists in CUSTORMER model
    const custormerModel = (prisma as any).CUSTORMER;
    if (!custormerModel) {
      return NextResponse.json(
        { success: false, error: "CUSTORMER model not found" },
        { status: 500 }
      );
    }

    // Build where clause
    const where: any = {
      AFM: afmToCheck,
    };

    // Exclude current record if editing
    if (excludeRecordId) {
      where.id = {
        not: typeof excludeRecordId === "string" 
          ? parseInt(excludeRecordId, 10) 
          : excludeRecordId,
      };
    }

    const existingRecord = await custormerModel.findFirst({
      where,
      select: {
        id: true,
        NAME: true,
        AFM: true,
      },
    });

    return NextResponse.json({
      success: true,
      exists: !!existingRecord,
      record: existingRecord || null,
    });
  } catch (error) {
    console.error("[API] AFM check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check AFM",
      },
      { status: 500 }
    );
  }
}



