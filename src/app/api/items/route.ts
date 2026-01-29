import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/items
 * Fetch all ITEMS for selection
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const items = await prisma.iTEMS.findMany({
      select: {
        ITEMS: true,
        MTRL: true,
        CODE: true,
        NAME: true,
      },
      orderBy: { NAME: "asc" },
    });

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("[API] Error fetching items:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/items
 * Create a new ITEM (license plate)
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
    const { MTRL, NAME, CODE, ISACTIVE } = body;

    if (!MTRL || !MTRL.trim()) {
      return NextResponse.json(
        { success: false, error: "MTRL (license plate) is required" },
        { status: 400 }
      );
    }

    // Convert MTRL to number for ITEMS primary key
    const mtrlStr = String(MTRL).trim().toUpperCase();
    const mtrlNum = Number(mtrlStr.replace(/^0+/, '') || '0');
    
    if (isNaN(mtrlNum) || mtrlNum <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid MTRL value" },
        { status: 400 }
      );
    }

    // Check if item already exists
    const existing = await prisma.iTEMS.findUnique({
      where: { ITEMS: mtrlNum },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Item with this MTRL already exists" },
        { status: 400 }
      );
    }

    // Create new item
    const newItem = await prisma.iTEMS.create({
      data: {
        ITEMS: mtrlNum,
        MTRL: mtrlStr,
        CODE: CODE || mtrlStr,
        NAME: NAME || mtrlStr,
        ISACTIVE: ISACTIVE ?? 1,
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        ITEMS: newItem.ITEMS,
        MTRL: newItem.MTRL,
        CODE: newItem.CODE,
        NAME: newItem.NAME,
      },
    });
  } catch (error: any) {
    console.error("[API] Error creating item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create item" },
      { status: 500 }
    );
  }
}
