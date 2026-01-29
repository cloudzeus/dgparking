import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/integrations/[integrationId]/options
 * Get dropdown options for COUNTRY and IRSDATA
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ADMIN can use any integration; others only their own
    const integration = await prisma.softOneIntegration.findFirst({
      where:
        session.user.role === "ADMIN"
          ? { id: integrationId }
          : { id: integrationId, userId: session.user.id },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    // Fetch countries - use dynamic model access
    const countryModel = (prisma as any).COUNTRY;
    const countries = countryModel ? await countryModel.findMany({
      select: {
        COUNTRY: true,
        NAME: true,
      },
      orderBy: {
        NAME: "asc",
      },
    }) : [];

    // Fetch IRS data - use dynamic model access
    const irsDataModel = (prisma as any).IRSDATA;
    const irsData = irsDataModel ? await irsDataModel.findMany({
      select: {
        IRSDATA: true,
        NAME: true,
      },
      orderBy: {
        NAME: "asc",
      },
    }) : [];

    // Find Greece (ΕΛΛΑΔΑ) country code for default
    const greeceCountry = countries.find((c) => 
      c.NAME && (c.NAME.toLowerCase().includes("ελλάδα") || 
                 c.NAME.toLowerCase().includes("greece") ||
                 c.NAME.toLowerCase().includes("ellada"))
    );

    return NextResponse.json({
      success: true,
      countries: countries.map((c) => ({
        value: String(c.COUNTRY),
        label: c.NAME || String(c.COUNTRY),
      })),
      irsData: irsData.map((i) => ({
        value: i.IRSDATA,
        label: i.NAME || i.IRSDATA,
      })),
      defaultCountry: greeceCountry ? String(greeceCountry.COUNTRY) : null,
    });
  } catch (error) {
    console.error("[API] Error fetching options:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch options",
      },
      { status: 500 }
    );
  }
}



