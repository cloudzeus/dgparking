import { NextResponse } from "next/server";
import { initializeCronJobs } from "@/lib/cron-manager";

/**
 * GET /api/cron/init
 * 
 * Initializes all cron jobs for active integrations.
 * This should be called when the server starts or after creating/updating integrations.
 * 
 * For production, you can call this endpoint on server startup or use an external cron service.
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret (optional, but recommended)
    const cronSecret = request.headers.get("X-Cron-Secret");
    const expectedSecret = process.env.CRON_SECRET || "change-this-secret";

    if (cronSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await initializeCronJobs();

    return NextResponse.json({
      success: true,
      message: "Cron jobs initialized successfully",
    });
  } catch (error) {
    console.error("[CRON] Failed to initialize cron jobs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize cron jobs",
      },
      { status: 500 }
    );
  }
}







