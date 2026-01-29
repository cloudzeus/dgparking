import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/debug
 * 
 * Debug endpoint to check cron job status and logs
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check integrations
    const integrations = await prisma.softOneIntegration.findMany({
      select: {
        id: true,
        name: true,
        userId: true,
        isActive: true,
        configJson: true,
      },
    });

    // Check all cron logs
    const allLogs = await prisma.cronJobLog.findMany({
      take: 10,
      orderBy: { startedAt: "desc" },
      include: {
        integration: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Check logs for current user
    const userLogs = await prisma.cronJobLog.findMany({
      where: { userId: session.user.id },
      take: 10,
      orderBy: { startedAt: "desc" },
      include: {
        integration: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
      },
    });

    // Check logs for user's integrations
    const userIntegrationIds = integrations
      .filter(i => i.userId === session.user.id)
      .map(i => i.id);
    
    const integrationLogs = await prisma.cronJobLog.findMany({
      where: {
        integrationId: { in: userIntegrationIds },
      },
      take: 10,
      orderBy: { startedAt: "desc" },
      include: {
        integration: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      debug: {
        currentUser: {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
        },
        activeIntegrations: integrations.map(i => ({
          id: i.id,
          name: i.name,
          userId: i.userId,
          isActive: i.isActive,
          cronExpression: (i.configJson as any)?.schedule?.cronExpression,
          belongsToCurrentUser: i.userId === session.user.id,
        })),
        totalLogsInSystem: allLogs.length,
        recentLogs: allLogs.map(log => ({
          id: log.id,
          userId: log.userId,
          integrationId: log.integrationId,
          integrationName: log.integration?.name,
          integrationUserId: log.integration?.userId,
          jobType: log.jobType,
          status: log.status,
          startedAt: log.startedAt,
          triggeredBy: (log.details as any)?.triggeredBy,
          userEmail: log.user?.email,
        })),
        userLogsCount: userLogs.length,
        userLogs: userLogs.map(log => ({
          id: log.id,
          userId: log.userId,
          integrationId: log.integrationId,
          integrationName: log.integration?.name,
          jobType: log.jobType,
          status: log.status,
          startedAt: log.startedAt,
        })),
        integrationLogsCount: integrationLogs.length,
        integrationLogs: integrationLogs.map(log => ({
          id: log.id,
          userId: log.userId,
          userEmail: log.user?.email,
          integrationId: log.integrationId,
          integrationName: log.integration?.name,
          jobType: log.jobType,
          status: log.status,
          startedAt: log.startedAt,
        })),
      },
    });
  } catch (error) {
    console.error("[CRON-DEBUG] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Debug failed",
      },
      { status: 500 }
    );
  }
}


