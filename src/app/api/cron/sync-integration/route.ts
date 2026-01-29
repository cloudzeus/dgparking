import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI, getSoftOneTableData, getSoftOneSqlData, setSoftOneData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";
import { getCronProgress, saveCronProgress, clearCronProgress } from "@/lib/cron-progress";

/**
 * POST /api/cron/sync-integration
 * 
 * SERVER-SIDE API ROUTE - Executes sync for a SoftOne integration
 * 
 * This route is called by cron jobs (server-side) to sync data between ERP and the application.
 * It requires a secret token for authentication (X-Cron-Secret header).
 * 
 * For one-way sync: Compares ERP data with local DB and updates/adds records
 * For two-way sync: Handles bidirectional synchronization
 * 
 * INSTLINES fullSync: body.fullSync=true processes all records in one request (e.g. 34k); allow long run.
 */
export const maxDuration = 1800; // 30 min for full INSTLINES sync (34k+ records; ~50ms per record)

// Logging control - set to false to reduce sync noise
const SYNC_VERBOSE_LOGGING = process.env.SYNC_VERBOSE_LOGGING === "true";

// Helper function for conditional logging
const syncLog = (...args: any[]) => {
  if (SYNC_VERBOSE_LOGGING) {
    console.log(...args);
  }
};

const syncWarn = (...args: any[]) => {
  console.warn(...args); // Always show warnings
};

const syncError = (...args: any[]) => {
  console.error(...args); // Always show errors
};

export async function POST(request: Request) {
  const startTime = Date.now();
  let userId: string | undefined;
  let logId: string | undefined;
  let integrationId: string | undefined;
  let integration: any = null;
  let responsePayload: Record<string, unknown> = {
    success: true,
    message: "Sync completed",
    stats: { erpToApp: { created: 0, updated: 0, errors: 0, synced: 0, total: 0 }, appToErp: null },
    syncDirection: "one-way",
  };

  try {
    // Verify authentication - either via cron secret (for automated jobs) or session (for manual triggers)
    const cronSecret = request.headers.get("X-Cron-Secret");
    const expectedSecret = process.env.CRON_SECRET || "change-this-secret";
    
    // Check if request is from cron job (has valid secret) or authenticated user
    const isCronRequest = cronSecret === expectedSecret;
    // Detect if this is a manual sync (from integration card) vs cron sync
    // Manual syncs don't have the X-Cron-Secret header
    const isManualSync = !isCronRequest;
    
    // If not a cron request, check for user session
    if (!isCronRequest) {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      
      if (!session?.user?.id) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
      userId = session.user.id;
    }

    const body = await request.json();
    integrationId = body.integrationId;

    if (!integrationId) {
      return NextResponse.json(
        { success: false, error: "integrationId is required" },
        { status: 400 }
      );
    }

    // Get user ID if this is a session-authenticated request (not cron)
    if (!isCronRequest && !userId) {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      userId = session?.user?.id;
    }
    
    // Load integration with connection
    integration = await prisma.softOneIntegration.findUnique({
      where: { id: integrationId },
      include: { connection: true },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: "Integration not found" },
        { status: 404 }
      );
    }

    // For cron requests, get userId from integration (required for logging)
    if (isCronRequest) {
      userId = integration.userId;
      syncLog(`[SYNC] Cron request detected - using userId from integration: ${userId}`);
    }

    // If this is a session-authenticated request, verify the integration belongs to the user (ADMIN can sync any)
    if (!isCronRequest && userId && integration.userId !== userId) {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      const isAdmin = session?.user?.role === "ADMIN";
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Unauthorized - integration does not belong to you" },
          { status: 403 }
        );
      }
    }

    const config = integration.configJson as any;
    const modelMapping = config?.modelMapping;
    const schedule = config?.schedule;

    if (!modelMapping) {
      return NextResponse.json(
        { success: false, error: "Model mapping not configured" },
        { status: 400 }
      );
    }

    const { modelName, fieldMappings, uniqueIdentifier, syncDirection: rawSyncDirection } = modelMapping;
    const { erpField, modelField } = uniqueIdentifier || {};
    if (modelName?.toUpperCase() === "INSTLINES" && (body as any).fullSync === true) {
      console.log("[INSTLINES] Full sync requested (delete all then insert all). Starting...");
    }

    // Normalize sync direction - default to "one-way" if not set
    const syncDirection = rawSyncDirection || "one-way";
    
    // Log sync direction for debugging
    if (!rawSyncDirection) {
      syncWarn(`[SYNC] WARNING: syncDirection not set in modelMapping, defaulting to "one-way"`);
    }
    syncLog(`[SYNC] Sync direction: "${syncDirection}" | Model: ${modelName}`);

    if (!modelName || !erpField || !modelField) {
      return NextResponse.json(
        { success: false, error: "Model mapping incomplete: modelName, uniqueIdentifier.erpField, and uniqueIdentifier.modelField are required" },
        { status: 400 }
      );
    }

    // Get the model dynamically
    const prismaModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const model = (prisma as any)[prismaModelName];
    if (!model) {
      syncError(`[SYNC] Model not found: ${modelName}`);
      return NextResponse.json(
        { success: false, error: `Model ${modelName} not found in Prisma client` },
        { status: 400 }
      );
    }

    // Authenticate with SoftOne
    const password = decrypt(integration.connection.passwordEnc);
    const authResult = await authenticateSoftOneAPI(
      integration.connection.username,
      password,
      String(integration.connection.appId),
      String(integration.connection.company),
      String(integration.connection.branch),
      String(integration.connection.module),
      String(integration.connection.refid),
      undefined, // version
      integration.connection.registeredName
    );

    if (!authResult.success || !authResult.clientID) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || "Failed to authenticate with SoftOne",
        },
        { status: 401 }
      );
    }

    // Get selected fields from config
    const selectedFields = config.selectedFields || [];
    const fieldsString = config.fieldsString || selectedFields.join(",");
    let filter = config.filter || "1=1"; // Base filter - will be modified for date filtering
    const objectName = integration.objectName;
    const tableName = integration.tableDbname || integration.tableName;

    // INSTLINES: optionally fetch only rows for INST (contracts) in date range or given instIds — one INST at a time for reliability
    let instlinesFilteredByInst = false;
    let instIdsForFilter: number[] | null = null;
    if (modelName.toUpperCase() === "INSTLINES") {
      const bodyInstIds = (body as any).instIds;
      const filterByDateRange = (body as any).filterByDateRange === true;
      const isCronInstlines = isCronRequest && !(body as any).fullSync;
      if (Array.isArray(bodyInstIds) && bodyInstIds.length > 0) {
        instIdsForFilter = bodyInstIds.map((id: any) => Number(id)).filter((n: number) => !isNaN(n));
      } else if (filterByDateRange || isCronInstlines) {
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const instInRange = await prisma.iNST.findMany({
          where: { WDATETO: { gte: twoMonthsAgo } },
          select: { INST: true },
        });
        instIdsForFilter = instInRange.map((r) => (typeof r.INST === "number" ? r.INST : Number(String(r.INST).replace(/^0+/, "") || 0)));
      }
      if (instIdsForFilter && instIdsForFilter.length > 0) {
        instlinesFilteredByInst = true;
        console.log(`[INSTLINES] Will fetch one INST at a time for ${instIdsForFilter.length} contracts`);
      }
    }

    if (!tableName) {
      return NextResponse.json(
        { success: false, error: "Table name not configured" },
        { status: 400 }
      );
    }

    // Determine which date fields to include for incremental sync
    // NOTE: INSTLINES is excluded - it doesn't have its own INSDATE/UPDDATE (comes from INST table)
    const modelsWithDateFields = ["ITEMS", "INST", "CUSTORMER", "PAYMENT"];
    let fieldsWithDates = fieldsString;
    
    // For INSTLINES table, filter out invalid fields that don't exist in SoftOne
    // Valid INSTLINES fields in SoftOne (verified):
    // INST, INSTLINES, LINENUM, SODTYPE, MTRL, BUSUNITS, QTY, PRICE, FROMDATE, FINALDATE,
    // COMMENTS, SNCODE, INSTLINESS, MTRUNIT, BAILTYPE, GPNT, TRDBRANCH
    // NOTE: INSDATE and UPDDATE are NOT included - they come from the associated INST table
    if (tableName.toUpperCase() === "INSTLINES" || modelName.toUpperCase() === "INSTLINES") {
      const validInstLinesFields = [
        "INST", "INSTLINES", "LINENUM", "SODTYPE", "MTRL", "BUSUNITS", "QTY", "PRICE",
        "FROMDATE", "FINALDATE", "COMMENTS", "SNCODE", "INSTLINESS", "MTRUNIT",
        "BAILTYPE", "GPNT", "TRDBRANCH"
        // INSDATE and UPDDATE removed - they come from INST table
      ];
      
      const fieldsArray = fieldsString.split(",").map(f => f.trim().toUpperCase());
      const filteredFields = fieldsArray.filter(field => 
        validInstLinesFields.includes(field.toUpperCase())
      );
      
      // Remove INSDATE and UPDDATE if they were in the original fields list
      const filteredFieldsWithoutDates = filteredFields.filter(f => 
        f !== "INSDATE" && f !== "UPDDATE"
      );
      
      // Ensure critical fields are included
      if (!filteredFieldsWithoutDates.includes("INSTLINES")) filteredFieldsWithoutDates.unshift("INSTLINES");
      if (!filteredFieldsWithoutDates.includes("INST")) filteredFieldsWithoutDates.push("INST");
      
      fieldsWithDates = filteredFieldsWithoutDates.join(",");
      syncLog(`[SYNC] Filtered INSTLINES fields for GetTable: ${fieldsWithDates}`);
      syncLog(`[SYNC] Removed invalid fields: ${fieldsArray.filter(f => !validInstLinesFields.includes(f.toUpperCase())).join(", ") || "none"}`);
    }
    
    // Check if INSDATE and UPDDATE are already in the fields list
    const fieldsArray = fieldsWithDates.split(",").map(f => f.trim().toUpperCase());
    const hasInsDate = fieldsArray.includes("INSDATE");
    const hasUpdDate = fieldsArray.includes("UPDDATE");
    
    // Only add date fields if they're not already present and the model supports them
    if (modelsWithDateFields.includes(modelName.toUpperCase())) {
      if (!hasInsDate) {
        fieldsWithDates = fieldsWithDates ? `${fieldsWithDates},INSDATE` : "INSDATE";
      }
      if (!hasUpdDate) {
        fieldsWithDates = fieldsWithDates ? `${fieldsWithDates},UPDDATE` : "UPDDATE";
      }
    }

    // Get last sync timestamp
    const lastSyncAt = integration.lastSyncAt;
    let filters: string | undefined;
    let formattedDate: string | undefined;

    // Format date as "YYYY-MM-DD HH:MM:SS" (SoftOne expects this format) if we have lastSyncAt
    if (lastSyncAt) {
      const lastSyncDate = new Date(lastSyncAt);
      const year = lastSyncDate.getFullYear();
      const month = String(lastSyncDate.getMonth() + 1).padStart(2, '0');
      const day = String(lastSyncDate.getDate()).padStart(2, '0');
      const hours = String(lastSyncDate.getHours()).padStart(2, '0');
      const minutes = String(lastSyncDate.getMinutes()).padStart(2, '0');
      const seconds = String(lastSyncDate.getSeconds()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }


    // Build FILTER and FILTERS for incremental sync if we have a lastSyncAt and the model supports date fields
    // CRITICAL: Manual "Sync Now" should ALWAYS get all records - skip date filtering for manual syncs
    // According to SoftOne Web Services docs: https://www.softone.gr/ws/
    // FILTERS format: "TABLE.FIELD=value&TABLE.FIELD2=value2" (using & as OR separator)
    // FILTER format: SQL WHERE clause like "INSDATE>'2024-01-01 00:00:00' OR UPDDATE>'2024-01-01 00:00:00'"
    // We'll use both FILTER (SQL) and FILTERS (if GetTable supports it) to ensure filtering works
    if (lastSyncAt && !isManualSync && modelsWithDateFields.includes(modelName.toUpperCase()) && formattedDate) {
      
      // Build FILTER (SQL WHERE clause) - this is the primary filter for GetTable service
      // Format: "(INSDATE>'2024-01-01 00:00:00' OR UPDDATE>'2024-01-01 00:00:00')"
      // FILTER uses field names WITHOUT table prefix (SQL WHERE clause format)
      const dateFilter = `(INSDATE>'${formattedDate}' OR UPDDATE>'${formattedDate}')`;
      if (filter === "1=1") {
        filter = dateFilter;
      } else {
        filter = `(${filter}) AND ${dateFilter}`;
      }
      
      // Also build FILTERS string (if GetTable supports it)
      // Format: "TABLE.INSDATE>YYYY-MM-DD HH:MM:SS&TABLE.UPDDATE>YYYY-MM-DD HH:MM:SS"
      // FILTERS uses table prefix (TABLE.FIELD format)
      const tableNameUpper = tableName.toUpperCase();
      filters = `${tableNameUpper}.INSDATE>${formattedDate}&${tableNameUpper}.UPDDATE>${formattedDate}`;
      
      console.log(`[SYNC] ✅ MODIFIED FILTER to include date filtering: ${filter}`);
      console.log(`[SYNC] Also using FILTERS (if supported): ${filters}`);
      console.log(`[SYNC] SoftOne will return records where INSDATE > ${formattedDate} OR UPDDATE > ${formattedDate}`);
    } else if (!lastSyncAt) {
      console.log(`[SYNC] ⚠️ First sync - no lastSyncAt, fetching all records (FILTER remains: ${filter})`);
      filters = undefined; // Explicitly set to undefined for first sync
    } else {
        syncLog(`[SYNC] Model ${modelName} does not support incremental sync - fetching all records`);
      filters = undefined; // No date filtering for models without date fields
    }
    

    // Determine if we should use SqlData service (for optimized incremental sync)
    // SqlData uses pre-defined SQL scripts for INST, INSTLINES, TRDR, MTRL tables
    // Map both table names and model names to SQL script IDs (numeric as strings)
    const sqlDataMapping: Record<string, string> = {
      // Table names - using SQL script IDs
      "INST": "135",
      "INSTLINES": "136",
      "TRDR": "137",
      "MTRL": "138",
      // Model names (for cases where table name differs)
      "CUSTORMER": "137", // CUSTORMER model uses TRDR table (ID: 137)
      "ITEMS": "138", // ITEMS model uses MTRL table (ID: 138)
    };
    
    const tableNameUpper = tableName.toUpperCase();
    const modelNameUpper = modelName.toUpperCase();
    // Try table name first, then model name
    const sqlName = sqlDataMapping[tableNameUpper] || sqlDataMapping[modelNameUpper];
    
    // isManualSync is already defined above (after isCronRequest)
    const isFirstSync = !lastSyncAt;
    
    // Determine if we should use SqlData
    // RULE: 
    // - For INST, INSTLINES, TRDR, MTRL (tables with SqlData scripts):
    //   → First sync (no lastSyncAt) + Manual sync → Use GetTable (to get all data)
    //   → After first sync (has lastSyncAt) + Manual sync → Use SqlData with "2022-01-01 00:00:00" (all records)
    //   → Cron first sync → Use SqlData with "2022-01-01 00:00:00" to get all historical data
    //   → Cron incremental → Use SqlData with lastSyncAt to get only new/updated records
    // - For other tables: Manual sync uses GetTable, Cron uses SqlData if available
    let shouldUseSqlData = false;
    // CRITICAL: For manual syncs, always use 2022-01-01 to get all records
    // Initialize with 2022 for manual syncs, formattedDate for cron incremental
    let sqlDataParamDate = isManualSync ? "2022-01-01 00:00:00" : formattedDate;
    
    const isInst = tableNameUpper === "INST" || modelNameUpper === "INST";
    const isInstLines = tableNameUpper === "INSTLINES" || modelNameUpper === "INSTLINES";
    const isInstOrInstLines = isInst || isInstLines;
    
    if (sqlName) {
      // We have a SqlData script for this table
      if (isInstOrInstLines) {
        // For INST and INSTLINES: Use GetTable for manual syncs, SqlData for cron
        // CRITICAL: Manual "Sync Now" should use GetTable to get ALL records (no date filter)
        // SqlData might not return all records reliably
        if (isManualSync) {
          // Manual sync → Use GetTable (no date filter, gets all records)
          shouldUseSqlData = false;
        } else {
          // Cron sync → Use SqlData
          shouldUseSqlData = true;
          if (isFirstSync) {
            // First sync from cron → use 2022 date to get all records since 2022
            sqlDataParamDate = "2022-01-01 00:00:00";
          } else {
            // Incremental sync (cron only) → use lastSyncAt to get only new/updated records
            sqlDataParamDate = formattedDate!;
          }
        }
      } else {
        // For other tables (TRDR, MTRL): Use GetTable for manual syncs, SqlData for cron
        // CRITICAL: Manual "Sync Now" should use GetTable to get ALL records (no date filter)
        // SqlData might not return all records, so use GetTable for reliability
        if (isManualSync) {
          // Manual sync → Use GetTable (no date filter, gets all records)
          shouldUseSqlData = false;
        } else {
          // Cron sync → Use SqlData
          shouldUseSqlData = true;
          if (isFirstSync) {
            // First sync (cron) - use 2022 date to get all records since 2022
            sqlDataParamDate = "2022-01-01 00:00:00";
          } else {
            // Incremental sync (cron only) - use lastSyncAt to get only new/updated records
            sqlDataParamDate = formattedDate!;
          }
        }
      }
    } else if (isManualSync) {
      // Manual sync for tables without SqlData script - use GetTable
      shouldUseSqlData = false;
    } else {
      // Cron job for tables without SqlData script - use GetTable
      shouldUseSqlData = false;
    }
    // INSTLINES filtered by INST (instIds or date range): must use GetTable with INST IN (...) filter
    if (instlinesFilteredByInst) {
      shouldUseSqlData = false;
    }

    // Minimal logging for sync method decision
    if (shouldUseSqlData) {
      const syncType = (isManualSync || isFirstSync) ? 'Full sync (all records since 2022)' : 'Incremental';
      const origin = isManualSync ? 'Manual' : 'Cron';
      syncLog(`[SYNC] ${tableName} → SqlData (${sqlName})`);
      
      // Special logging for INSTLINES
      if (isInstLines) {
        syncLog(`[SYNC] INSTLINES using SqlData`);
      }
    } else {
      const origin = isManualSync ? 'Manual' : 'Cron';
      let reason = 'no SQL script';
      if (isInstOrInstLines && isFirstSync && isManualSync) {
        reason = 'first sync from integration card (using GetTable)';
      } else if (isInstLines) {
        reason = 'INSTLINES (using GetTable with filtered fields)';
      }
      console.log(`[SYNC] ${tableName} | ${origin} → GetTable (${reason})`);
      
      // Special logging for INSTLINES
      if (isInstLines) {
        console.log(`[SYNC] INSTLINES sync: Using GetTable with FILTER: ${filter}`);
      }
    }
    
    let erpDataResult: any;
    
    if (shouldUseSqlData) {
      // Use SqlData service for optimized incremental sync
      
      // Log exact POST object for MTRL
      if (tableNameUpper === "MTRL" || modelNameUpper === "ITEMS") {
        const postObject = {
          service: "SqlData",
          clientID: authResult.clientID,
          appId: integration.connection.appId,
          SqlName: sqlName,
          param1: sqlDataParamDate,
        };
        console.log(`[ITEMS/MTRL SqlData] ${isManualSync ? 'MANUAL SYNC' : 'CRON SYNC'} - Getting ${isManualSync || isFirstSync ? 'ALL records since 2022' : 'incremental records'}`);
        console.log(`[ITEMS/MTRL SqlData] sqlDataParamDate value: "${sqlDataParamDate}" (isManualSync: ${isManualSync}, isFirstSync: ${isFirstSync}, lastSyncAt: ${lastSyncAt})`);
        console.log(`[ITEMS/MTRL SqlData] EXACT POST OBJECT:`, JSON.stringify(postObject, null, 2));
      }
      
      // Use sqlDataParamDate (which is either formattedDate or "2022-01-01 00:00:00" for first sync)
      if (modelName.toUpperCase() === "ITEMS" || tableNameUpper === "MTRL") {
        console.log(`[ITEMS/MTRL] Calling getSoftOneSqlData with: sqlName=${sqlName}, param1="${sqlDataParamDate}", clientID=${authResult.clientID?.substring(0, 20)}...`);
      }
      const sqlDataResult = await getSoftOneSqlData(
        sqlName,
        sqlDataParamDate,
        authResult.clientID,
        integration.connection.appId
      );
      
      if (modelName.toUpperCase() === "ITEMS" || tableNameUpper === "MTRL") {
        console.log(`[ITEMS/MTRL] SqlData response: success=${sqlDataResult.success}, rows=${sqlDataResult.rows?.length || 0}, error=${sqlDataResult.error || 'none'}`);
        if (!sqlDataResult.success) {
          console.error(`[ITEMS/MTRL] SqlData failed:`, sqlDataResult);
        }
      }
      
      // Convert SqlData response format to match GetTable format
      if (sqlDataResult.success && sqlDataResult.rows) {
        erpDataResult = {
          success: true,
          data: sqlDataResult.rows, // SqlData returns 'rows', GetTable returns 'data'
          count: sqlDataResult.totalcount || sqlDataResult.rows.length,
          keys: sqlDataResult.rows.length > 0 ? Object.keys(sqlDataResult.rows[0]) : [],
        };
      } else {
        // SqlData failed - log error and fallback to GetTable
        syncWarn(`[SYNC] SqlData failed, falling back to GetTable`);
        
        // Fallback to GetTable service
        shouldUseSqlData = false; // Set flag to use GetTable instead
        erpDataResult = null; // Will be set in the else block below
      }
    }

    // INSTLINES filtered by INST: fetch one contract at a time (reliable, no filter length limits)
    if (instlinesFilteredByInst && instIdsForFilter && instIdsForFilter.length > 0) {
      const combinedData: any[] = [];
      let keysFromFirst: string[] = [];
      for (let i = 0; i < instIdsForFilter.length; i++) {
        const instId = instIdsForFilter[i];
        const res = await getSoftOneTableData(
          tableName,
          fieldsWithDates,
          authResult.clientID,
          String(integration.connection.appId),
          `INST=${instId}`,
          "1"
        );
        if (!res.success) {
          console.warn(`[INSTLINES] GetTable INST=${instId} failed:`, res.error);
          continue;
        }
        const raw = res.data || [];
        if (raw.length && keysFromFirst.length === 0) keysFromFirst = (res.keys as string[]) || [];
        combinedData.push(...raw);
        if ((i + 1) % 50 === 0) {
          console.log(`[INSTLINES] Fetched ${i + 1}/${instIdsForFilter.length} contracts, ${combinedData.length} rows so far`);
        }
      }
      erpDataResult = { success: true, data: combinedData, keys: keysFromFirst, count: combinedData.length };
      console.log(`[INSTLINES] One-by-one fetch done: ${combinedData.length} total INSTLINES from ${instIdsForFilter.length} contracts`);
    }
    
    // Use GetTable service (for first sync, tables not using SqlData, or if SqlData failed)
    if (!shouldUseSqlData || !erpDataResult) {
      if (modelName.toUpperCase() === "ITEMS" || tableNameUpper === "MTRL") {
        console.log(`[ITEMS/MTRL] Using GetTable (manual sync or SqlData not available)`);
        console.log(`[ITEMS/MTRL] TABLE=${tableName}, FIELDS=${fieldsWithDates}`);
        console.log(`[ITEMS/MTRL] FILTER=${filter} (isManualSync: ${isManualSync}, should be "1=1" for manual sync)`);
      } else if (modelName.toUpperCase() === "INST" || tableNameUpper === "INST") {
        console.log(`[INST] Using GetTable (${isManualSync ? 'MANUAL SYNC' : 'CRON SYNC'})`);
        console.log(`[INST] TABLE=${tableName}, FIELDS=${fieldsWithDates}`);
        console.log(`[INST] FILTER=${filter} (isManualSync: ${isManualSync}, should be "1=1" for manual sync)`);
      } else if (SYNC_VERBOSE_LOGGING && (tableName.toUpperCase() === "INSTLINES" || modelName.toUpperCase() === "INSTLINES")) {
        syncLog(`[INSTLINES GetTable] TABLE=${tableName}, FIELDS=${fieldsWithDates}, FILTER=${filter}`);
      }
      if ((tableName.toUpperCase() === "INSTLINES" || modelName.toUpperCase() === "INSTLINES") && !erpDataResult) {
        console.log("[INSTLINES] Fetching from ERP (may take a few minutes for 34k records)...");
      }
      if (!erpDataResult) {
        erpDataResult = await getSoftOneTableData(
        tableName,
        fieldsWithDates,
        authResult.clientID,
        integration.connection.appId,
        filter, // For manual syncs, this should be "1=1" (no filter) to get all records
        "1",
        filters // Also pass FILTERS as fallback (if GetTable supports it)
      );
      
      if (modelName.toUpperCase() === "ITEMS" || tableNameUpper === "MTRL") {
        console.log(`[ITEMS/MTRL] GetTable response: success=${erpDataResult.success}, count=${erpDataResult.data?.length || erpDataResult.count || 0}`);
        if (!erpDataResult.success) {
          console.error(`[ITEMS/MTRL] GetTable failed:`, erpDataResult.error);
        }
      } else if (modelName.toUpperCase() === "INST" || tableNameUpper === "INST") {
        console.log(`[INST] GetTable response: success=${erpDataResult.success}, count=${erpDataResult.data?.length || erpDataResult.count || 0}`);
        if (!erpDataResult.success) {
          console.error(`[INST] GetTable failed:`, erpDataResult.error);
        }
      }
      
      // Log error details for INSTLINES if GetTable failed
      if ((tableName.toUpperCase() === "INSTLINES" || modelName.toUpperCase() === "INSTLINES") && !erpDataResult.success) {
        console.error(`[INSTLINES GetTable] Error: ${erpDataResult.error}`);
        console.error(`[INSTLINES GetTable] Fields sent: ${fieldsWithDates}`);
        console.error(`[INSTLINES GetTable] Filter: ${filter}`);
      }
    }

    if (!erpDataResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: erpDataResult.error || "Failed to fetch data from SoftOne",
        },
        { status: 500 }
      );
    }

    // Log how many records we got from SoftOne
    const rawRecordCount = erpDataResult.data?.length || erpDataResult.count || 0;
    console.log(`[SYNC] Fetched ${rawRecordCount} records from ${tableName}`);
    if (modelName.toUpperCase() === "INSTLINES" && instlinesFilteredByInst) {
      if (rawRecordCount === 0) {
        console.warn("[INSTLINES] ERP returned 0 records with INST filter. Check filter format or that those contracts have plates in ERP.");
      } else {
        console.log(`[INSTLINES] ERP returned ${rawRecordCount} INSTLINES for filtered INST (will upsert to DB)`);
      }
    }
    if (modelName.toUpperCase() === "ITEMS" || tableNameUpper === "MTRL") {
      console.log(`[ITEMS/MTRL] ✅ Fetched ${rawRecordCount} records from ERP (${isManualSync ? 'MANUAL SYNC - all records' : 'CRON SYNC - incremental'})`);
      if (rawRecordCount > 0 && erpDataResult.data && erpDataResult.data.length > 0) {
        console.log(`[ITEMS/MTRL] First record sample:`, JSON.stringify(erpDataResult.data[0], null, 2));
        console.log(`[ITEMS/MTRL] Available fields in first record:`, Object.keys(erpDataResult.data[0]).join(", "));
      }
    }

    // Transform data: SoftOne returns data as array of arrays with keys array
    // SqlData returns 'rows' as array of objects, GetTable returns 'data' as array of arrays
    // Convert to array of objects for easier processing
    let erpRecords: any[] = [];
    const rawData = erpDataResult.data || [];
    const keys = erpDataResult.keys || selectedFields || [];
    
    // Handle data transformation based on format
    if (rawData && rawData.length > 0) {
      const firstItem = rawData[0];
      
      if (Array.isArray(firstItem)) {
        // GetTable format: array of arrays - transform to array of objects
        const fieldNames = (Array.isArray(keys) && keys.length > 0) ? keys : selectedFields;
        erpRecords = rawData.map((row: any[]) => {
          const rowObj: any = {};
          fieldNames.forEach((fieldName: string, index: number) => {
            if (fieldName && fieldName.trim() !== "" && fieldName.toUpperCase() !== "MYDUMMY") {
              rowObj[fieldName] = row[index] ?? null;
            }
          });
          return rowObj;
        });
      } else if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
        // SqlData format: already array of objects - use as is
        erpRecords = rawData;
      } else {
        syncWarn(`[SYNC] Unknown data format`);
      }
    }

    // INSTLINES: resume from saved progress (survives app restart), 500 per batch — or fullSync / filtered sync process all in one request
    let originalInstlinesTotal: number | null = null;
    let instlinesOffset = 0;
    let instlinesLimit = 500;
    const instlinesCompletedIds: number[] = [];
    const instlinesFullSync = (body as any).fullSync === true;
    if (modelName.toUpperCase() === "INSTLINES") {
      originalInstlinesTotal = erpRecords.length;
      if (instlinesFullSync) {
        // One-time full load: process ALL records in this request (no slice)
        instlinesOffset = 0;
        instlinesLimit = erpRecords.length;
        console.log(`[INSTLINES] Full sync: got ${erpRecords.length} records from ERP; will delete all then insert in batches`);
      } else if (instlinesFilteredByInst) {
        // Filtered by INST (Sync plates from contracts or cron date range): process ALL fetched records in this request, no resume
        instlinesOffset = 0;
        instlinesLimit = erpRecords.length;
        console.log(`[INSTLINES] Filtered sync: processing all ${erpRecords.length} records in this request (no resume)`);
      } else {
        instlinesLimit = Math.min(500, Math.max(1, Number((body as any).limit) || 500));
        // Prefer saved progress so we resume after restart; override with body.offset if provided
        const bodyOffset = (body as any).offset;
        if (bodyOffset !== undefined && bodyOffset !== null && Number(bodyOffset) >= 0) {
          instlinesOffset = Math.max(0, Number(bodyOffset));
        } else {
          try {
            const progress = await getCronProgress("sync-integration", integrationId, "INSTLINES");
            if (progress && progress.lastOffset > 0) {
              instlinesOffset = Math.min(progress.lastOffset, erpRecords.length);
              console.log(`[INSTLINES] Resuming from saved progress: offset ${instlinesOffset} (total ${originalInstlinesTotal})`);
            }
          } catch (e) {
            console.warn("[INSTLINES] Could not load cron progress:", e);
          }
        }
        erpRecords = erpRecords.slice(instlinesOffset, instlinesOffset + instlinesLimit);
        if (instlinesOffset > 0 || erpRecords.length < originalInstlinesTotal) {
          console.log(`[INSTLINES] Processing ${erpRecords.length} records (offset ${instlinesOffset}, limit ${instlinesLimit}) of ${originalInstlinesTotal} total`);
        }
      }
    }

    // INSTLINES fullSync: require INST (contracts) to exist first; then delete all INSTLINES and re-insert from ERP
    if (modelName.toUpperCase() === "INSTLINES" && instlinesFullSync && erpRecords.length > 0) {
      const instCount = await prisma.iNST.count();
      if (instCount === 0) {
        console.warn("[INSTLINES] Full sync aborted: no INST (contracts) in database. Sync INST first.");
        return NextResponse.json(
          {
            success: false,
            error: "INSTLINES full sync requires INST (contracts) to be synced first. Go to Integrations, sync the INST integration, then run INSTLINES sync again.",
          },
          { status: 400 }
        );
      }
      const deleted = await prisma.iNSTLINES.deleteMany({});
      console.log(`[INSTLINES] Full sync: deleted ${deleted.count} existing INSTLINES; will re-insert ${erpRecords.length} from ERP (${instCount} INST contracts available)`);
    }

    const totalRecords = erpRecords.length;
    if (totalRecords > 0) {
      console.log(`[SYNC] Processing ${totalRecords} records from ERP`);
      if (modelName.toUpperCase() === "ITEMS") {
        console.log(`[ITEMS] Transformed ${totalRecords} records. First record keys:`, Object.keys(erpRecords[0]).join(", "));
        console.log(`[ITEMS] Unique identifier field (erpField): "${erpField}", modelField: "${modelField}"`);
        if (erpRecords[0][erpField] !== undefined) {
          console.log(`[ITEMS] First record ${erpField} value:`, erpRecords[0][erpField]);
        } else {
          console.warn(`[ITEMS] ⚠️ First record missing ${erpField} field! Available fields:`, Object.keys(erpRecords[0]).join(", "));
        }
      }
    } else if (rawData && rawData.length > 0) {
      syncError(`[SYNC] Transformation failed! rawData.length: ${rawData.length}, erpRecords.length: ${erpRecords.length}`);
      if (modelName.toUpperCase() === "ITEMS") {
        console.error(`[ITEMS] Transformation failed. Raw data sample:`, rawData[0]);
        console.error(`[ITEMS] Keys from rawData:`, keys);
      }
    }

    // OPTIMIZATION: For large datasets, fetch existing records in chunks to avoid memory issues
    // MySQL has a limit on IN clause size (typically 1000 items)
    const CHUNK_SIZE = 1000;
    let existingRecordsMap: Map<any, any> = new Map();
    
    // OPTIMIZATION: For INSTLINES, pre-fetch all INST records to avoid individual lookups
    // Also fetch TRDR (customer) to validate contracts have customers
    let instRecordsMap: Map<number, { INST: number; TRDR: string | null }> = new Map();
    if (modelName.toUpperCase() === "INSTLINES") {
      try {
        const allInsts = await prisma.iNST.findMany({
          select: { INST: true, TRDR: true },
        });
        
        // Create a map of normalized INST values for quick lookup
        // Store both INST and TRDR to validate contracts have customers
        allInsts.forEach(inst => {
          const normalizedInst = typeof inst.INST === 'string' 
            ? Number(String(inst.INST).replace(/^0+/, '') || '0')
            : inst.INST;
          instRecordsMap.set(normalizedInst, { INST: inst.INST, TRDR: inst.TRDR });
        });
        
        const instsWithTrdr = allInsts.filter(inst => inst.TRDR).length;
        console.log(`[SYNC] Pre-fetched ${allInsts.length} INST records (${instsWithTrdr} with TRDR/customer)`);
      } catch (instFetchError) {
        console.error(`[SYNC] Error pre-fetching INST records:`, instFetchError);
      }
    }
    
    if (totalRecords > 0) {
      try {
        // Extract all unique identifier values from ERP records and normalize them
        // Normalize types to match database types
        // IMPORTANT: MTRL (ITEMS model) and TRDR (CUSTORMER model) are String fields, not numeric
        const erpUniqueValues = erpRecords
          .map(record => {
            let value = record[erpField] ?? record[erpField.toLowerCase()] ?? record[erpField.toUpperCase()];
            if (value === undefined || value === null) return null;
            
            // Normalize based on model and field type
            // MTRL (ITEMS) and TRDR (CUSTORMER) are String fields - keep as string
            // INST, INSTLINES, PAYMENT, COUNTRY, VAT, SOCURRENCY, TRDCATEGORY use Int primary keys - convert to number
            if (modelName.toUpperCase() === "ITEMS" || modelName.toUpperCase() === "CUSTORMER") {
              // Keep as string for MTRL and TRDR fields
              value = String(value);
            } else if (["INST", "INSTLINES", "PAYMENT", "COUNTRY", "VAT", "SOCURRENCY", "TRDCATEGORY"].includes(modelName.toUpperCase())) {
              // Convert to number for numeric ID fields (Prisma Int)
              if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
                value = Number(value);
              } else if (value === '' || value === null) {
                return null;
              }
            }
            
            return value;
          })
          .filter((v): v is any => v !== null && v !== '');

        // CRITICAL FIX: For INSTLINES and INST, fetch ALL existing records from DB
        // This ensures we don't try to CREATE records that already exist
        // For other models, we can still use the optimized approach of checking only ERP values
        const shouldFetchAllRecords = modelName.toUpperCase() === "INSTLINES" || modelName.toUpperCase() === "INST";
        
        syncLog(`[SYNC] Checking existing records (model: ${modelName}, ERP values: ${erpUniqueValues.length})`);
        
        if (shouldFetchAllRecords) {
          // Fetch ALL existing records for INSTLINES/INST to avoid unique constraint errors
          syncLog(`[SYNC] Fetching ALL existing ${modelName} records from database...`);
          
          const primaryKeyFieldForLookup = modelName.toUpperCase() === "INSTLINES" ? "INSTLINES" :
                                         modelName.toUpperCase() === "INST" ? "INST" :
                                         modelField;
          
          // Fetch in chunks to avoid memory issues
          const CHUNK_SIZE_FETCH = 1000;
          let offset = 0;
          let allExistingRecords: any[] = [];
          
          while (true) {
            const existingRecords = await model.findMany({
              select: {
                [primaryKeyFieldForLookup]: true,
                [modelField]: true,
              },
              take: CHUNK_SIZE_FETCH,
              skip: offset,
            });
            
            if (existingRecords.length === 0) break;
            
            allExistingRecords.push(...existingRecords);
            offset += CHUNK_SIZE_FETCH;
            
            if (existingRecords.length < CHUNK_SIZE_FETCH) break; // Last chunk
          }
          
          syncLog(`[SYNC] Fetched ${allExistingRecords.length} existing ${modelName} records`);
          
          // Add all records to map
          const primaryKeyFieldForMap = modelName.toUpperCase() === "INSTLINES" ? "INSTLINES" :
                                       modelName.toUpperCase() === "INST" ? "INST" :
                                       modelField;
          
          let mapAddCount = 0;
          allExistingRecords.forEach(record => {
            const key = record[primaryKeyFieldForMap] ?? record[modelField];
            
            if (modelName.toUpperCase() === "INST" || modelName.toUpperCase() === "INSTLINES") {
              const numKey = typeof key === 'number' ? key : Number(String(key).replace(/^0+/, '') || '0');
              if (!isNaN(numKey) && numKey !== 0) {
                existingRecordsMap.set(numKey, record);
                existingRecordsMap.set(String(numKey), record);
                mapAddCount++;
              } else {
                console.warn(`[SYNC] Skipping invalid key: ${key} (normalized to ${numKey})`);
              }
            } else {
              existingRecordsMap.set(key, record);
              if (typeof key === 'number') {
                existingRecordsMap.set(String(key), record);
              } else if (typeof key === 'string' && !isNaN(Number(key))) {
                existingRecordsMap.set(Number(key), record);
              }
              mapAddCount++;
            }
          });
          
          syncLog(`[SYNC] Added ${mapAddCount} records to map (size: ${existingRecordsMap.size})`);
          
          // Verify map integrity (only in verbose mode)
          if (SYNC_VERBOSE_LOGGING && modelName.toUpperCase() === "INSTLINES") {
            const testKey1 = existingRecordsMap.has(1) || existingRecordsMap.has('1');
            if (!testKey1) {
              syncError(`[SYNC] CRITICAL: Map missing INSTLINES=1!`);
            }
          }
        } else if (erpUniqueValues.length > 0) {
          // For other models, use optimized approach: only check ERP values
          const uniqueValuesSet = [...new Set(erpUniqueValues)]; // Remove duplicates
          syncLog(`[SYNC] Checking ${uniqueValuesSet.length} unique identifiers...`);
          
          // Models whose primary key is Int (Prisma) - chunk must be numbers for findMany
          const intPkModels = ["INST", "INSTLINES", "PAYMENT", "COUNTRY", "VAT", "SOCURRENCY", "TRDCATEGORY"];
          const chunkNeedsNumbers = intPkModels.includes(modelName.toUpperCase());

          for (let i = 0; i < uniqueValuesSet.length; i += CHUNK_SIZE) {
            let chunk = uniqueValuesSet.slice(i, i + CHUNK_SIZE);
            if (chunkNeedsNumbers) {
              chunk = chunk.map((v: unknown) => (typeof v === "number" && !isNaN(v)) ? v : Number(String(v).replace(/^0+/, "") || 0)).filter((n: number) => !isNaN(n));
            }

            // CRITICAL: For INST/INSTLINES, use primary key field for lookup
            const primaryKeyFieldForLookup = modelName.toUpperCase() === "INSTLINES" ? "INSTLINES" :
                                           modelName.toUpperCase() === "INST" ? "INST" :
                                           modelField;

            // CRITICAL: Only query database for records that exist - don't include ERP records
            const existingRecords = await model.findMany({
              where: {
                [primaryKeyFieldForLookup]: {
                  in: chunk,
                },
              },
              select: {
                [primaryKeyFieldForLookup]: true,
                [modelField]: true, // Also select modelField for compatibility
              },
            });
            
            syncLog(`[SYNC] Chunk ${Math.floor(i/CHUNK_SIZE) + 1}: Found ${existingRecords.length}/${chunk.length} existing records`);
            
            // Add to map for O(1) lookup - normalize types for consistent lookup
            // CRITICAL: For INST/INSTLINES, use the primary key field, not modelField
            const primaryKeyFieldForMap = modelName.toUpperCase() === "INSTLINES" ? "INSTLINES" :
                                         modelName.toUpperCase() === "INST" ? "INST" :
                                         modelField;
            
            existingRecords.forEach(record => {
              // Use primary key field for INST/INSTLINES
              const key = record[primaryKeyFieldForMap] ?? record[modelField];
              
              // For INST/INSTLINES, ensure we store as number (primary key is Int)
              if (modelName.toUpperCase() === "INST" || modelName.toUpperCase() === "INSTLINES") {
                const numKey = typeof key === 'number' ? key : Number(String(key).replace(/^0+/, '') || '0');
                if (!isNaN(numKey) && numKey !== 0) {
                  existingRecordsMap.set(numKey, record);
                  existingRecordsMap.set(String(numKey), record); // Also store as string for lookup
                  
                } else {
                  syncWarn(`[SYNC] Skipping invalid key: ${key}`);
                }
              } else {
                // For other models, store both string and number versions
                existingRecordsMap.set(key, record);
                if (typeof key === 'number') {
                  existingRecordsMap.set(String(key), record);
                } else if (typeof key === 'string' && !isNaN(Number(key))) {
                  existingRecordsMap.set(Number(key), record);
                }
              }
            });
            
          }
          
          syncLog(`[SYNC] Existing records map: ${existingRecordsMap.size} entries`);
          
          if (existingRecordsMap.size === 0 && erpUniqueValues.length > 0) {
            syncWarn(`[SYNC] No existing records found - all will be created`);
          }
        }
      } catch (error) {
        syncError(`[SYNC] Error fetching existing records:`, error);
        // Continue with empty map - will treat all as new records
      }
    }

    // Stats tracking
    let created = 0;
    let updated = 0;
    let errors = 0;
    let synced = 0;

    // Prepare batch operations - use upsert for all records
    const recordsToUpsert: Array<{ where: any; create: any; update: any }> = [];

    // OPTIMIZATION: Process records in chunks with progress logging for large datasets
    const PROCESS_CHUNK_SIZE = 500;
    let processedCount = 0;
    let skippedCount = 0;
    let skippedReasons: Record<string, number> = {};
    
    // Process each ERP record
    for (const erpRecord of erpRecords) {
      processedCount++;
      
      // Log progress for large datasets (only every 1000 records to reduce noise)
      if (totalRecords > 1000 && processedCount % 1000 === 0) {
        const progress = ((processedCount / totalRecords) * 100).toFixed(1);
        const newInQueue = recordsToUpsert.filter(r => r.isNew).length;
        const updatedInQueue = recordsToUpsert.filter(r => !r.isNew).length;
        console.log(`[SYNC] ${processedCount}/${totalRecords} (${progress}%) - Queue: ${recordsToUpsert.length} (${newInQueue} new, ${updatedInQueue} updated)`);
      }
      try {
        // Get unique identifier value from ERP record
        let erpUniqueValue = erpRecord[erpField] ?? erpRecord[erpField.toLowerCase()] ?? erpRecord[erpField.toUpperCase()];
        if (!erpUniqueValue && erpUniqueValue !== 0) {
          // Log more details about the skipped record for debugging
          skippedCount++;
          skippedReasons[`missing_${erpField}`] = (skippedReasons[`missing_${erpField}`] || 0) + 1;
          if (modelName.toUpperCase() === "ITEMS" && skippedCount <= 3) {
            const availableFields = Object.keys(erpRecord).slice(0, 10).join(", "); // First 10 fields
            const recordSample = JSON.stringify(erpRecord).substring(0, 200); // First 200 chars
            console.warn(`[ITEMS] Skipping record ${skippedCount} - missing unique identifier field "${erpField}"`);
            console.warn(`[ITEMS] Available fields in record: ${availableFields}${Object.keys(erpRecord).length > 10 ? "..." : ""}`);
            console.warn(`[ITEMS] Record sample: ${recordSample}...`);
          }
          continue;
        }

        // Normalize the unique value type for consistent map lookup
        // IMPORTANT: MTRL (ITEMS model) is a String field, not numeric
        // Only convert to number for models that actually use numeric IDs
        let normalizedUniqueValue: any = erpUniqueValue;
        const numericIdModels = ["INST", "INSTLINES", "PAYMENT"]; // MTRL is String, not included
        if (numericIdModels.includes(modelName.toUpperCase()) && typeof erpUniqueValue === 'string' && !isNaN(Number(erpUniqueValue)) && erpUniqueValue.trim() !== '') {
          // Convert string numbers to numbers for models with numeric IDs
          normalizedUniqueValue = Number(erpUniqueValue);
        } else if (modelName.toUpperCase() === "ITEMS" || modelName.toUpperCase() === "CUSTORMER") {
          // ITEMS (MTRL) and CUSTORMER (TRDR) use String fields - keep as string
          normalizedUniqueValue = String(erpUniqueValue);
        }

        // Check if INSDATE and UPDDATE exist in the ERP response
        // NOTE: INSTLINES doesn't have INSDATE/UPDDATE (comes from INST table)
        const isInstLines = modelName.toUpperCase() === "INSTLINES";
        const erpInsDate = isInstLines ? null : (erpRecord.INSDATE || erpRecord.insdate);
        const erpUpdDate = isInstLines ? null : (erpRecord.UPDDATE || erpRecord.upddate);

        // Get existing record from map (O(1) lookup) - try both original and normalized values
        // CRITICAL: For INST/INSTLINES, normalize to number for lookup
        let existingRecord = null;
        let lookupNum: number | undefined;
        let lookupNum2: number | undefined;
        
        if (modelName.toUpperCase() === "INST" || modelName.toUpperCase() === "INSTLINES") {
          // For INST/INSTLINES, normalize to number for consistent lookup
          lookupNum = typeof normalizedUniqueValue === 'number' 
            ? normalizedUniqueValue 
            : Number(String(normalizedUniqueValue).replace(/^0+/, '') || '0');
          lookupNum2 = typeof erpUniqueValue === 'number'
            ? erpUniqueValue
            : Number(String(erpUniqueValue).replace(/^0+/, '') || '0');
          
          // Try all lookup strategies
          existingRecord = existingRecordsMap.get(lookupNum);
          if (!existingRecord) existingRecord = existingRecordsMap.get(lookupNum2);
          if (!existingRecord) existingRecord = existingRecordsMap.get(String(lookupNum));
          if (!existingRecord) existingRecord = existingRecordsMap.get(String(lookupNum2));
          
          // Debug lookup (only in verbose mode)
          if (SYNC_VERBOSE_LOGGING && processedCount <= 5) {
            const hasNum = existingRecordsMap.has(lookupNum);
            if ((hasNum || existingRecordsMap.has(String(lookupNum))) && !existingRecord) {
              syncError(`[SYNC] MAP BUG: has()=true but get()=null for INSTLINES=${lookupNum}!`);
            }
          }
        } else {
          // For other models, try multiple lookup strategies
          existingRecord = existingRecordsMap.get(normalizedUniqueValue) ?? 
                          existingRecordsMap.get(erpUniqueValue) ?? 
                          existingRecordsMap.get(String(normalizedUniqueValue)) ?? 
                          existingRecordsMap.get(String(erpUniqueValue)) ?? 
                          existingRecordsMap.get(Number(normalizedUniqueValue)) ?? 
                          existingRecordsMap.get(Number(erpUniqueValue));
        }
        
        // Debug logging (only in verbose mode)
        syncLog(`[SYNC] Record ${processedCount}: ${erpUniqueValue} -> ${existingRecord ? 'EXISTS' : 'NEW'}`);

        // Determine if this is a new or updated record
        // For INSTLINES: Just check if record exists (no INSDATE/UPDDATE on INSTLINES)
        // For other models: Use INSDATE/UPDDATE to determine insert vs update
        // Logic: Use INSDATE to determine if it's a new record (insert) or update
        // - If INSDATE >= cutoff: new record (insert)
        // - If UPDDATE >= cutoff but INSDATE < cutoff: updated record (update)
        let isNewRecord = false;
        let isUpdatedRecord = false;
        
        if (isInstLines) {
          // INSTLINES: No INSDATE/UPDDATE - just check if record exists in pre-fetched map
          if (existingRecordsMap.size === 0) {
            isNewRecord = true;
            isUpdatedRecord = false;
            syncLog(`[SYNC] Map empty - treating INSTLINES=${erpUniqueValue} as NEW`);
          } else {
            // Normal case: check if record exists
            // CRITICAL FIX: Verify lookup result matches map state
            if (!existingRecord) {
              const verifyHas = existingRecordsMap.has(lookupNum) || existingRecordsMap.has(String(lookupNum));
              if (verifyHas) {
                // Record IS in map but get() didn't find it - try manual lookup
                syncError(`[SYNC] LOOKUP BUG: INSTLINES=${lookupNum} exists in map but get() returned null!`);
                const manualGet = existingRecordsMap.get(lookupNum) || 
                                existingRecordsMap.get(lookupNum2) ||
                                existingRecordsMap.get(String(lookupNum)) ||
                                existingRecordsMap.get(String(lookupNum2));
                if (manualGet) existingRecord = manualGet;
              }
            }
            
            // Normal case: use the lookup result
            isNewRecord = !existingRecord;
            isUpdatedRecord = !!existingRecord;
          }
          
          syncLog(`[SYNC] INSTLINES ${processedCount}: ${isNewRecord ? 'NEW' : 'UPDATE'}`);
        } else if (!lastSyncAt || isManualSync) {
          // First sync OR manual sync - treat all as new if they don't exist
          // Manual "Sync Now" should process ALL records, not just incremental
          isNewRecord = !existingRecord;
          isUpdatedRecord = !!existingRecord; // If exists, it's an update
        } else {
          // Incremental sync (cron only) - use INSDATE to determine insert vs update
          const lastSync = new Date(lastSyncAt);
          let insDateValid = false;
          let updDateValid = false;
          let insDate: Date | null = null;
          let updDate: Date | null = null;
          
          // Parse INSDATE
          if (erpInsDate) {
            try {
              insDate = new Date(erpInsDate);
              if (!isNaN(insDate.getTime()) && !isNaN(lastSync.getTime())) {
                insDateValid = true;
                // If INSDATE >= cutoff, it's a new record (insert)
                isNewRecord = insDate >= lastSync;
              }
            } catch (e) {
              console.warn(`[SYNC] Invalid INSDATE for record ${erpUniqueValue}: ${erpInsDate}`);
            }
          }
          
          // Parse UPDDATE
          if (erpUpdDate) {
            try {
              updDate = new Date(erpUpdDate);
              if (!isNaN(updDate.getTime()) && !isNaN(lastSync.getTime())) {
                updDateValid = true;
                // If UPDDATE >= cutoff but INSDATE < cutoff, it's an updated record
                if (insDateValid && insDate && insDate < lastSync && updDate >= lastSync) {
                  isUpdatedRecord = true;
                  isNewRecord = false; // Not new if INSDATE is before cutoff
                } else if (!insDateValid && updDate >= lastSync) {
                  // If INSDATE is missing but UPDDATE is valid and >= cutoff, treat as update
                  isUpdatedRecord = true;
                }
              }
            } catch (e) {
              console.warn(`[SYNC] Invalid UPDDATE for record ${erpUniqueValue}: ${erpUpdDate}`);
            }
          }
          
          // If dates are missing, skip the record (don't process incomplete data)
          // EXCEPT for INSTLINES which doesn't have INSDATE/UPDDATE (comes from INST table)
          if (!isInstLines && !insDateValid && !updDateValid) {
            skippedCount++;
            skippedReasons["missing_dates"] = (skippedReasons["missing_dates"] || 0) + 1;
            if (modelName.toUpperCase() === "ITEMS" && skippedCount <= 3) {
              console.warn(`[ITEMS] Skipping record ${erpUniqueValue} - missing both INSDATE and UPDDATE`);
            }
            continue; // Skip this record entirely
          }
          
          // Only process if it's actually new or updated
          // For INSTLINES, we already determined this above (based on existence)
          if (!isInstLines && !isNewRecord && !isUpdatedRecord) {
            // Record exists but dates show it hasn't changed - skip it
            skippedCount++;
            skippedReasons["not_new_or_updated"] = (skippedReasons["not_new_or_updated"] || 0) + 1;
            continue; // Skip this record - it's not new or updated
          }
          
          syncLog(`[SYNC] Record ${processedCount}: ${isNewRecord ? 'NEW' : isUpdatedRecord ? 'UPDATE' : 'SKIP'}`);
        }

        // Prepare data for database
        const recordData: any = {};

        // Helper function to convert values based on field type
        const convertValueToType = (value: any, fieldName: string): any => {
          if (value === null || value === undefined) return null;
          
          // Define field type mappings
          const intFields = ["COUNTRY", "SOCURRENCY", "ISACTIVE", "VAT", "VATS1", "VATS3", 
            "MYDATACODE", "DEPART", "ACNMSKS", "ACNMSKX", "LOCKID", "TRDCATEGORY", "SODTYPE", "ITEMS",
            "PAYMENT", "ISDOSE", "INSTALMENTS", "MATURE", "PAYROUND", "MATURE1", "INST", "BLOCKED",
            "INSTLINES", "LINENUM", "MTRTYPE1"];
          const floatFields = ["PERCNT", "MU21", "MU31", "MU41", "WEIGHT", "PRICEW", "PRICER", 
            "DIM1", "DIM2", "DIM3", "SALQTY", "PURQTY", "ITEQTY", "GWEIGHT", "INTERESTDEB", "INTERESTCRE",
            "QTY", "PRICE", "NUM01"];
          const dateTimeFields = ["INSDATE", "UPDDATE", "FROMDATE", "FINALDATE", "PAYFROMDATE",
            "GDATEFROM", "GDATETO", "WDATEFROM", "WDATETO", "BLCKDATE", "createdAt", "updatedAt"];
          
          const fieldUpper = fieldName.toUpperCase();
          
          // Handle DateTime fields
          if (dateTimeFields.includes(fieldUpper) || fieldUpper.endsWith("DATE")) {
            const strValue = String(value).trim();
            if (strValue === "" || strValue === "0/0/0 0:0:0.0") {
              return null;
            }
            try {
              const dateValue = new Date(strValue);
              return isNaN(dateValue.getTime()) ? null : dateValue;
            } catch {
              return null;
            }
          }
          
          // Handle Int fields
          if (intFields.includes(fieldUpper)) {
            const numValue = Number(value);
            return isNaN(numValue) ? null : numValue;
          }
          
          // Handle Float fields
          if (floatFields.includes(fieldUpper)) {
            const numValue = parseFloat(String(value));
            return isNaN(numValue) ? null : numValue;
          }
          
          // Default to string
          return String(value);
        };

        // Map fields from ERP to model
        let mappedFieldsCount = 0;
        for (const [erpFieldName, modelFieldName] of Object.entries(fieldMappings)) {
          if (modelFieldName && modelFieldName !== "none") {
            const erpValue = erpRecord[erpFieldName] ?? erpRecord[erpFieldName.toLowerCase()] ?? erpRecord[erpFieldName.toUpperCase()];
            
            if (erpValue !== undefined && erpValue !== null) {
              recordData[modelFieldName] = convertValueToType(erpValue, modelFieldName);
              mappedFieldsCount++;
            }
          }
        }
        
        // Log warning if no fields were mapped (except for first few records to avoid spam)
        if (mappedFieldsCount === 0 && processedCount <= 3 && modelName.toUpperCase() === "ITEMS") {
          console.warn(`[ITEMS] ⚠️ Record ${processedCount} has NO mapped fields! Field mappings:`, Object.entries(fieldMappings).slice(0, 5));
          console.warn(`[ITEMS] ERP record keys:`, Object.keys(erpRecord).slice(0, 10));
          console.warn(`[ITEMS] This record will be created with only the unique identifier field.`);
        }

        // Set unique identifier - use normalized value (ensure it's defined)
        recordData[modelField] = normalizedUniqueValue ?? erpUniqueValue;

        // Handle special cases for specific models
        if (modelName === "CUSTORMER" && erpRecord.TRDR) {
          recordData.TRDR = String(erpRecord.TRDR);
        }
        if (modelName === "ITEMS") {
          // ITEMS model: Use MTRL as the primary key (ITEMS field)
          // MTRL is the unique identifier from ERP, convert it to number for ITEMS primary key
          if (erpRecord.MTRL) {
            const mtrlStr = String(erpRecord.MTRL);
            recordData.MTRL = mtrlStr;
            
            // Convert MTRL to number and use as ITEMS primary key
            // Strip leading zeros (e.g., "00159503" -> 159503)
            const mtrlNum = Number(mtrlStr.replace(/^0+/, '') || '0');
            if (!isNaN(mtrlNum) && mtrlNum > 0) {
              recordData.ITEMS = mtrlNum;
            } else {
              console.error(`[ITEMS] Invalid MTRL value for primary key: ${mtrlStr}`);
              skippedCount++;
              skippedReasons["invalid_MTRL"] = (skippedReasons["invalid_MTRL"] || 0) + 1;
              continue;
            }
          } else {
            // Try to get ITEMS from ERP record as fallback
            const erpItems = erpRecord.ITEMS ?? erpRecord.items ?? erpRecord.Items;
            if (erpItems !== undefined && erpItems !== null) {
              recordData.ITEMS = typeof erpItems === 'number' ? erpItems : Number(erpItems);
            } else {
              console.error(`[ITEMS] Missing MTRL field in ERP record - cannot determine primary key`);
              skippedCount++;
              skippedReasons["missing_MTRL"] = (skippedReasons["missing_MTRL"] || 0) + 1;
              continue;
            }
          }
          
          // CRITICAL: ISACTIVE is required (Int, not nullable) - set default if missing
          if (recordData.ISACTIVE === undefined || recordData.ISACTIVE === null) {
            // Try to get from ERP record
            const erpIsActive = erpRecord.ISACTIVE ?? erpRecord.isactive ?? erpRecord.IsActive;
            if (erpIsActive !== undefined && erpIsActive !== null) {
              recordData.ISACTIVE = typeof erpIsActive === 'number' ? erpIsActive : Number(erpIsActive);
            } else {
              // Default to 1 (active) if not provided
              recordData.ISACTIVE = 1;
            }
          }
        }
        if (modelName === "INST" && erpRecord.INST) {
          // Strip leading zeros from INST value (e.g., "003018" -> 3018)
          const instValueStr = String(erpRecord.INST).replace(/^0+/, '') || '0';
          recordData.INST = Number(instValueStr);
        }
        if (modelName === "INSTLINES") {
          if (erpRecord.INST) {
            // Strip leading zeros from INST value (e.g., "003018" -> 3018)
            const instValueStr = String(erpRecord.INST).replace(/^0+/, '') || '0';
            const instValueNum = Number(instValueStr);
            recordData.INST = instValueNum;
            
            syncLog(`[SYNC] INSTLINES ${erpRecord.INSTLINES}: INST=${instValueNum}`);
            
            // CRITICAL: INSTLINES must ALWAYS be associated with an INST record (contract)
            // INST must also have a TRDR (customer) - contracts need customers
            // Skip INSTLINES if the INST doesn't exist or has no customer
            try {
              // Check if normalized INST exists in pre-fetched map
              const instRecord = instRecordsMap.get(instValueNum);
              
              if (instRecord !== undefined) {
                // INST exists - validate it has a customer (TRDR)
                if (!instRecord.TRDR || instRecord.TRDR.trim() === '') {
                  // INST exists but has no customer - SKIP this INSTLINES
                  // Contracts (INST) must have customers (TRDR) for parking contracts
                  skippedCount++;
                  skippedReasons["INST_missing_TRDR"] = (skippedReasons["INST_missing_TRDR"] || 0) + 1;
                  if (processedCount <= 10 || processedCount % 1000 === 0) {
                    console.warn(`[SYNC] ⚠️ Skipping INSTLINES ${erpRecord.INSTLINES} - INST ${instValueNum} exists but has no TRDR (customer). Contracts need customers.`);
                  }
                  continue; // Skip this INSTLINES record
                }
                
                // INST exists and has customer - use the actual INST value from database
                recordData.INST = instRecord.INST;
              } else {
                // INST doesn't exist - SKIP this INSTLINES record
                // INSTLINES must always be associated with INST (contract)
                skippedCount++;
                skippedReasons["INST_not_found"] = (skippedReasons["INST_not_found"] || 0) + 1;
                if (processedCount <= 10 || processedCount % 1000 === 0) {
                  console.warn(`[SYNC] ⚠️ Skipping INSTLINES ${erpRecord.INSTLINES} - INST ${instValueNum} not found in database. INST (contract) must be synced first.`);
                }
                continue; // Skip this INSTLINES record
              }
            } catch (instCheckError) {
              console.error(`[SYNC] Error checking INST existence for INSTLINES:`, instCheckError);
              console.error(`[SYNC] INSTLINES record that failed:`, {
                INSTLINES: erpRecord.INSTLINES,
                INST: erpRecord.INST,
                normalizedINST: instValueNum,
              });
              // If we can't check, skip to be safe
              skippedCount++;
              skippedReasons["INST_check_error"] = (skippedReasons["INST_check_error"] || 0) + 1;
              continue; // Skip this INSTLINES record
            }
          } else {
            // INST is required for INSTLINES (foreign key)
            skippedCount++;
            skippedReasons["missing_INST"] = (skippedReasons["missing_INST"] || 0) + 1;
            if (modelName.toUpperCase() === "INSTLINES") {
              console.warn(`[SYNC] Skipping INSTLINES record - missing INST value`);
            }
            continue; // Skip this record
          }
          if (erpRecord.INSTLINES) {
            // Strip leading zeros from INSTLINES value too
            const instLinesValueStr = String(erpRecord.INSTLINES).replace(/^0+/, '') || '0';
            recordData.INSTLINES = Number(instLinesValueStr);
          }
        }

        // Prepare for upsert operation
        // At this point, isNewRecord and isUpdatedRecord are already validated
        // We only reach here if the record should be processed (after continue statements above)
        // Ensure where clause uses the correct type for the field
        // For ITEMS: use ITEMS (primary key, derived from MTRL) for where clause
        // For CUSTORMER: use TRDR (string) for where clause
        // For INST/INSTLINES: use primary key (number)
        let whereValue = normalizedUniqueValue ?? erpUniqueValue;
        
        // CRITICAL: For INST and INSTLINES, ensure the where value is a number
        // The primary key is Int, so we must use a number in the where clause
        if (modelName.toUpperCase() === "INST" || modelName.toUpperCase() === "INSTLINES") {
          // Convert to number, stripping leading zeros
          if (typeof whereValue === 'string') {
            whereValue = Number(String(whereValue).replace(/^0+/, '') || '0');
          } else if (whereValue !== null && whereValue !== undefined) {
            whereValue = Number(whereValue);
          }
          
          // Validate the where value is a valid number
          if (isNaN(whereValue) || whereValue === null || whereValue === undefined) {
            skippedCount++;
            skippedReasons["invalid_where_value"] = (skippedReasons["invalid_where_value"] || 0) + 1;
            errors++;
            continue; // Skip this record
          }
        } else if (modelName.toUpperCase() === "ITEMS") {
          // For ITEMS: use ITEMS primary key (number, derived from MTRL) for where clause
          // The where clause should use ITEMS (primary key), not MTRL
          if (recordData.ITEMS !== undefined && recordData.ITEMS !== null) {
            whereValue = recordData.ITEMS; // Use the ITEMS primary key we just set
          } else {
            // Fallback: convert MTRL to number
            const mtrlNum = Number(String(whereValue).replace(/^0+/, '') || '0');
            if (!isNaN(mtrlNum) && mtrlNum > 0) {
              whereValue = mtrlNum;
            } else {
              console.error(`[ITEMS] Cannot determine ITEMS primary key for where clause: MTRL=${erpUniqueValue}`);
              skippedCount++;
              skippedReasons["invalid_ITEMS_primary_key"] = (skippedReasons["invalid_ITEMS_primary_key"] || 0) + 1;
              errors++;
              continue;
            }
          }
        } else if (modelName.toUpperCase() === "CUSTORMER") {
          whereValue = String(whereValue); // Ensure string for TRDR field
        }
        
        // For INSTLINES, add extra validation
        if (modelName.toUpperCase() === "INSTLINES") {
          // Ensure INSTLINES field is set in recordData
          if (!recordData.INSTLINES || recordData.INSTLINES === null || recordData.INSTLINES === undefined) {
            console.error(`[SYNC] INSTLINES record missing INSTLINES field:`, {
              erpRecord: erpRecord,
              recordData: recordData,
              whereValue: whereValue,
            });
            errors++;
            continue; // Skip this record
          }
          
          // Ensure INSTLINES in recordData matches whereValue
          const recordInstLines = typeof recordData.INSTLINES === 'string'
            ? Number(String(recordData.INSTLINES).replace(/^0+/, '') || '0')
            : Number(recordData.INSTLINES);
          
          if (recordInstLines !== whereValue) {
            console.warn(`[SYNC] INSTLINES mismatch: whereValue=${whereValue}, recordData.INSTLINES=${recordInstLines}, fixing...`);
            recordData.INSTLINES = whereValue; // Fix the mismatch
          }
        }
        
        // CRITICAL: Use isNewRecord/isUpdatedRecord flags instead of recalculating from existingRecord
        // The existingRecord lookup might be finding false matches, so use the flags we already determined
        const isNew = isNewRecord; // Use the flag we already calculated, not !existingRecord
        
        // FINAL VERIFICATION: For INSTLINES, double-check the lookup one more time before adding to queue
        if (modelName.toUpperCase() === "INSTLINES" && isNew && processedCount <= 5) {
          // Record is marked as NEW - verify it's actually not in the map
          const finalCheck = existingRecordsMap.has(lookupNum) || existingRecordsMap.has(String(lookupNum));
          if (finalCheck) {
            console.error(`[SYNC] ⚠️⚠️⚠️ CRITICAL BUG: INSTLINES=${lookupNum} is marked as NEW but exists in map!`);
            console.error(`[SYNC]   - existingRecord: ${!!existingRecord}`);
            console.error(`[SYNC]   - isNewRecord: ${isNewRecord}`);
            console.error(`[SYNC]   - Map has: ${finalCheck}`);
            console.error(`[SYNC]   - FIXING: Changing to UPDATE instead of CREATE`);
            // Fix it: change to UPDATE
            const fixedIsNew = false;
            recordsToUpsert.push({
              where: { [modelField]: whereValue },
              create: recordData,
              update: recordData,
              isNew: fixedIsNew, // FIXED: Should be UPDATE, not CREATE
            });
            continue; // Skip the normal push below
          }
        }
        
        // For ITEMS: use ITEMS (primary key) in where clause, not MTRL
        // For other models: use modelField (unique identifier)
        const whereClause = modelName.toUpperCase() === "ITEMS" 
          ? { ITEMS: whereValue }  // Use ITEMS primary key
          : { [modelField]: whereValue };  // Use unique identifier field
        
        recordsToUpsert.push({
          where: whereClause,
          create: recordData,
          update: recordData,
          isNew: isNew, // Track if this should be new or updated
        });
        
        // Log progress for large datasets (only every 1000 records)
        if (recordsToUpsert.length % 1000 === 0) {
          const newInQueue = recordsToUpsert.filter(r => r.isNew).length;
          const updatedInQueue = recordsToUpsert.filter(r => !r.isNew).length;
          console.log(`[SYNC] Queue: ${recordsToUpsert.length} (${newInQueue} new, ${updatedInQueue} updated) | Processed: ${processedCount}/${totalRecords}`);
        }
        
        // DON'T increment synced/created/updated here - only after successful upsert!
        // These will be incremented after successful database operations
      } catch (error) {
        errors++;
        console.error(`[SYNC] Error processing ERP record:`, error);
        if (error instanceof Error) {
          console.error(`[SYNC] Error details:`, error.message, error.stack);
        }
      }
    }

    // OPTIMIZATION: Batch upsert operations with progress logging
    // For models where unique identifier is not the primary key (like ITEMS with MTRL),
    // we need to use findFirst + create/update instead of upsert
    // For INSTLINES: 100 per DB upsert batch (500 ERP records per API call)
    const DB_BATCH_SIZE = modelName.toUpperCase() === "INSTLINES" ? 100 : 50;
    
    // Models that can't use upsert (unique identifier is not primary key and not @unique)
    const modelsRequiringFindFirst = ["ITEMS", "CUSTORMER"]; // MTRL and TRDR are not @unique
    
    const canUseUpsert = !modelsRequiringFindFirst.includes(modelName.toUpperCase());
    
    if (recordsToUpsert.length > 0) {
      try {
        if (canUseUpsert) {
          const newCount = recordsToUpsert.filter(r => r.isNew).length;
          const updateCount = recordsToUpsert.filter(r => !r.isNew).length;
          console.log(`[SYNC] Ready to upsert: ${recordsToUpsert.length} records (${newCount} new, ${updateCount} updated)`);
          
          // TEST MODE: Only run when SYNC_VERBOSE_LOGGING and small dataset (skip for large syncs to avoid 10+ hour runs)
          if (SYNC_VERBOSE_LOGGING && newCount > 0 && recordsToUpsert.length < 100) {
            const firstNewRecord = recordsToUpsert.find(r => r.isNew);
            if (firstNewRecord) {
              syncLog(`[SYNC] 🧪 TEST MODE: Testing first NEW record (verbose only, <100 records)...`);
              const primaryKeyField = modelName.toUpperCase() === "INSTLINES" ? "INSTLINES" : modelName.toUpperCase() === "INST" ? "INST" : modelField;
              const findUniqueValue = firstNewRecord.where[primaryKeyField] ?? firstNewRecord.where[modelField] ?? firstNewRecord.create[primaryKeyField];
              let normalizedFindValue = findUniqueValue;
              if (["INST", "INSTLINES"].includes(modelName.toUpperCase()) && typeof findUniqueValue === 'string') {
                normalizedFindValue = Number(String(findUniqueValue).replace(/^0+/, '') || '0');
              }
              try {
                const testExisting = await model.findUnique({ where: { [primaryKeyField]: normalizedFindValue } });
                if (testExisting) {
                  syncLog(`[SYNC] Test: Record ${primaryKeyField}=${normalizedFindValue} already exists, skipping test create.`);
                } else {
                  const testCreated = await model.create({ data: firstNewRecord.create });
                  syncLog(`[SYNC] Test created ${primaryKeyField}=${testCreated[primaryKeyField]}`);
                  await model.delete({ where: { [primaryKeyField]: normalizedFindValue } });
                }
              } catch (testError: any) {
                syncWarn(`[SYNC] Test record failed (continuing): ${testError?.message || testError}`);
              }
            }
          }

          console.log(`[SYNC] Upserting ${recordsToUpsert.length} records in batches of ${DB_BATCH_SIZE}...`);
          const totalBatches = Math.ceil(recordsToUpsert.length / DB_BATCH_SIZE);
          
          for (let i = 0; i < recordsToUpsert.length; i += DB_BATCH_SIZE) {
            const batch = recordsToUpsert.slice(i, i + DB_BATCH_SIZE);
            const batchNum = Math.floor(i / DB_BATCH_SIZE) + 1;
            
            try {
              // For INST and INSTLINES: use upsert (single round-trip per record).
              // For INSTLINES: Process SEQUENTIALLY (one at a time) to avoid MySQL lock timeouts
              // INSTLINES has foreign key to INST, so sequential processing is safer
              if (modelName.toUpperCase() === "INST" || modelName.toUpperCase() === "INSTLINES") {
                const primaryKeyField = modelName.toUpperCase() === "INSTLINES" ? "INSTLINES" : "INST";
                const isInstLines = modelName.toUpperCase() === "INSTLINES";
                
                // For INSTLINES: Process sequentially to avoid lock timeouts
                // For INST: Use parallel processing (smaller batches)
                const batchResults: Array<PromiseSettledResult<{ isNew: boolean }>> = [];
                
                if (isInstLines) {
                  if (instlinesFullSync) {
                    // fullSync: delete-all-then-insert — use createMany per batch (no per-record delay)
                    const data = batch.map((r) => r.create);
                    try {
                      const result = await model.createMany({ data });
                      for (const r of batch) {
                        const pk = r.create[primaryKeyField] ?? r.where[primaryKeyField];
                        const pkNum = typeof pk === "number" ? pk : Number(String(pk).replace(/^0+/, "") || 0);
                        if (!isNaN(pkNum)) instlinesCompletedIds.push(pkNum);
                        batchResults.push({ status: "fulfilled", value: { isNew: true } });
                      }
                      console.log(`[INSTLINES] Inserted batch ${batchNum}/${totalBatches}: ${result.count} records (#${instlinesCompletedIds.length} total)`);
                    } catch (createManyErr: any) {
                      console.error(`[INSTLINES] createMany batch ${batchNum} failed:`, createManyErr?.message || createManyErr);
                      for (const _ of batch) {
                        batchResults.push({ status: "rejected", reason: createManyErr });
                      }
                    }
                  } else {
                    // INSTLINES: Process one at a time with retry (resume/batched sync only)
                    const INSTLINES_DELAY_MS = 50;
                    const MAX_RETRIES = 5;
                    const LOCK_BACKOFF_MS = 500;
                    for (const { where, create, update, isNew } of batch) {
                      const pkValue = create[primaryKeyField] ?? where[primaryKeyField] ?? where[modelField];
                      const wherePk = typeof pkValue === "number" ? pkValue : Number(String(pkValue).replace(/^0+/, "") || 0);
                      if (isNaN(wherePk)) {
                        batchResults.push({ status: "rejected", reason: new Error(`Invalid ${primaryKeyField} value: ${pkValue}`) });
                        continue;
                      }
                      const upsertWhere = { [primaryKeyField]: wherePk };
                      let retries = MAX_RETRIES;
                      let lastError: any;
                      let success = false;
                      while (retries > 0 && !success) {
                        try {
                          await model.upsert({ where: upsertWhere, create, update });
                          batchResults.push({ status: "fulfilled", value: { isNew } });
                          instlinesCompletedIds.push(wherePk);
                          success = true;
                        } catch (error: any) {
                          lastError = error;
                          const msg = String(error?.message ?? error);
                          const isLockTimeout = msg.includes("Lock wait timeout") || error?.code === 1205;
                          const isConnectionError = msg.includes("Can't reach database") || msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND");
                          if (isLockTimeout || isConnectionError) {
                            retries--;
                            if (retries > 0) {
                              const backoff = isLockTimeout ? LOCK_BACKOFF_MS * Math.pow(2, MAX_RETRIES - retries - 1) : 1000 * Math.pow(2, MAX_RETRIES - retries - 1);
                              await new Promise((r) => setTimeout(r, backoff));
                              continue;
                            }
                          }
                          batchResults.push({ status: "rejected", reason: error });
                          success = true;
                        }
                      }
                      if (!success) batchResults.push({ status: "rejected", reason: lastError });
                      await new Promise((r) => setTimeout(r, INSTLINES_DELAY_MS));
                    }
                  }
                } else {
                  // INST: Use parallel processing (smaller batches)
                  const concurrency = 10; // Lower concurrency for INST
                  for (let chunkStart = 0; chunkStart < batch.length; chunkStart += concurrency) {
                    const chunk = batch.slice(chunkStart, chunkStart + concurrency);
                    const chunkResults = await Promise.allSettled(
                      chunk.map(async ({ where, create, update, isNew }) => {
                        const pkValue = create[primaryKeyField] ?? where[primaryKeyField] ?? where[modelField];
                        const wherePk = typeof pkValue === 'number'
                          ? pkValue
                          : Number(String(pkValue).replace(/^0+/, '') || '0');
                        if (isNaN(wherePk)) {
                          throw new Error(`Invalid ${primaryKeyField} value: ${pkValue}`);
                        }
                        const upsertWhere = { [primaryKeyField]: wherePk };
                        await model.upsert({
                          where: upsertWhere,
                          create,
                          update,
                        });
                        return { isNew };
                      })
                    );
                    batchResults.push(...chunkResults);
                  }
                }
                
                let batchCreated = 0;
                let batchUpdated = 0;
                let resultIdx = 0;
                batchResults.forEach((result) => {
                  if (result.status === "fulfilled") {
                    if (result.value.isNew) {
                      created++;
                      batchCreated++;
                    } else {
                      updated++;
                      batchUpdated++;
                    }
                    synced++;
                  } else {
                    errors++;
                    // Get the record from batch using resultIdx
                    const rec = batch[resultIdx];
                    const pkVal = rec?.create?.[primaryKeyField] ?? rec?.where?.[primaryKeyField];
                    const msg = result.reason?.message || String(result.reason);
                    const isFk = msg.includes("Foreign key") || (result.reason as any)?.code === "P2003";
                    const isLockTimeout = msg.includes("Lock wait timeout") || (result.reason as any)?.code === 1205;
                    if (isLockTimeout) {
                      console.warn(`[SYNC] Lock timeout for ${primaryKeyField}=${pkVal} (retries exhausted)`);
                    } else if (!isFk && SYNC_VERBOSE_LOGGING) {
                      syncLog(`[SYNC] Upsert failed ${primaryKeyField}=${pkVal}:`, msg);
                    }
                  }
                  resultIdx++;
                });
                if (recordsToUpsert.length > 500 && batchNum % 10 === 0) {
                  console.log(`[SYNC] Batch ${batchNum}/${totalBatches}: ${batch.length} upserts, ${batchCreated + batchUpdated} ok, ${batchResults.filter((r) => r.status === "rejected").length} errors | Total: ${Math.min(i + DB_BATCH_SIZE, recordsToUpsert.length)}/${recordsToUpsert.length}`);
                }
              } else {
                // Use Promise.allSettled for parallel upserts (other models)
                const batchResults = await Promise.allSettled(
                  batch.map(async ({ where, create, update, isNew }) => {
                    await model.upsert({
                      where,
                      create,
                      update,
                    });
                    return { isNew };
                  })
                );
                
                // Count successful upserts
                batchResults.forEach((result) => {
                  if (result.status === 'fulfilled') {
                    if (result.value.isNew) {
                      created++;
                    } else {
                      updated++;
                    }
                    synced++;
                  } else {
                    errors++;
                    console.error(`[SYNC] Upsert failed:`, result.reason);
                  }
                });
                
                // Log progress for large upserts
                if (recordsToUpsert.length > 200 && batchNum % 5 === 0) {
                  const successCount = batchResults.filter(r => r.status === 'fulfilled').length;
                  console.log(`[SYNC] Upserted batch ${batchNum}/${totalBatches} (${successCount}/${batch.length} succeeded, ${Math.min(i + DB_BATCH_SIZE, recordsToUpsert.length)}/${recordsToUpsert.length} total)`);
                }
              }
            } catch (batchError: any) {
            console.error(`[SYNC] Error in upsert batch ${batchNum}:`, batchError);
            console.error(`[SYNC] Batch error details:`, {
              message: batchError?.message,
              code: batchError?.code,
              name: batchError?.name,
              meta: batchError?.meta,
            });
            
            // Try individual upserts for this batch to identify problematic records
            let individualSuccessCount = 0;
            let individualCreated = 0;
            let individualUpdated = 0;
            
            for (const { where, create, update, isNew } of batch) {
              try {
                if (modelName.toUpperCase() === "INST" || modelName.toUpperCase() === "INSTLINES") {
                  const primaryKeyField = modelName.toUpperCase() === "INSTLINES" ? "INSTLINES" : "INST";
                  const pkValue = create[primaryKeyField] ?? where[primaryKeyField] ?? where[modelField];
                  const wherePk = typeof pkValue === "number" ? pkValue : Number(String(pkValue).replace(/^0+/, "") || "0");
                  if (!isNaN(wherePk)) {
                    await model.upsert({
                      where: { [primaryKeyField]: wherePk },
                      create,
                      update,
                    });
                    if (isNew) {
                      individualCreated++;
                      created++;
                    } else {
                      individualUpdated++;
                      updated++;
                    }
                    synced++;
                    individualSuccessCount++;
                  } else {
                    errors++;
                  }
                } else {
                  // For other models, use upsert
                  await model.upsert({
                    where,
                    create,
                    update,
                  });
                  if (isNew) {
                    individualCreated++;
                    created++;
                  } else {
                    individualUpdated++;
                    updated++;
                  }
                  synced++;
                  individualSuccessCount++;
                }
              } catch (individualError: any) {
                errors++;
                const uniqueValue = where[modelField];
                console.error(`[SYNC] Failed to upsert record with ${modelField}=${uniqueValue}:`, individualError?.message || individualError);
                
                // Log more details for debugging
                if (individualError?.code) {
                  console.error(`[SYNC] Error code: ${individualError.code}, meta:`, individualError.meta);
                }
                
                // For INSTLINES, log the where clause and data to debug
                if (modelName.toUpperCase() === "INSTLINES") {
                  console.error(`[SYNC] INSTLINES upsert failure details:`, {
                    where,
                    createKeys: Object.keys(create),
                    updateKeys: Object.keys(update),
                    whereValue: where[modelField],
                    whereValueType: typeof where[modelField],
                  });
                }
              }
            }
            console.log(`[SYNC] Batch ${batchNum} individual retry: ${individualSuccessCount}/${batch.length} succeeded (${individualCreated} new, ${individualUpdated} updated)`);
          }
        }
        
        // CRITICAL: Verify actual database count after upsert for INST and INSTLINES
        if (modelName.toUpperCase() === "INST" || modelName.toUpperCase() === "INSTLINES") {
          try {
            const actualCount = await model.count();
            console.log(`[SYNC] ========================================`);
            console.log(`[SYNC] SYNC COMPLETE FOR ${modelName}`);
            console.log(`[SYNC] ========================================`);
            console.log(`[SYNC] ERP Records: ${totalRecords}`);
            console.log(`[SYNC] Records to Upsert: ${recordsToUpsert.length}`);
            console.log(`[SYNC] Created: ${created}`);
            console.log(`[SYNC] Updated: ${updated}`);
            console.log(`[SYNC] Errors: ${errors}`);
            console.log(`[SYNC] ========================================`);
            
            // Verify final count in database
            try {
              const finalCount = await model.count();
              console.log(`[SYNC] Final database count: ${finalCount} records`);
              if (modelName.toUpperCase() === "INSTLINES" && finalCount < totalRecords * 0.9) {
                console.error(`[SYNC] ⚠️ WARNING: Only ${finalCount} records in DB but ${totalRecords} were processed from ERP!`);
              }
            } catch (countError) {
              console.error(`[SYNC] Error counting final records:`, countError);
            }
            console.log(`[SYNC] 🔍 Verification: Actual ${modelName} records in database: ${actualCount}`);
            
            if (actualCount < recordsToUpsert.length) {
              console.error(`[SYNC] ⚠️ WARNING: Only ${actualCount} records in DB but ${recordsToUpsert.length} were supposed to be upserted!`);
              console.error(`[SYNC] ⚠️ This indicates upsert operations may have failed silently.`);
            }
          } catch (countError) {
            console.error(`[SYNC] Error verifying database count:`, countError);
          }
        } else {
          console.log(`[SYNC] ✅ Database updated: ${recordsToUpsert.length} records upserted (${created} new, ${updated} updated)`);
        }
        } else {
          // For ITEMS and CUSTORMER, use findFirst + create/update (MTRL and TRDR are not @unique)
          // We need to find by the unique identifier, then update by primary key
          console.log(`[SYNC] Processing ${recordsToUpsert.length} records with findFirst + create/update (${modelName} uses non-unique identifier)...`);
          if (modelName.toUpperCase() === "ITEMS") {
            console.log(`[ITEMS] Processing ${recordsToUpsert.length} ITEMS records (${recordsToUpsert.filter(r => r.isNew).length} new, ${recordsToUpsert.filter(r => !r.isNew).length} updates)`);
          }
          const totalBatches = Math.ceil(recordsToUpsert.length / DB_BATCH_SIZE);
          
          // Get primary key field name for this model
          const primaryKeyField = modelName.toUpperCase() === "ITEMS" ? "ITEMS" : 
                                  modelName.toUpperCase() === "CUSTORMER" ? "id" : 
                                  modelField; // Fallback to modelField if unknown
          
          for (let i = 0; i < recordsToUpsert.length; i += DB_BATCH_SIZE) {
            const batch = recordsToUpsert.slice(i, i + DB_BATCH_SIZE);
            const batchNum = Math.floor(i / DB_BATCH_SIZE) + 1;
            
            try {
              // Process each record individually with findFirst + create/update
              const batchResults = await Promise.allSettled(
                batch.map(async ({ where, create, update, isNew }) => {
                  // For ITEMS: use ITEMS (primary key) from create data, not MTRL from where
                  // For CUSTORMER: use TRDR (unique identifier) from where
                  let uniqueValue: any;
                  let whereClause: any;
                  
                  if (modelName.toUpperCase() === "ITEMS") {
                    // ITEMS: Use ITEMS primary key (number) for lookup
                    uniqueValue = create.ITEMS ?? where.ITEMS;
                    if (!uniqueValue) {
                      throw new Error(`ITEMS primary key missing in create/where data`);
                    }
                    whereClause = { ITEMS: uniqueValue };
                  } else {
                    // CUSTORMER: Use TRDR (unique identifier) for lookup
                    uniqueValue = where[modelField];
                    whereClause = { [modelField]: uniqueValue };
                  }
                  
                  const existing = await model.findFirst({
                    where: whereClause,
                  });
                  
                  if (existing) {
                    // Update using primary key
                    await model.update({
                      where: { [primaryKeyField]: existing[primaryKeyField] },
                      data: update,
                    });
                  } else {
                    await model.create({
                      data: create,
                    });
                  }
                  
                  return { isNew: isNew ?? !existing };
                })
              );
              
              // Count successful operations
              batchResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                  if (result.value.isNew) {
                    created++;
                  } else {
                    updated++;
                  }
                  synced++;
                } else {
                  errors++;
                  console.error(`[SYNC] findFirst/create/update failed:`, result.reason);
                }
              });
              
              // Log progress for large operations
              if (recordsToUpsert.length > 200 && batchNum % 5 === 0) {
                const successCount = batchResults.filter(r => r.status === 'fulfilled').length;
                console.log(`[SYNC] Processed batch ${batchNum}/${totalBatches}: ${successCount}/${batch.length} succeeded (${Math.min(i + DB_BATCH_SIZE, recordsToUpsert.length)}/${recordsToUpsert.length} total)`);
              }
            } catch (batchError) {
              console.error(`[SYNC] Error in batch ${batchNum}:`, batchError);
              // Try individual operations for this batch
              for (const { where, create, update, isNew } of batch) {
                try {
                  const uniqueValue = where[modelField];
                  const existing = await model.findFirst({
                    where: { [modelField]: uniqueValue },
                  });
                  
                  if (existing) {
                    // Update using primary key
                    await model.update({
                      where: { [primaryKeyField]: existing[primaryKeyField] },
                      data: update,
                    });
                  } else {
                    await model.create({
                      data: create,
                    });
                  }
                  
                  // Only increment counters after successful save
                  if (isNew ?? !existing) {
                    created++;
                  } else {
                    updated++;
                  }
                  synced++;
                } catch (individualError: any) {
                  errors++;
                  const uniqueValue = where[modelField];
                  console.error(`[SYNC] Failed to process record with ${modelField}=${uniqueValue}:`, individualError?.message || individualError);
                }
              }
            }
          }
          console.log(`[SYNC] ✅ Database updated: ${synced} records successfully processed (${created} new, ${updated} updated) out of ${recordsToUpsert.length} attempted`);
          if (modelName.toUpperCase() === "ITEMS") {
            console.log(`[ITEMS] ✅ Sync complete: ${created} created, ${updated} updated, ${errors} errors`);
            try {
              const finalCount = await model.count();
              console.log(`[ITEMS] Final ITEMS count in database: ${finalCount}`);
            } catch (countError) {
              console.error(`[ITEMS] Error counting final ITEMS:`, countError);
            }
          }
        }
      } catch (error) {
        console.error(`[SYNC] Error batch processing records:`, error);
        errors += recordsToUpsert.length;
      }
    }

    // Update lastSyncAt timestamp to mark successful sync
    const syncTimestamp = new Date();
    const updatedIntegration = await prisma.softOneIntegration.update({
      where: { id: integrationId },
      data: { lastSyncAt: syncTimestamp },
    });
    console.log(`[SYNC] ✅ Updated lastSyncAt timestamp: ${syncTimestamp.toISOString()}`);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log summary of processing
    if (modelName.toUpperCase() === "ITEMS") {
      console.log(`[ITEMS] ========================================`);
      console.log(`[ITEMS] SYNC SUMMARY:`);
      console.log(`[ITEMS]   Fetched from ERP: ${totalRecords} records`);
      console.log(`[ITEMS]   Processed: ${processedCount} records`);
      console.log(`[ITEMS]   Skipped: ${skippedCount} records`);
      if (skippedCount > 0) {
        console.log(`[ITEMS]   Skip reasons:`, skippedReasons);
      }
      console.log(`[ITEMS]   Queued for upsert: ${recordsToUpsert.length} records`);
      console.log(`[ITEMS]   Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
      console.log(`[ITEMS] ========================================`);
    } else if (modelName.toUpperCase() === "INSTLINES") {
      console.log(`[INSTLINES] ========================================`);
      console.log(`[INSTLINES] SYNC SUMMARY:`);
      console.log(`[INSTLINES]   Fetched from ERP: ${totalRecords} records`);
      console.log(`[INSTLINES]   Processed: ${processedCount} records`);
      console.log(`[INSTLINES]   Skipped: ${skippedCount} records`);
        if (skippedCount > 0) {
          console.log(`[INSTLINES]   Skip reasons:`, skippedReasons);
          if (skippedReasons["INST_not_found"] > 0) {
            console.warn(`[INSTLINES] ⚠️ ${skippedReasons["INST_not_found"]} INSTLINES skipped because their INST (contract) records don't exist.`);
            console.warn(`[INSTLINES] ⚠️ Sync INST (contracts) first, then sync INSTLINES (license plates) again.`);
          }
          if (skippedReasons["INST_missing_TRDR"] > 0) {
            console.warn(`[INSTLINES] ⚠️ ${skippedReasons["INST_missing_TRDR"]} INSTLINES skipped because their INST (contract) has no TRDR (customer).`);
            console.warn(`[INSTLINES] ⚠️ Contracts must have customers. Fix INST records to include TRDR, then sync INSTLINES again.`);
          }
        }
        console.log(`[INSTLINES]   Queued for upsert: ${recordsToUpsert.length} records`);
        console.log(`[INSTLINES]   Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
        console.log(`[INSTLINES] ========================================`);
    } else if (skippedCount > 0) {
      console.log(`[SYNC] Summary: Fetched ${totalRecords}, Processed ${processedCount}, Skipped ${skippedCount}`, skippedReasons);
    }
    
    // Prepare final stats
    const erpToAppStats = {
      created,
      updated,
      errors,
      synced,
      total: erpRecords.length,
    };

    const finalStats = {
      erpToApp: erpToAppStats,
      appToErp: null, // Cron jobs only sync ERP → App
    };

    // Determine status
    // Status: "success" if no errors (even with 0 records synced), "partial" if some errors but some success, "error" if all failed
    const totalSynced = erpToAppStats.synced;
    const totalErrors = erpToAppStats.errors;
    const status = totalErrors > 0 
      ? (totalSynced > 0 ? "partial" : "error")
      : "success"; // Success even if 0 records synced (no new updates needed)

    // ALWAYS log cron job executions (even with 0 results)
    // For manual syncs, also log if userId is available
    const shouldLog = isCronRequest || userId;
    
    if (shouldLog) {
      const logUserId = userId || integration.userId;
      console.log(`[SYNC] Creating log entry - userId: ${logUserId}, isCronRequest: ${isCronRequest}, integrationId: ${integrationId}`);
      try {
        const logEntry = await prisma.cronJobLog.create({
          data: {
            userId: logUserId,
            integrationId,
            jobType: "sync-integration",
            status,
            startedAt: new Date(startTime),
            completedAt: new Date(endTime),
            duration,
            stats: finalStats,
            details: {
              integrationName: integration.name,
              modelName,
              syncDirection: syncDirection,
              lastSyncAt: updatedIntegration?.lastSyncAt || syncTimestamp,
              triggeredBy: isCronRequest ? "cron" : "manual",
              message: totalSynced === 0 && totalErrors === 0 
                ? "No new records or updates found - database is up to date"
                : undefined,
            },
          },
        });
        console.log(`[SYNC] ✓ Successfully logged execution to database (logId: ${logEntry.id}, userId: ${logUserId}, status: ${status}, synced: ${totalSynced}, errors: ${totalErrors})`);
      } catch (logError) {
        console.error("[SYNC] ✗ Failed to log execution:", logError);
        if (logError instanceof Error) {
          console.error("[SYNC] Log error details:", logError.message);
          console.error("[SYNC] Log error stack:", logError.stack);
        }
        // Don't fail the sync if logging fails, but log the error
      }
    } else {
      console.warn("[SYNC] ⚠ Skipping log creation - isCronRequest:", isCronRequest, "userId:", userId);
    }

    // INSTLINES: save progress so next run (or script) resumes; clear when fully done (skip for filtered sync — no resume)
    if (modelName.toUpperCase() === "INSTLINES" && originalInstlinesTotal != null && integrationId && !instlinesFilteredByInst) {
      const nextOffset = Math.min(instlinesOffset + instlinesLimit, originalInstlinesTotal);
      const hasMore = nextOffset < originalInstlinesTotal;
      try {
        if (hasMore) {
          await saveCronProgress("sync-integration", integrationId, "INSTLINES", { lastOffset: nextOffset });
          console.log(`[INSTLINES] Progress saved: nextOffset=${nextOffset}, total=${originalInstlinesTotal}`);
        } else {
          await clearCronProgress("sync-integration", integrationId, "INSTLINES");
          console.log(`[INSTLINES] Sync complete; progress cleared.`);
        }
      } catch (progressError) {
        console.warn("[INSTLINES] Could not save/clear progress:", progressError);
      }
    }

    responsePayload = {
      success: true,
      stats: finalStats,
      syncDirection: "one-way",
      message: `Sync completed: ${created} created, ${updated} updated, ${errors} errors`,
    };
    if (modelName.toUpperCase() === "INSTLINES" && originalInstlinesTotal != null) {
      const syncedThisRun = created + updated;
      responsePayload.instlinesProgress = {
        total: originalInstlinesTotal,
        completedFrom: instlinesOffset,
        completedTo: instlinesOffset + syncedThisRun,
        nextOffset: Math.min(instlinesOffset + instlinesLimit, originalInstlinesTotal),
        hasMore: instlinesOffset + instlinesLimit < originalInstlinesTotal,
      };
      responsePayload.instlinesCompleted = instlinesCompletedIds;
      if (skippedCount > 0) {
        responsePayload.instlinesSkipped = { count: skippedCount, reasons: skippedReasons };
      }
    }
    return NextResponse.json(responsePayload);
    }
    // Ensure handler always returns a response (some code paths skip the block above)
    return NextResponse.json(responsePayload);
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error("[SYNC] Sync error:", error);
    
    // Try to log the error
    if (userId || integrationId) {
      try {
        const integrationForLog = integration || (integrationId ? await prisma.softOneIntegration.findUnique({
          where: { id: integrationId },
        }) : null);
        
        const logUserId = userId || integrationForLog?.userId;
        if (logUserId) {
          await prisma.cronJobLog.create({
            data: {
              userId: logUserId,
              integrationId: integrationId || null,
              jobType: "sync-integration",
              status: "error",
              startedAt: new Date(startTime),
              completedAt: new Date(endTime),
              duration,
              stats: {
                erpToApp: { created: 0, updated: 0, errors: 1, synced: 0, total: 0 },
                appToErp: null,
              },
              error: error instanceof Error ? error.message : "Unknown error",
              details: {
                error: error instanceof Error ? error.stack : String(error),
              },
            },
          });
        }
      } catch (logError) {
        console.error("[SYNC] Failed to log error:", logError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync integration",
      },
      { status: 500 }
    );
  }
}
