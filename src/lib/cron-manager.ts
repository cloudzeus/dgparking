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
import { refreshContractCars } from "@/lib/contract-cars";
import { detectDeviations } from "@/lib/parking-monitor";
import { sendImmediateAlerts, sendDailyDigest } from "@/lib/parking-notify";
import { sendExpiryNotices } from "@/lib/contract-expiry";

let cronJobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();
let isInitialized = false;

/**
 * Εσωτερική εργασία — δεν προέρχεται από `SoftOneIntegration`, γι' αυτό έχει
 * δικό της αναγνωριστικό με πρόθεμα.
 */
export const CONTRACT_CARS_JOB_ID = "internal:contract-cars";
const CONTRACT_CARS_CRON = "*/5 * * * *";

/** Φρουρός επικάλυψης: αν η προηγούμενη εκτέλεση τρέχει ακόμη, την προσπερνάμε. */
let contractCarsRunning = false;

async function runContractCarsRefresh(trigger: string) {
  if (contractCarsRunning) {
    console.log(`[CRON] ${CONTRACT_CARS_JOB_ID}: προηγούμενη εκτέλεση σε εξέλιξη — παράλειψη (${trigger})`);
    return;
  }
  contractCarsRunning = true;
  const startedAt = Date.now();
  try {
    await refreshContractCars();
    console.log(`[CRON] ${CONTRACT_CARS_JOB_ID}: ολοκληρώθηκε σε ${Date.now() - startedAt} ms (${trigger})`);
  } catch (error) {
    console.error(`[CRON] ${CONTRACT_CARS_JOB_ID}: απέτυχε`, error);
  } finally {
    contractCarsRunning = false;
  }
}

/**
 * Ενημερώνει τον βοηθητικό πίνακα `contract_cars` (πόσα οχήματα κάθε συμβολαίου
 * βρίσκονται μέσα). Έφυγε από τη φόρτωση του dashboard γιατί κόστιζε ~21 s ανά
 * άνοιγμα· εδώ τρέχει μία φορά ανά πέντε λεπτά, ανεξάρτητα από χρήστες.
 */
export function scheduleContractCarsRefresh() {
  const existing = cronJobs.get(CONTRACT_CARS_JOB_ID);
  if (existing) {
    existing.stop();
    cronJobs.delete(CONTRACT_CARS_JOB_ID);
  }

  const task = cron.schedule(
    CONTRACT_CARS_CRON,
    () => {
      void runContractCarsRefresh("προγραμματισμένη");
    },
    { timezone: "Europe/Athens" }
  );

  cronJobs.set(CONTRACT_CARS_JOB_ID, task);
  console.log(`[CRON] ${CONTRACT_CARS_JOB_ID}: προγραμματίστηκε (${CONTRACT_CARS_CRON})`);

  // Μία εκτέλεση στην εκκίνηση, ώστε ο πίνακας να μην είναι μπαγιάτικος μετά από deploy.
  void runContractCarsRefresh("εκκίνηση");
}

/** Χειροκίνητη εκτέλεση (σελίδα ρυθμίσεων). */
export async function runContractCarsRefreshNow() {
  await runContractCarsRefresh("χειροκίνητη");
}

/* ── Παρακολούθηση αποκλίσεων ψηφιακού πελατολογίου ──────────────────────── */

export const DEVIATIONS_JOB_ID = "internal:parking-deviations";
export const DEVIATIONS_DIGEST_JOB_ID = "internal:parking-digest";
/** Ανίχνευση κάθε 15΄ — αρκετά συχνά για άμεση ειδοποίηση, χωρίς να πιέζει το ERP. */
const DEVIATIONS_CRON = "*/15 * * * *";
/** Η σύνοψη φεύγει στο τέλος της ημέρας, όταν έχουν κλείσει οι σταθμεύσεις. */
const DIGEST_CRON = "0 21 * * *";

let deviationsRunning = false;

async function runDeviationScan(trigger: string) {
  if (deviationsRunning) {
    console.log(`[CRON] ${DEVIATIONS_JOB_ID}: προηγούμενη εκτέλεση σε εξέλιξη — παράλειψη (${trigger})`);
    return;
  }
  deviationsRunning = true;
  const startedAt = Date.now();
  try {
    const { created } = await detectDeviations();
    const { sent, failed } = await sendImmediateAlerts();
    console.log(
      `[CRON] ${DEVIATIONS_JOB_ID}: ${created.length} νέες αποκλίσεις, ${sent} άμεσα email` +
        (failed.length ? `, ${failed.length} αποτυχίες` : "") +
        ` σε ${Date.now() - startedAt} ms (${trigger})`
    );
  } catch (error) {
    // Χωρίς baseline η ανίχνευση δεν έχει νόημα· το μήνυμα το λέει καθαρά.
    console.error(`[CRON] ${DEVIATIONS_JOB_ID}: απέτυχε`, error instanceof Error ? error.message : error);
  } finally {
    deviationsRunning = false;
  }
}

async function runDigest(trigger: string) {
  try {
    const r = await sendDailyDigest();
    console.log(`[CRON] ${DEVIATIONS_DIGEST_JOB_ID}: ${r.total} αποκλίσεις, στάλθηκε=${r.sent} (${trigger})`);
  } catch (error) {
    console.error(`[CRON] ${DEVIATIONS_DIGEST_JOB_ID}: απέτυχε`, error);
  }
}

/**
 * Προγραμματίζει την παρακολούθηση αποκλίσεων. Δεν τρέχει τίποτα στην εκκίνηση:
 * η πρώτη σάρωση περιμένει τον επόμενο κύκλο, ώστε ένα restart να μη στέλνει
 * ξαφνικά email.
 */
export function scheduleDeviationMonitoring() {
  for (const [id, expr, fn] of [
    [DEVIATIONS_JOB_ID, DEVIATIONS_CRON, runDeviationScan],
    [DEVIATIONS_DIGEST_JOB_ID, DIGEST_CRON, runDigest],
  ] as const) {
    const existing = cronJobs.get(id);
    if (existing) {
      existing.stop();
      cronJobs.delete(id);
    }
    const task = cron.schedule(expr, () => { void fn("προγραμματισμένη"); }, {
      timezone: "Europe/Athens",
    });
    cronJobs.set(id, task);
    console.log(`[CRON] ${id}: προγραμματίστηκε (${expr})`);
  }
}

/* ── Ειδοποιήσεις λήξης συμβάσεων ────────────────────────────────────────── */

export const EXPIRY_JOB_ID = "internal:contract-expiry";
/**
 * Μία φορά την ημέρα, πρωί. Δεν έχει νόημα συχνότερα: η ειδοποίηση στέλνεται
 * ΜΙΑ φορά ανά σύμβαση και ημερομηνία λήξης, οπότε οι επιπλέον εκτελέσεις θα
 * έβρισκαν μόνο ήδη σταλμένες.
 */
const EXPIRY_CRON = "0 9 * * *";

async function runExpiryNotices(trigger: string) {
  try {
    const r = await sendExpiryNotices();
    console.log(
      `[CRON] ${EXPIRY_JOB_ID}: ${r.examined} συμβάσεις προς λήξη, ${r.sent} email στάλθηκαν, ` +
        `${r.skippedAlreadySent} είχαν ήδη ειδοποιηθεί, ${r.skippedNoEmail.length} χωρίς email` +
        (r.failed.length ? `, ${r.failed.length} απέτυχαν` : "") +
        ` (${trigger})`
    );
    // Οι συμβάσεις χωρίς email είναι σιωπηλή αποτυχία για τον πελάτη — δεν θα
    // μάθει ποτέ ότι λήγει. Καταγράφονται ονομαστικά για να συμπληρωθούν.
    for (const c of r.skippedNoEmail) {
      console.warn(`[CRON] ${EXPIRY_JOB_ID}: χωρίς email — INST ${c.inst} «${c.name ?? ""}»`);
    }
  } catch (error) {
    console.error(`[CRON] ${EXPIRY_JOB_ID}: απέτυχε`, error);
  }
}

export function scheduleExpiryNotices() {
  const existing = cronJobs.get(EXPIRY_JOB_ID);
  if (existing) {
    existing.stop();
    cronJobs.delete(EXPIRY_JOB_ID);
  }
  const task = cron.schedule(EXPIRY_CRON, () => { void runExpiryNotices("προγραμματισμένη"); }, {
    timezone: "Europe/Athens",
  });
  cronJobs.set(EXPIRY_JOB_ID, task);
  console.log(`[CRON] ${EXPIRY_JOB_ID}: προγραμματίστηκε (${EXPIRY_CRON})`);
}

export async function runExpiryNoticesNow() {
  await runExpiryNotices("χειροκίνητη");
}

/** Χειροκίνητη εκτέλεση (σελίδα ρυθμίσεων / script). */
export async function runDeviationScanNow() {
  await runDeviationScan("χειροκίνητη");
}

export async function runDigestNow() {
  await runDigest("χειροκίνητη");
}

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
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      const isConnectionError =
        msg.includes("Can't reach database") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENOTFOUND") ||
        (dbError as Error & { name?: string })?.name === "PrismaClientInitializationError";
      if (isConnectionError) {
        console.warn(
          "[CRON] Database unreachable - skipping cron init. Set NODE_ENV=production and ensure DATABASE_URL is reachable from this host. Will retry on next restart."
        );
      } else {
        console.error("[CRON] Database error loading integrations:", msg);
      }
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

    // Εσωτερικές εργασίες, ανεξάρτητες από τις ενσωματώσεις SoftOne.
    scheduleContractCarsRefresh();
    scheduleDeviationMonitoring();
    scheduleExpiryNotices();

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

  // Allow initializeCronJobs to run again - otherwise the guard below would
  // return early and leave the process with zero scheduled jobs.
  isInitialized = false;

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







