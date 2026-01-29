import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

/**
 * POST /api/softone/save-integration
 * 
 * SERVER-SIDE API ROUTE - All database operations are server-side only.
 * 
 * Saves a SoftOne integration configuration to the database.
 * This is a database operation, no SoftOne API call is made here.
 * 
 * If connectionId is not provided, creates a new connection automatically using connectionData.
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
    const {
      integrationId, // Optional: if provided, update existing integration instead of creating new one
      connectionId,
      connectionData, // Optional: used to create connection if connectionId is missing
      name,
      objectName,
      objectCaption,
      tableName,
      tableDbname,
      tableCaption,
      config,
    } = body;

    // Validate required fields
    if (!name || !objectName || !tableName || !tableDbname) {
      console.error("[SAVE-INTEGRATION] Missing required fields:", {
        hasName: !!name,
        hasObjectName: !!objectName,
        hasTableName: !!tableName,
        hasTableDbname: !!tableDbname,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, objectName, tableName, tableDbname",
        },
        { status: 400 }
      );
    }

    let finalConnectionId = connectionId;

    // If no connectionId provided, create a new connection from connectionData
    if (!finalConnectionId) {
      if (!connectionData) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing connectionId or connectionData. A connection is required to save an integration.",
          },
          { status: 400 }
        );
      }

      const {
        registeredName,
        username,
        password,
        appId,
        company,
        branch,
        module,
        refid,
        connectionName,
      } = connectionData;

      if (!registeredName || !username || !password || !appId) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required connection data: registeredName, username, password, appId",
          },
          { status: 400 }
        );
      }

      // Create a connection with a default name if not provided
      const connection = await prisma.softOneConnection.create({
        data: {
          userId: session.user.id,
          name: connectionName || `${registeredName} - ${new Date().toLocaleDateString()}`,
          registeredName,
          username,
          passwordEnc: encrypt(password),
          appId: Number(appId),
          company: Number(company || 1001),
          branch: Number(branch || 1000),
          module: Number(module || 0),
          refid: Number(refid || 15),
        },
      });

      finalConnectionId = connection.id;
    } else {
      // Verify connection belongs to user
      const connection = await prisma.softOneConnection.findFirst({
        where: {
          id: finalConnectionId,
          userId: session.user.id,
        },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: "Connection not found" },
          { status: 404 }
        );
      }
    }

    // Check if updating existing integration or creating new one
    let integration;
    
    if (integrationId) {
      // Update existing integration
      console.log("[SAVE-INTEGRATION] Updating integration:", {
        integrationId,
        userId: session.user.id,
        connectionId: finalConnectionId,
        name,
        objectName,
        tableName,
        tableDbname,
        configKeys: Object.keys(config || {}),
      });

      // Verify integration belongs to user
      const existingIntegration = await prisma.softOneIntegration.findFirst({
        where: {
          id: integrationId,
          userId: session.user.id,
        },
      });

      if (!existingIntegration) {
        return NextResponse.json(
          { success: false, error: "Integration not found or unauthorized" },
          { status: 404 }
        );
      }

      integration = await prisma.softOneIntegration.update({
        where: { id: integrationId },
        data: {
          connectionId: finalConnectionId,
          name,
          objectName,
          objectCaption: objectCaption || null,
          tableName,
          tableDbname,
          tableCaption: tableCaption || null,
          configJson: config || {},
        },
      });

      console.log("[SAVE-INTEGRATION] Integration updated successfully:", integration.id);
    } else {
      // Create new integration
      console.log("[SAVE-INTEGRATION] Creating integration with data:", {
        userId: session.user.id,
        connectionId: finalConnectionId,
        name,
        objectName,
        tableName,
        tableDbname,
        configKeys: Object.keys(config || {}),
      });

      integration = await prisma.softOneIntegration.create({
        data: {
          userId: session.user.id,
          connectionId: finalConnectionId,
          name,
          objectName,
          objectCaption: objectCaption || null,
          tableName,
          tableDbname,
          tableCaption: tableCaption || null,
          configJson: config || {},
          // isActive has a default value of true in the schema, so we don't need to set it
        },
      });

      console.log("[SAVE-INTEGRATION] Integration created successfully:", integration.id);
    }

    // Schedule the cron job for this integration (optional, won't fail if it errors)
    try {
      // Dynamically import to avoid issues in serverless environments
      const { scheduleIntegration } = await import("@/lib/cron-manager");
      await scheduleIntegration(integration.id);
      console.log("[SAVE-INTEGRATION] Cron job scheduled successfully");
    } catch (error) {
      console.error("[SAVE-INTEGRATION] Failed to schedule cron job (non-critical):", error);
      // Don't fail the request if scheduling fails - cron can be set up separately
    }

    // Fetch the complete integration with connection for the response
    const completeIntegration = await prisma.softOneIntegration.findUnique({
      where: { id: integration.id },
      include: {
        connection: {
          select: {
            id: true,
            name: true,
            registeredName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      integration: completeIntegration ? {
        id: completeIntegration.id,
        name: completeIntegration.name,
        objectName: completeIntegration.objectName,
        objectCaption: completeIntegration.objectCaption,
        tableName: completeIntegration.tableName,
        tableDbname: completeIntegration.tableDbname,
        tableCaption: completeIntegration.tableCaption,
        configJson: completeIntegration.configJson,
        createdAt: completeIntegration.createdAt,
        updatedAt: completeIntegration.updatedAt,
        connection: completeIntegration.connection,
      } : {
        id: integration.id,
        name: integration.name,
        objectName: integration.objectName,
        tableName: integration.tableName,
        createdAt: integration.createdAt,
      },
    });
  } catch (error) {
    console.error("SoftOne save integration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save integration",
      },
      { status: 500 }
    );
  }
}
