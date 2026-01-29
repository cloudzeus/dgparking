import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/license-plates?company=COMPANY_VALUE (optional)
 * 
 * Returns all license plates (MTRL values) from INSTLINES table
 * If company parameter is provided, filters by ITEMS.COMPANY (matching MTRL)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only ADMIN, MANAGER, and EMPLOYEE can access
    if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");

    // Fetch all INSTLINES with MTRL (license plates)
    const instLines = await prisma.iNSTLINES.findMany({
      where: {
        MTRL: { not: null },
      },
      select: {
        INSTLINES: true,
        INST: true,
        MTRL: true,
        LINENUM: true,
        FROMDATE: true,
        FINALDATE: true,
      },
      orderBy: {
        MTRL: "asc",
      },
    });

    // Get all ITEMS to map MTRL -> NAME and COMPANY
    const allItems = await prisma.iTEMS.findMany({
      select: {
        MTRL: true,
        NAME: true,
        CODE: true,
        COMPANY: true,
      },
    });

    // Create maps for quick lookup
    const mtrlToNameMap = new Map<string, string>();
    const mtrlToCompanyMap = new Map<string, string>();
    
    allItems.forEach(item => {
      if (item.MTRL) {
        const normalizedMtrl = String(item.MTRL).replace(/^0+/, '') || String(item.MTRL);
        if (item.NAME) mtrlToNameMap.set(normalizedMtrl, item.NAME);
        if (item.COMPANY) mtrlToCompanyMap.set(normalizedMtrl, item.COMPANY);
      }
    });

    // Extract unique license plates with their names
    const licensePlatesMap = new Map<string, {
      mtrl: string;
      name: string | null;
      company: string | null;
      count: number;
      instLines: Array<{
        instLines: number;
        inst: number | null;
        linenum: number | null;
        fromdate: Date | null;
        finaldate: Date | null;
      }>;
    }>();

    instLines.forEach(line => {
      if (line.MTRL && String(line.MTRL).trim() !== '') {
        const normalizedMtrl = String(line.MTRL).replace(/^0+/, '') || String(line.MTRL);
        const mtrlName = mtrlToNameMap.get(normalizedMtrl) || null;
        const mtrlCompany = mtrlToCompanyMap.get(normalizedMtrl) || null;

        // If company filter is provided, skip if company doesn't match
        if (company && mtrlCompany !== company) {
          return;
        }

        if (!licensePlatesMap.has(normalizedMtrl)) {
          licensePlatesMap.set(normalizedMtrl, {
            mtrl: normalizedMtrl,
            name: mtrlName,
            company: mtrlCompany,
            count: 0,
            instLines: [],
          });
        }

        const plate = licensePlatesMap.get(normalizedMtrl)!;
        plate.count++;
        plate.instLines.push({
          instLines: line.INSTLINES,
          inst: line.INST,
          linenum: line.LINENUM,
          fromdate: line.FROMDATE,
          finaldate: line.FINALDATE,
        });
      }
    });

    const licensePlates = Array.from(licensePlatesMap.values());

    return NextResponse.json({
      success: true,
      company: company || "all",
      count: licensePlates.length,
      totalInstances: instLines.length,
      licensePlates,
    });
  } catch (error) {
    console.error("[LICENSE-PLATES] Error fetching license plates:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch license plates",
      },
      { status: 500 }
    );
  }
}

