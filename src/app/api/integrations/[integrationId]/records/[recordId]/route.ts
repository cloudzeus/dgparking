import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/integrations/[integrationId]/records/[recordId]
 * Delete a record from an integration
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ integrationId: string; recordId: string }> }
) {
  try {
    const { integrationId, recordId } = await params;
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

    const config = integration.configJson as any;
    const modelMapping = config?.modelMapping || {};
    const modelName = modelMapping?.modelName || "";

    if (!modelName) {
      return NextResponse.json(
        { success: false, error: "Model mapping not configured" },
        { status: 400 }
      );
    }

    // Get the model dynamically
    const model = (prisma as any)[modelName];
    if (!model) {
      return NextResponse.json(
        { success: false, error: `Model ${modelName} not found` },
        { status: 400 }
      );
    }

    // Get primary key field
    const primaryKeyField = getPrimaryKeyField(modelName);
    
    // Parse recordId
    let parsedRecordId: string | number = recordId;
    if (modelName === "CUSTORMER" || modelName === "COUNTRY" || modelName === "VAT" || 
        modelName === "SOCURRENCY" || modelName === "TRDCATEGORY" || modelName === "ITEMS" || 
        modelName === "PAYMENT" || modelName === "INST" || modelName === "INSTLINES") {
      parsedRecordId = parseInt(recordId, 10);
      if (isNaN(parsedRecordId)) {
        return NextResponse.json(
          { success: false, error: "Invalid record ID" },
          { status: 400 }
        );
      }
    }

    // Get the existing record to check TRDR
    const existingRecord = await model.findUnique({
      where: {
        [primaryKeyField]: parsedRecordId,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    // For CUSTORMER, check if TRDR exists - if it does, don't allow deletion
    if (modelName === "CUSTORMER" && existingRecord.TRDR) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Cannot delete customer with TRDR. This customer is synced from SoftOne ERP." 
        },
        { status: 400 }
      );
    }

    // For ITEMS, check if MTRL exists - if it does, don't allow deletion
    if (modelName === "ITEMS" && existingRecord.MTRL) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Cannot delete item with MTRL. This item is synced from SoftOne ERP." 
        },
        { status: 400 }
      );
    }

    // Delete the record
    await model.delete({
      where: {
        [primaryKeyField]: parsedRecordId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Record deleted successfully",
    });
  } catch (error) {
    console.error("[API] Error deleting record:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete record",
      },
      { status: 500 }
    );
  }
}

function getPrimaryKeyField(modelName: string): string {
  const primaryKeys: Record<string, string> = {
    CUSTORMER: "id",
    User: "id",
    COUNTRY: "COUNTRY",
    IRSDATA: "IRSDATA",
    VAT: "VAT",
    SOCURRENCY: "SOCURRENCY",
    TRDCATEGORY: "TRDCATEGORY",
    ITEMS: "ITEMS",
    PAYMENT: "PAYMENT",
    INST: "INST",
    INSTLINES: "INSTLINES",
  };
  return primaryKeys[modelName] || "id";
}



