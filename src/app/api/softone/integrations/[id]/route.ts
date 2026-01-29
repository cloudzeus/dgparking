import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stopIntegration } from "@/lib/cron-manager";

/**
 * DELETE /api/softone/integrations/[id]
 * Deletes a SoftOne integration and stops its cron job
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // ADMIN can delete any integration; others only their own
    const integration = await prisma.softOneIntegration.findFirst({
      where:
        session.user.role === "ADMIN"
          ? { id }
          : { id, userId: session.user.id },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    // Stop and remove the cron job before deleting
    console.log(`[DELETE-INTEGRATION] Stopping cron job for integration ${id} before deletion`);
    stopIntegration(id);

    // Delete integration
    await prisma.softOneIntegration.delete({
      where: { id },
    });

    console.log(`[DELETE-INTEGRATION] Successfully deleted integration ${id} and stopped its cron job`);

    return NextResponse.json({
      success: true,
      message: "Integration deleted successfully",
    });
  } catch (error) {
    console.error("SoftOne delete integration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete integration",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/softone/integrations/[id]
 * Gets a specific SoftOne integration
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // ADMIN can get any integration; others only their own
    const integration = await prisma.softOneIntegration.findFirst({
      where:
        session.user.role === "ADMIN"
          ? { id }
          : { id, userId: session.user.id },
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

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      integration,
    });
  } catch (error) {
    console.error("SoftOne get integration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get integration",
      },
      { status: 500 }
    );
  }
}








