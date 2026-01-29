import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSoftOneTableFields } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";
import { authenticateSoftOneAPI } from "@/lib/softone-api";

/**
 * POST /api/softone/table-fields
 * 
 * SERVER-SIDE API ROUTE - All SoftOne API calls are made server-side only.
 * 
 * Gets fields for a specific SoftOne table.
 * Requires connectionId or clientID, objectName, tableName, and appId.
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
    const { connectionId, clientID, objectName, tableName, appId, version } = body;

    if (!objectName) {
      return NextResponse.json(
        { success: false, error: "objectName is required" },
        { status: 400 }
      );
    }

    if (!tableName) {
      return NextResponse.json(
        { success: false, error: "tableName is required" },
        { status: 400 }
      );
    }

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

    // Get table fields with appId and version
    const result = await getSoftOneTableFields(
      objectName,
      tableName,
      clientIdToUse,
      appIdToUse,
      version || "1"
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to get table fields",
        },
        { status: 500 }
      );
    }

    let fields = result.fields || [];

    // For INSTLINES table, ensure critical relationship fields are always included
    if (tableName.toUpperCase() === "INSTLINES" || tableName.toUpperCase().includes("INSTLINES")) {
      const fieldNames = fields.map((f: any) => f.name?.toUpperCase());
      
      // Add INST field if missing (foreign key to INST)
      if (!fieldNames.includes("INST")) {
        fields.unshift({
          name: "INST",
          alias: "INST",
          fullname: "INST",
          caption: "INST",
          type: "Int",
          size: "0",
          edittype: "number",
          xtype: "number",
          defaultvalue: "",
          decimals: "0",
          editor: "",
          readOnly: false,
          visible: true,
          required: false,
          calculated: false,
        });
        console.log("[TABLE-FIELDS] Added missing INST field for INSTLINES table");
      }
      
      // Add INSTLINES field if missing (primary key)
      if (!fieldNames.includes("INSTLINES")) {
        fields.unshift({
          name: "INSTLINES",
          alias: "INSTLINES",
          fullname: "INSTLINES",
          caption: "INSTLINES",
          type: "Int",
          size: "0",
          edittype: "number",
          xtype: "number",
          defaultvalue: "",
          decimals: "0",
          editor: "",
          readOnly: false,
          visible: true,
          required: true,
          calculated: false,
        });
        console.log("[TABLE-FIELDS] Added missing INSTLINES field for INSTLINES table");
      }
    }

    // For INST table, ensure INST field is included (primary key)
    if ((tableName.toUpperCase() === "INST" || tableName.toUpperCase().includes("INST")) && 
        tableName.toUpperCase() !== "INSTLINES") {
      const fieldNames = fields.map((f: any) => f.name?.toUpperCase());
      
      if (!fieldNames.includes("INST")) {
        fields.unshift({
          name: "INST",
          alias: "INST",
          fullname: "INST",
          caption: "INST",
          type: "Int",
          size: "0",
          edittype: "number",
          xtype: "number",
          defaultvalue: "",
          decimals: "0",
          editor: "",
          readOnly: false,
          visible: true,
          required: true,
          calculated: false,
        });
        console.log("[TABLE-FIELDS] Added missing INST field for INST table");
      }
    }

    return NextResponse.json({
      success: true,
      count: fields.length,
      fields: fields,
    });
  } catch (error) {
    console.error("SoftOne get table fields error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get table fields",
      },
      { status: 500 }
    );
  }
}








