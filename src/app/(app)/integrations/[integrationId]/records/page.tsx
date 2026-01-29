import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IntegrationRecordsClient } from "@/components/integrations/integration-records-client";

// Disable caching for this page to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntegrationRecordsPage({
  params,
}: {
  params: Promise<{ integrationId: string }>;
}) {
  const { integrationId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and MANAGER can access
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // ADMIN can view any integration; others only their own
  const integration = await prisma.softOneIntegration.findFirst({
    where:
      session.user.role === "ADMIN"
        ? { id: integrationId }
        : { id: integrationId, userId: session.user.id },
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
    redirect("/integrations");
  }

  const config = integration.configJson as any;
  const modelMapping = config?.modelMapping || {};
  const modelName = modelMapping?.modelName || "";

  console.log(`[INTEGRATION-RECORDS] Integration ID: ${integrationId}, Model Name: ${modelName}`);

  if (!modelName) {
    console.error(`[INTEGRATION-RECORDS] No model name found in integration config`);
    redirect("/integrations");
  }

  // Prisma models are accessed with lowercase first letter
  // e.g., CUSTORMER -> cUSTORMER, ITEMS -> iTEMS
  const prismaModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  
  // Dynamically fetch records from the model
  const model = (prisma as any)[prismaModelName];
  if (!model) {
    console.error(`[INTEGRATION-RECORDS] Model ${prismaModelName} (from ${modelName}) not found in Prisma client`);
    console.error(`[INTEGRATION-RECORDS] Available models:`, Object.keys(prisma).filter(key => !key.startsWith('_') && typeof (prisma as any)[key] === 'object' && (prisma as any)[key].findMany));
    redirect("/integrations");
  }

  // For large tables like INSTLINES, don't limit the query
  // The DataTable component handles pagination client-side
  // Only limit for very large result sets that might cause memory issues
  const shouldLimitRecords = modelName !== "INSTLINES" && modelName !== "INST";
  const MAX_RECORDS_INITIAL = 1000; // Limit initial fetch to 1000 records for smaller tables
  
  // Get total count first for logging
  let totalCount = 0;
  try {
    totalCount = await model.count();
    console.log(`[INTEGRATION-RECORDS] Total records in DB for ${modelName}: ${totalCount}`);
    
    // Log warning if count seems low for INSTLINES (expected ~29k based on sync logs)
    if (modelName === "INSTLINES" && totalCount < 10000) {
      console.warn(`[INTEGRATION-RECORDS] WARNING: Only ${totalCount} INSTLINES records found, but sync logs show ~29,594 updated. This might indicate a sync issue or records not being saved properly.`);
    }
  } catch (countError) {
    console.error(`[INTEGRATION-RECORDS] Error counting records:`, countError);
  }
  
  // Get all records from the model
  let records: any[] = [];
  try {
    // For INST model, include related INSTLINES
    if (modelName === "INST") {
      records = await model.findMany({
        include: {
          lines: {
            orderBy: { LINENUM: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        ...(shouldLimitRecords ? { take: MAX_RECORDS_INITIAL } : {}),
      });
    } else {
      // For INSTLINES and other large tables, fetch all records
      // Client-side pagination will handle the display
      
      // For INSTLINES, we need to fetch ALL records (no limit, no orderBy issues)
      if (modelName === "INSTLINES") {
        // For very large tables (20k+ records), fetch in batches to avoid MySQL timeout/limits
        console.log(`[INTEGRATION-RECORDS] Fetching INSTLINES - total in DB: ${totalCount}`);
        
        const BATCH_SIZE = 5000; // Fetch 5000 records at a time
        const batches: any[] = [];
        
        try {
          // Fetch in batches to avoid MySQL query timeout or max_allowed_packet limits
          if (totalCount > BATCH_SIZE) {
            console.log(`[INTEGRATION-RECORDS] Fetching ${totalCount} INSTLINES records in batches of ${BATCH_SIZE}...`);
            
            let fetched = 0;
            let skip = 0;
            
            while (fetched < totalCount) {
              const batch = await model.findMany({
                skip: skip,
                take: BATCH_SIZE,
                orderBy: { INSTLINES: "asc" },
              });
              
              if (batch.length === 0) {
                console.warn(`[INTEGRATION-RECORDS] No more records at skip=${skip}, breaking`);
                break;
              }
              
              batches.push(...batch);
              fetched += batch.length;
              skip += BATCH_SIZE;
              
              console.log(`[INTEGRATION-RECORDS] Batch progress: ${fetched}/${totalCount} records fetched`);
              
              // Safety check: if we got fewer records than expected, we might have reached the end
              if (batch.length < BATCH_SIZE) {
                console.log(`[INTEGRATION-RECORDS] Last batch had ${batch.length} records, finished fetching`);
                break;
              }
            }
            
            records = batches;
            console.log(`[INTEGRATION-RECORDS] Successfully fetched ${records.length} INSTLINES records in batches`);
            
            // Sort by primary key descending (newest first)
            records.sort((a, b) => {
              const aId = a.INSTLINES || 0;
              const bId = b.INSTLINES || 0;
              return bId - aId;
            });
          } else {
            // For smaller datasets, fetch all at once
            console.log(`[INTEGRATION-RECORDS] Fetching all ${totalCount} INSTLINES records in one query...`);
            records = await model.findMany({
              orderBy: { INSTLINES: "desc" },
            });
            console.log(`[INTEGRATION-RECORDS] Fetched ${records.length} INSTLINES records`);
          }
          
          if (records.length !== totalCount) {
            console.warn(`[INTEGRATION-RECORDS] WARNING: Fetched ${records.length} records but DB count is ${totalCount}. Difference: ${totalCount - records.length}`);
          }
        } catch (queryError: any) {
          console.error(`[INTEGRATION-RECORDS] Error in INSTLINES query:`, queryError);
          console.error(`[INTEGRATION-RECORDS] Error details:`, {
            message: queryError?.message,
            code: queryError?.code,
            name: queryError?.name,
            stack: queryError?.stack,
          });
          
          // Fallback: try simple query without orderBy
          try {
            records = await model.findMany({});
            console.log(`[INTEGRATION-RECORDS] Fallback query (no orderBy) fetched ${records.length} records`);
          } catch (fallbackError) {
            console.error(`[INTEGRATION-RECORDS] Fallback query also failed:`, fallbackError);
            records = [];
          }
        }
      } else {
        // For other models, use standard query
        const queryOptions: any = {
          orderBy: { createdAt: "desc" },
        };
        
        // Only add take limit if we should limit records
        if (shouldLimitRecords) {
          queryOptions.take = MAX_RECORDS_INITIAL;
        }
        
        records = await model.findMany(queryOptions);
      }
    }
    
    console.log(`[INTEGRATION-RECORDS] Fetched ${records.length} records for model ${modelName}${shouldLimitRecords ? ` (limited to ${MAX_RECORDS_INITIAL})` : ' (NO LIMIT)'} (total in DB: ${totalCount})`);
    
    // Additional debug for INSTLINES
    if (modelName === "INSTLINES") {
      console.log(`[INTEGRATION-RECORDS] INSTLINES first record:`, records[0] ? {
        INSTLINES: records[0].INSTLINES,
        INST: records[0].INST,
        LINENUM: records[0].LINENUM,
        MTRL: records[0].MTRL,
      } : 'No records');
      console.log(`[INTEGRATION-RECORDS] INSTLINES last record:`, records[records.length - 1] ? {
        INSTLINES: records[records.length - 1].INSTLINES,
        INST: records[records.length - 1].INST,
        LINENUM: records[records.length - 1].LINENUM,
        MTRL: records[records.length - 1].MTRL,
      } : 'No records');
    }
  } catch (error) {
    console.error(`[INTEGRATION-RECORDS] Error fetching records for model ${modelName}:`, error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error(`[INTEGRATION-RECORDS] Error message: ${error.message}`);
      console.error(`[INTEGRATION-RECORDS] Error stack: ${error.stack}`);
    }
  }

  // Fetch related data for CUSTORMER model (COUNTRY, IRSDATA)
  let countriesMap: Record<string, string> = {};
  let irsDataMap: Record<string, string> = {};
  
  if (modelName === "CUSTORMER") {
    try {
      const countryModel = (prisma as any).COUNTRY;
      if (countryModel) {
        const countries = await countryModel.findMany({
          select: {
            COUNTRY: true,
            NAME: true,
          },
        });
        countriesMap = countries.reduce((acc: Record<string, string>, country: any) => {
          acc[String(country.COUNTRY)] = country.NAME || String(country.COUNTRY);
          return acc;
        }, {});
      }

      const irsDataModel = (prisma as any).IRSDATA;
      if (irsDataModel) {
        const irsData = await irsDataModel.findMany({
          select: {
            IRSDATA: true,
            NAME: true,
          },
        });
        irsDataMap = irsData.reduce((acc: Record<string, string>, irs: any) => {
          acc[irs.IRSDATA] = irs.NAME || irs.IRSDATA;
          return acc;
        }, {});
      }
    } catch (error) {
      console.error(`[INTEGRATION-RECORDS] Error fetching related data:`, error);
    }
  }

  // Define model fields mapping (same as in /api/models/route.ts)
  const modelFieldsMap: Record<string, any[]> = {
    CUSTORMER: [
      { name: "id", type: "Int", isId: true, isUnique: false, isRequired: true },
      { name: "SODTYPE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "TRDR", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "CODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "AFM", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "COUNTRY", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ADDRESS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ZIP", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "CITY", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PHONE01", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PHONE02", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "JOBTYPE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "WEBPAGE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "EMAIL", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "EMAILACC", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "IRSDATA", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INSDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "UPDDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    User: [
      { name: "id", type: "String", isId: true, isUnique: true, isRequired: true },
      { name: "email", type: "String", isId: false, isUnique: true, isRequired: true },
      { name: "firstName", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "lastName", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "role", type: "Role", isId: false, isUnique: false, isRequired: true },
      { name: "isActive", type: "Boolean", isId: false, isUnique: false, isRequired: true },
      { name: "phone", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "mobile", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "address", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "city", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "country", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "lastLoginAt", type: "DateTime", isId: false, isUnique: false, isRequired: false },
    ],
    COUNTRY: [
      { name: "COUNTRY", type: "Int", isId: true, isUnique: false, isRequired: true },
      { name: "SHORTCUT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SOCURRENCY", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "INTCODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INTERCODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    IRSDATA: [
      { name: "IRSDATA", type: "String", isId: true, isUnique: false, isRequired: true },
      { name: "CODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ADDRESS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PHONE1", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ZIP", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    VAT: [
      { name: "VAT", type: "Int", isId: true, isUnique: false, isRequired: true },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PERCNT", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "VATS1", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "VATS3", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "MYDATACODE", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "DEPART", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "ACNMSKS", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "ACNMSKX", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    SOCURRENCY: [
      { name: "SOCURRENCY", type: "Int", isId: true, isUnique: false, isRequired: true },
      { name: "LOCKID", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "SHORTCUT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "INTERCODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    TRDCATEGORY: [
      { name: "TRDCATEGORY", type: "Int", isId: true, isUnique: false, isRequired: true },
      { name: "CODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ACNMSK", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "KEPYOST", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "COUNTRY", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "SOCURRENCY", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "COMPANY", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SODTYPE", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    ITEMS: [
      { name: "ITEMS", type: "Int", isId: true, isUnique: false, isRequired: true },
      { name: "COMPANY", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SODTYPE", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "MTRL", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "CODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "CODE1", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "CODE2", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "RELITEM", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "MTRTYPE1", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRACN", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRCATEGORY", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "VAT", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "MTRUNIT1", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRUNIT2", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRUNIT3", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRUNIT4", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MU21", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "MU31", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "MU41", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "MU12MODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MU13MODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MU14MODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRGROUP", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRMANFCTR", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "COUNTRY", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "MTRMARK", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRMODEL", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SOCURRENCY", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "INTRASTAT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "WEIGHT", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "WEBPAGE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "WEBNAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "WEBVIEW", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PRICEW", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "PRICER", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "DIM1", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "DIM2", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "DIM3", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "DIMMD", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "DIMMTRUNIT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SALQTY", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "PURQTY", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "ITEQTY", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "INSDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "UPDDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "GWEIGHT", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "MCOUNTRY", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "KADTAXIS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "cccSubgoup2", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "cccSubgroup3", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    INST: [
      { name: "INST", type: "Int", isId: true, isUnique: true, isRequired: true },
      { name: "CODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "INSTTYPE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "TRDR", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "TRDBRANCH", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "BRANCH", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "BUSUNITS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SALESMAN", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "TRDRS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "TRDBRANCHS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "GPNT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PRSN", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PRJC", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "FROMDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "BLOCKED", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "BLCKDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "GDATEFROM", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "GDATETO", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "WDATEFROM", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "WDATETO", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "INSDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "UPDDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "NUM01", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "REMARKS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    INSTLINES: [
      { name: "INSTLINES", type: "Int", isId: true, isUnique: true, isRequired: true },
      { name: "INST", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "LINENUM", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "SODTYPE", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "MTRL", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "BUSUNITS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "QTY", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "PRICE", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "FROMDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "FINALDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "COMMENTS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SNCODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INSTLINESS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MTRUNIT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "BAILTYPE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "GPNT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "TRDBRANCH", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INSDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "UPDDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
    PAYMENT: [
      { name: "PAYMENT", type: "Int", isId: true, isUnique: true, isRequired: true },
      { name: "CODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "NAME", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ISACTIVE", type: "Int", isId: false, isUnique: false, isRequired: true },
      { name: "ACNMSK", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INSPAYMD", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INSCLCMD", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "CREDITCARDS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "VATPAYMENT", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "ISDOSE", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "PAYFROMDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "INSTALMENTS", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "MATURE", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "PAYROUND", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "MATURE1", type: "Int", isId: false, isUnique: false, isRequired: false },
      { name: "EXPN", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "SERIES", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "CHQTPRMS", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "BANK", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "BANKBRANCH", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INTERESTDEB", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "INTERESTCRE", type: "Float", isId: false, isUnique: false, isRequired: false },
      { name: "SODATA", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "MYDATACODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "EFACTURACODE", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "PAYACNMSK", type: "String", isId: false, isUnique: false, isRequired: false },
      { name: "INSDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "UPDDATE", type: "DateTime", isId: false, isUnique: false, isRequired: false },
      { name: "createdAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
      { name: "updatedAt", type: "DateTime", isId: false, isUnique: false, isRequired: true },
    ],
  };

  const modelFields = modelFieldsMap[modelName] || [];

  return (
    <IntegrationRecordsClient
      integration={{
        ...integration,
        configJson: (integration.configJson ?? {}) as Record<string, any>,
      }}
      records={records}
      modelName={modelName}
      modelFields={modelFields}
      relatedData={{
        countries: countriesMap,
        irsData: irsDataMap,
      }}
    />
  );
}



