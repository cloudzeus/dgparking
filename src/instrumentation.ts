export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only run on Node.js runtime (not Edge)
    // Initialize cron jobs asynchronously without blocking server startup
    // Use setTimeout with 0 delay to defer to next event loop cycle
    setTimeout(async () => {
      try {
        const { initializeCronJobs } = await import("@/lib/cron-manager");
        console.log("[INSTRUMENTATION] Initializing cron jobs in background...");
        await initializeCronJobs();
        console.log("[INSTRUMENTATION] Cron jobs initialization completed");
      } catch (error) {
        console.error("[INSTRUMENTATION] Failed to initialize cron jobs:", error);
        if (error instanceof Error) {
          console.error("[INSTRUMENTATION] Error details:", error.message);
        }
        // Don't throw - allow server to start even if cron initialization fails
      }
    }, 0);
  }
}


