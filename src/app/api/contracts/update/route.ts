import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI, setSoftOneData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";

/**
 * POST /api/contracts/update
 * Update a contract (INST) - optionally sync to ERP
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
    const { instId, data, syncToErp } = body;

    if (!instId) {
      return NextResponse.json(
        { success: false, error: "instId is required" },
        { status: 400 }
      );
    }

    // Verify INST exists
    const inst = await prisma.iNST.findUnique({
      where: { INST: instId },
    });

    if (!inst) {
      return NextResponse.json(
        { success: false, error: "Contract (INST) not found" },
        { status: 404 }
      );
    }

    // If syncToErp is true, update in ERP first
    if (syncToErp) {
      // Find INST integration
      const allIntegrations = await prisma.softOneIntegration.findMany({
        where: {
          userId: session.user.id,
        },
        include: { connection: true },
      });

      const instIntegration = allIntegrations.find((integration) => {
        const config = integration.configJson as any;
        return config?.modelMapping?.modelName === "INST";
      });

      if (instIntegration) {
        const config = instIntegration.configJson as any;
        const modelMapping = config?.modelMapping || {};
        const { fieldMappings } = modelMapping;

        if (fieldMappings) {
          // Authenticate with SoftOne
          const password = decrypt(instIntegration.connection.passwordEnc);
          const authResult = await authenticateSoftOneAPI(
            instIntegration.connection.username,
            password,
            String(instIntegration.connection.appId),
            String(instIntegration.connection.company),
            String(instIntegration.connection.branch),
            String(instIntegration.connection.module),
            String(instIntegration.connection.refid),
            undefined,
            instIntegration.connection.registeredName
          );

          if (authResult.success && authResult.clientID) {
            const objectName = instIntegration.objectName || "INST";
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

            // Use INST as the key for updates
            const key = String(instId);

            const softOneData: any = {};
            softOneData[objectName] = [erpData];

            const setDataResult = await setSoftOneData(
              objectName,
              key,
              softOneData,
              authResult.clientID,
              instIntegration.connection.appId,
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
    const updated = await prisma.iNST.update({
      where: { INST: instId },
      data: {
        ...data,
        UPDDATE: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      contract: updated,
    });
  } catch (error: any) {
    console.error("[API] Error updating contract:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update contract" },
      { status: 500 }
    );
  }
}
