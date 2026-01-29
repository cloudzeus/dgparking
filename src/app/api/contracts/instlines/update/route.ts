import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI, setSoftOneData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";

/**
 * POST /api/contracts/instlines/update
 * Update an INSTLINES record - optionally sync to ERP
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
    const { instLineId, data, syncToErp } = body;

    if (!instLineId) {
      return NextResponse.json(
        { success: false, error: "instLineId is required" },
        { status: 400 }
      );
    }

    // Verify INSTLINES exists
    const instLine = await prisma.iNSTLINES.findUnique({
      where: { INSTLINES: instLineId },
    });

    if (!instLine) {
      return NextResponse.json(
        { success: false, error: "INSTLINES record not found" },
        { status: 404 }
      );
    }

    // If syncToErp is true, update in ERP first
    if (syncToErp) {
      // Find INSTLINES integration
      const allIntegrations = await prisma.softOneIntegration.findMany({
        where: {
          userId: session.user.id,
        },
        include: { connection: true },
      });

      const instLinesIntegration = allIntegrations.find((integration) => {
        const config = integration.configJson as any;
        return config?.modelMapping?.modelName === "INSTLINES";
      });

      if (instLinesIntegration) {
        const config = instLinesIntegration.configJson as any;
        const modelMapping = config?.modelMapping || {};
        const { fieldMappings } = modelMapping;

        if (fieldMappings) {
          // Authenticate with SoftOne
          const password = decrypt(instLinesIntegration.connection.passwordEnc);
          const authResult = await authenticateSoftOneAPI(
            instLinesIntegration.connection.username,
            password,
            String(instLinesIntegration.connection.appId),
            String(instLinesIntegration.connection.company),
            String(instLinesIntegration.connection.branch),
            String(instLinesIntegration.connection.module),
            String(instLinesIntegration.connection.refid),
            undefined,
            instLinesIntegration.connection.registeredName
          );

          if (authResult.success && authResult.clientID) {
            const objectName = instLinesIntegration.objectName || "INSTLINES";
            const erpData: any = {};
            const reverseMappings: Record<string, string> = {};
            
            Object.entries(fieldMappings as Record<string, string>).forEach(([erpFieldName, modelFieldName]) => {
              if (typeof modelFieldName === "string" && modelFieldName !== "none") {
                reverseMappings[modelFieldName] = erpFieldName;
              }
            });

            // Map data to ERP format
            Object.entries(data).forEach(([key, value]) => {
              if (value !== null && value !== undefined && reverseMappings[key]) {
                erpData[reverseMappings[key]] = value;
              }
            });

            // Ensure INSTLINES ID is included
            erpData[reverseMappings["INSTLINES"] || "INSTLINES"] = instLineId;
            // Ensure INST is included (required)
            if (instLine.INST) {
              erpData[reverseMappings["INST"] || "INST"] = instLine.INST;
            }

            // Use INSTLINES as the key for updates
            const key = String(instLineId);

            const softOneData: any = {};
            softOneData[objectName] = [erpData];

            const setDataResult = await setSoftOneData(
              objectName,
              key,
              softOneData,
              authResult.clientID,
              instLinesIntegration.connection.appId,
              "2", // VERSION 2
              undefined
            );

            if (!setDataResult.success) {
              return NextResponse.json(
                { success: false, error: `Failed to update in ERP: ${setDataResult.error}` },
                { status: 500 }
              );
            }
          }
        }
      }
    }

    // Update in our database
    const updated = await prisma.iNSTLINES.update({
      where: { INSTLINES: instLineId },
      data: {
        ...data,
        UPDDATE: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      instLine: updated,
    });
  } catch (error: any) {
    console.error("[API] Error updating INSTLINES:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update INSTLINES" },
      { status: 500 }
    );
  }
}
