import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSoftOneTableData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";
import { authenticateSoftOneAPI } from "@/lib/softone-api";

/**
 * POST /api/softone/get-table
 * 
 * SERVER-SIDE API ROUTE - All SoftOne API calls are made server-side only.
 * 
 * Gets actual data from a SoftOne table using selected fields and filter.
 * Requires connectionId or clientID, tableName, fields, and appId.
 * 
 * Client components should call this route, never call SoftOne API directly.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { connectionId, clientID, tableName, fields, filter, appId, version } = body;

    if (!tableName) {
      return NextResponse.json(
        { success: false, error: "tableName is required" },
        { status: 400 }
      );
    }

    if (!fields) {
      return NextResponse.json(
        { success: false, error: "fields is required (comma-separated field names)" },
        { status: 400 }
      );
    }

    let clientIdToUse: string | undefined;
    let appIdToUse: string | number | undefined;

    // If connectionId is provided, load credentials and authenticate
    if (connectionId) {
      const connection = await prisma.softOneConnection.findFirst({
        where: {
          id: connectionId,
          userId: session.user.id, // Ensure user owns this connection
        },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: "Connection not found" },
          { status: 404 }
        );
      }

      // Authenticate using stored credentials
      const password = decrypt(connection.passwordEnc);
      const authResult = await authenticateSoftOneAPI(
        connection.username,
        password,
        String(connection.appId),
        String(connection.company),
        String(connection.branch),
        String(connection.module),
        String(connection.refid),
        undefined, // version
        connection.registeredName
      );

      if (!authResult.success || !authResult.clientID) {
        return NextResponse.json(
          {
            success: false,
            error: authResult.error || "Failed to authenticate with stored credentials",
          },
          { status: 401 }
        );
      }

      clientIdToUse = authResult.clientID;
      appIdToUse = connection.appId; // Already a number
    } else if (clientID && appId) {
      // Use provided clientID and appId directly
      clientIdToUse = clientID;
      appIdToUse = typeof appId === "string" ? Number(appId) : appId;
    } else {
      return NextResponse.json(
        { success: false, error: "Either connectionId or (clientID and appId) are required" },
        { status: 400 }
      );
    }

    // Get table data with selected fields and filter
    const result = await getSoftOneTableData(
      tableName,
      fields,
      clientIdToUse,
      appIdToUse,
      filter || "1=1",
      version || "1"
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to get table data",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      table: result.table,
      keys: result.keys,
      data: result.data || [],
    });
  } catch (error) {
    console.error("SoftOne get table data error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get table data",
      },
      { status: 500 }
    );
  }
}








