import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/test-sync
 * 
 * Manually trigger a sync for testing purposes (creates a log entry)
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
    const { integrationId } = body;

    if (!integrationId) {
      return NextResponse.json(
        { success: false, error: "integrationId is required" },
        { status: 400 }
      );
    }

    // Call the sync endpoint manually (this will create a log)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/cron/sync-integration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Don't use cron secret - use session auth
      },
      body: JSON.stringify({ integrationId }),
    });

    const result = await response.json();

    return NextResponse.json({
      success: response.ok,
      message: "Sync triggered manually",
      result,
    });
  } catch (error) {
    console.error("[TEST-SYNC] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to trigger sync",
      },
      { status: 500 }
    );
  }
}


