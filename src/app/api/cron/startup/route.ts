import { NextResponse } from "next/server";
import { initializeCronJobs } from "@/lib/cron-manager";

/**
 * GET /api/cron/startup
 * 
 * This endpoint can be called on server startup to initialize all cron jobs.
 * 
 * For Next.js deployments:
 * - Vercel: Use Vercel Cron Jobs or call this on serverless function warmup
 * - Docker/Standalone: Call this in your startup script
 * - Other platforms: Configure to call this endpoint on server start
 * 
 * You can also set up an external cron service to ping this endpoint periodically
 * to ensure cron jobs are running.
 */
export async function GET() {
  try {
    await initializeCronJobs();
    return NextResponse.json({
      success: true,
      message: "Cron jobs initialized",
    });
  } catch (error) {
    console.error("[CRON] Startup initialization error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 }
    );
  }
}







