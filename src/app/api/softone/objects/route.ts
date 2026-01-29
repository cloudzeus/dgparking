import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSoftOneObjects } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";
import { authenticateSoftOneAPI } from "@/lib/softone-api";

/**
 * POST /api/softone/objects
 * 
 * SERVER-SIDE API ROUTE - All SoftOne API calls are made server-side only.
 * 
 * Gets SoftOne objects (EditMaster objects like CUSTOMER, SALDOC, etc.)
 * Can use either connectionId (from DB) or direct clientID.
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
    const { connectionId, clientID, appId } = body;

    let clientIdToUse: string | undefined;
    let appIdToUse: string | undefined;

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
      appIdToUse = String(connection.appId);
    } else if (clientID && appId) {
      // Use provided clientID and appId directly
      clientIdToUse = clientID;
      appIdToUse = String(appId);
    } else {
      return NextResponse.json(
        { success: false, error: "Either connectionId or (clientID and appId) are required" },
        { status: 400 }
      );
    }

    if (clientIdToUse == null || appIdToUse == null) {
      return NextResponse.json(
        { success: false, error: "Missing clientID or appId after authentication" },
        { status: 400 }
      );
    }
    // Get objects with appId
    const result = await getSoftOneObjects(clientIdToUse, appIdToUse);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to get objects",
        },
        { status: 500 }
      );
    }

    // Return all objects (not just EditMaster) to include INST, INSTLINES, etc.
    // Previously filtered to only EditMaster, but some objects like INST might have different types
    const allObjects = result.objects || [];

    // Debug: Log object types and names to help diagnose missing objects
    const objectTypes = [...new Set(allObjects.map(obj => obj.type))];
    const hasINST = allObjects.some(obj => obj.name === "INST" || obj.name === "inst");
    const hasINSTLINES = allObjects.some(obj => obj.name === "INSTLINES" || obj.name === "instlines");
    
    console.log(`[SOFTONE-OBJECTS] Found ${allObjects.length} objects, types: ${objectTypes.join(", ")}`);
    console.log(`[SOFTONE-OBJECTS] Has INST: ${hasINST}, Has INSTLINES: ${hasINSTLINES}`);
    if (!hasINST || !hasINSTLINES) {
      console.log(`[SOFTONE-OBJECTS] Object names (first 20):`, allObjects.slice(0, 20).map(obj => `${obj.name} (${obj.type})`));
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      objects: allObjects,
    });
  } catch (error) {
    console.error("SoftOne get objects error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get objects",
      },
      { status: 500 }
    );
  }
}








