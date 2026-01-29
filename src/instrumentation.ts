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
        const msg = error instanceof Error ? error.message : String(error);
        const isDbUnreachable =
          msg.includes("Can't reach database") ||
          msg.includes("ECONNREFUSED") ||
          msg.includes("PrismaClientInitializationError");
        if (isDbUnreachable) {
          console.warn(
            "[INSTRUMENTATION] Cron init skipped: database unreachable. Ensure DATABASE_URL is correct and the DB is reachable from this host. Set NODE_ENV=production."
          );
        } else {
          console.error("[INSTRUMENTATION] Cron init failed:", msg);
        }
        // Don't throw - allow server to start even if cron initialization fails
      }
    }, 0);
  }
}


