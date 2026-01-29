/**
 * Cron Job Manager - SERVER-SIDE ONLY
 * 
 * Manages scheduled cron jobs for SoftOne integrations.
 * This runs entirely server-side and does not require the user to be online.
 * 
 * In Next.js, cron jobs can be triggered via:
 * 1. API routes that are called by external cron services (recommended for production)
 * 2. A background process that runs node-cron (requires a persistent server)
 * 
 * For production, it's recommended to use an external cron service (like Vercel Cron, 
 * GitHub Actions, or a dedicated cron service) that calls the API route.
 */

import cron from "node-cron";
import { prisma } from "@/lib/prisma";

let cronJobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();
let isInitialized = false;

/**
 * Initialize and start all cron jobs for active integrations
 * This should be called once when the server starts
 */
export async function initializeCronJobs() {
  if (isInitialized) {
    console.log("[CRON] Cron jobs already initialized");
    return;
  }

  console.log("[CRON] Initializing cron jobs for SoftOne integrations...");

  try {
    // Load all active integrations
    // Wrap in try-catch to handle database connection errors gracefully
    let integrations;
    try {
      integrations = await prisma.softOneIntegration.findMany({
        include: { connection: true },
      });
    } catch (dbError) {
      console.error("[CRON] Database connection error - cannot load integrations:", dbError);
      if (dbError instanceof Error) {
        console.error("[CRON] Database error details:", dbError.message);
      }
      // Don't mark as initialized if we can't connect to the database
      // This allows retry on next server restart or when database comes back online
      console.warn("[CRON] Skipping cron job initialization - database unavailable. Will retry on next server restart.");
      return;
    }

    console.log(`[CRON] Found ${integrations.length} integrations`);

    // Schedule each integration
    let scheduledCount = 0;
    for (const integration of integrations) {
      try {
        const config = integration.configJson as any;
        const cronExpression = config?.schedule?.cronExpression;
        console.log(`[CRON] Processing integration: ${integration.name} (${integration.id}), cron: ${cronExpression}`);
        
        await scheduleIntegration(integration.id);
        scheduledCount++;
      } catch (integrationError) {
        console.error(`[CRON] Failed to schedule integration ${integration.id}:`, integrationError);
        // Continue with other integrations even if one fails
      }
    }

    isInitialized = true;
    console.log(`[CRON] All cron jobs initialized successfully - scheduled ${scheduledCount}/${integrations.length} integrations`);
  } catch (error) {
    console.error("[CRON] Failed to initialize cron jobs:", error);
    if (error instanceof Error) {
      console.error("[CRON] Error details:", error.message, error.stack);
    }
    // Don't mark as initialized if there was an error
    // This allows the system to retry on next server restart
  }
}

/**
 * Schedule a cron job for a specific integration
 */
export async function scheduleIntegration(integrationId: string) {
  try {
    // Stop existing job if any
    stopIntegration(integrationId);

    // Load integration
    const integration = await prisma.softOneIntegration.findUnique({
      where: { id: integrationId },
      include: { connection: true },
    });

    if (!integration) {
      console.log(`[CRON] Integration ${integrationId} not found, skipping`);
      return;
    }

    // Get cron expression from config
    const config = integration.configJson as any;
    const cronExpression = config?.schedule?.cronExpression;

    if (!cronExpression) {
      console.log(`[CRON] No cron expression found for integration ${integrationId}, skipping`);
      return;
    }

    // Normalize cron expression - remove spaces around / in patterns like "* /1" -> "*/1"
    let normalizedCronExpression = cronExpression.trim().replace(/\*\s*\/\s*/g, "*/");
    
    // Ensure cron expression has exactly 5 fields (minute hour day month day-of-week)
    const fields = normalizedCronExpression.split(/\s+/);
    if (fields.length === 4) {
      // Missing day-of-week field, add it (default to * for any day)
      normalizedCronExpression = `${normalizedCronExpression} *`;
      console.log(`[CRON] Fixed cron expression - added missing day-of-week field: "${normalizedCronExpression}"`);
    } else if (fields.length !== 5) {
      console.error(`[CRON] Invalid cron expression for integration ${integrationId}: "${cronExpression}" (normalized: "${normalizedCronExpression}") - must have 5 fields, got ${fields.length}`);
      return;
    }
    
    // Validate cron expression
    if (!cron.validate(normalizedCronExpression)) {
      console.error(`[CRON] Invalid cron expression for integration ${integrationId}: "${cronExpression}" (normalized: "${normalizedCronExpression}")`);
      return;
    }

    console.log(`[CRON] Scheduling integration ${integration.name} (${integrationId}) with cron: "${normalizedCronExpression}" (original: "${cronExpression}")`);

    // Schedule the job
    const task = cron.schedule(
      normalizedCronExpression,
      async () => {
        const executionTime = new Date().toISOString();
        console.log(`[CRON] [${executionTime}] Executing sync for integration: ${integration.name} (${integrationId})`);
        try {
          // Call the sync API route
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
          const url = `${baseUrl}/api/cron/sync-integration`;
          console.log(`[CRON] [${executionTime}] Calling sync API: ${url} for integration: ${integration.name}`);
          
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Use a secret token for authentication
              "X-Cron-Secret": process.env.CRON_SECRET || "change-this-secret",
            },
            body: JSON.stringify({ integrationId }),
          });

          // Check content type before parsing
          const contentType = response.headers.get("content-type");
          const isJson = contentType?.includes("application/json");

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[CRON] [${executionTime}] Sync failed for ${integration.name} (status: ${response.status}):`, errorText.substring(0, 500));
            
            // Try to parse as JSON if it looks like JSON
            if (isJson) {
              try {
                const errorJson = JSON.parse(errorText);
                console.error(`[CRON] [${executionTime}] Error details:`, errorJson);
              } catch (e) {
                // Not JSON, already logged as text
              }
            }
          } else {
            if (isJson) {
              try {
                const result = await response.json();
                console.log(`[CRON] [${executionTime}] Sync completed for ${integration.name}:`, JSON.stringify(result).substring(0, 200));
              } catch (parseError) {
                const text = await response.text();
                console.error(`[CRON] [${executionTime}] Failed to parse JSON response for ${integration.name}:`, text.substring(0, 500));
              }
            } else {
              const text = await response.text();
              console.warn(`[CRON] [${executionTime}] Non-JSON response for ${integration.name} (content-type: ${contentType}):`, text.substring(0, 500));
            }
          }
        } catch (error) {
          console.error(`[CRON] [${executionTime}] Error executing sync for ${integration.name}:`, error);
          if (error instanceof Error) {
            console.error(`[CRON] [${executionTime}] Error stack:`, error.stack);
          }
        }
      },
      {
        timezone: "Europe/Athens", // Adjust to your timezone
      }
    );

    cronJobs.set(integrationId, task);
    console.log(`[CRON] ✓ Successfully scheduled integration "${integration.name}" (${integrationId}) with cron: "${normalizedCronExpression}"`);
  } catch (error) {
    console.error(`[CRON] Failed to schedule integration ${integrationId}:`, error);
  }
}

/**
 * Stop and remove a cron job for a specific integration
 */
export function stopIntegration(integrationId: string) {
  const task = cronJobs.get(integrationId);
  if (task) {
    task.stop();
    cronJobs.delete(integrationId);
    console.log(`[CRON] Stopped cron job for integration ${integrationId}`);
  }
}

/**
 * Reschedule all integrations (useful after updates)
 */
export async function rescheduleAllIntegrations() {
  console.log("[CRON] Rescheduling all integrations...");
  
  // Stop all existing jobs
  for (const [integrationId, task] of cronJobs.entries()) {
    task.stop();
  }
  cronJobs.clear();

  // Reload and schedule all active integrations
  await initializeCronJobs();
}

/**
 * Get status of all scheduled jobs
 */
export function getCronJobStatus() {
  return {
    totalJobs: cronJobs.size,
    jobIds: Array.from(cronJobs.keys()),
    isInitialized,
  };
}







