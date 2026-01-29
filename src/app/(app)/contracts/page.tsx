import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContractsClient } from "@/components/contracts/contracts-client";
import type { Role } from "@prisma/client";

// Disable caching for this page to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ContractsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN, MANAGER, and EMPLOYEE can access
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Fetch all INST records with their INSTLINES
  let installations: any[] = [];
  
  // Fetch all ITEMS to get MTRL -> NAME mapping (needed for both paths)
  const allItems = await prisma.iTEMS.findMany({
    select: {
      MTRL: true,
      NAME: true,
    },
  });
  
  // Fetch all CUSTORMER records for full customer details (TRDR lookup)
  const allCustomers = await prisma.cUSTORMER.findMany({
    select: {
      TRDR: true,
      CODE: true,
      NAME: true,
      AFM: true,
      COUNTRY: true,
      ADDRESS: true,
      ZIP: true,
      CITY: true,
      PHONE01: true,
      PHONE02: true,
      EMAIL: true,
      WEBPAGE: true,
      JOBTYPE: true,
    },
  });

  // Create a map of MTRL -> NAME for quick lookup
  const mtrlToNameMap = new Map<string, string>();
  allItems.forEach(item => {
    if (item.MTRL) {
      const normalizedMtrl = String(item.MTRL).replace(/^0+/, '') || String(item.MTRL);
      mtrlToNameMap.set(normalizedMtrl, item.NAME || '');
    }
  });

  // Map TRDR -> full customer object for accordion details
  const trdrToCustomerMap = new Map<string, typeof allCustomers[0]>();
  allCustomers.forEach(customer => {
    if (customer.TRDR) {
      trdrToCustomerMap.set(customer.TRDR, customer);
    }
  });
  
  // Helper function to add MTRL_NAME to INSTLINES
  const addMtrlNamesToLines = (lines: any[]) => {
    return lines.map(line => {
      const normalizedMtrl = line.MTRL ? String(line.MTRL).replace(/^0+/, '') || String(line.MTRL) : null;
      const mtrlName = normalizedMtrl ? (mtrlToNameMap.get(normalizedMtrl) || null) : null;
      return {
        ...line,
        MTRL_NAME: mtrlName,
      };
    });
  };
  
  // Contracts where WDATETO is at most 2 months old (WDATETO >= now - 2 months) — show all such INST (no filter on lines or ISACTIVE)
  const now = new Date();
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const contractsWhere = {
    WDATETO: { gte: twoMonthsAgo },
  };

  try {
    // Try to fetch with relation first
    installations = await prisma.iNST.findMany({
      where: contractsWhere,
      include: {
        lines: {
          orderBy: { LINENUM: "asc" },
        },
      },
      orderBy: { INST: "desc" },
    });
    
    // Add MTRL_NAME to each INSTLINE and full customer details to each INST
    installations = installations.map(inst => {
      const customer = inst.TRDR ? trdrToCustomerMap.get(inst.TRDR) || null : null;
      return {
        ...inst,
        lines: addMtrlNamesToLines(inst.lines || []),
        CUSTOMER_NAME: customer?.NAME ?? null,
        customerDetails: customer ?? null,
      };
    });
    
    // Debug: Log the data structure
    console.log(`[CONTRACTS] Fetched ${installations.length} installations with relation`);
    if (installations.length > 0) {
      installations.slice(0, 5).forEach((inst, idx) => {
        console.log(`[CONTRACTS] Installation ${idx + 1}:`, {
          INST: inst.INST,
          CODE: inst.CODE,
          linesCount: inst.lines?.length || 0,
          hasLines: !!inst.lines,
          linesWithMtrl: inst.lines?.filter(l => l.MTRL && String(l.MTRL).trim() !== '').length || 0,
        });
        if (inst.lines && inst.lines.length > 0) {
          console.log(`[CONTRACTS] First 3 lines for INST ${inst.INST}:`, inst.lines.slice(0, 3).map(l => ({
            INSTLINES: l.INSTLINES,
            INST: l.INST,
            MTRL: l.MTRL,
            LINENUM: l.LINENUM,
          })));
        } else {
          console.warn(`[CONTRACTS] ⚠️ INST ${inst.INST} has NO INSTLINES!`);
        }
      });
    }
  } catch (error: any) {
    console.error("[CONTRACTS] Error fetching installations with relation:", error);
    // If relation doesn't exist, fetch INST and INSTLINES separately
    try {
      const instRecords = await prisma.iNST.findMany({
        where: contractsWhere,
        orderBy: { INST: "desc" },
      });
      
      // Fetch all INSTLINES
      const allInstLines = await prisma.iNSTLINES.findMany({
        orderBy: { LINENUM: "asc" },
      });
      
      // Manually attach INSTLINES to INST records
      // Association: INSTLINES.INST should match INST.INST
      // Strip leading zeros from both sides before matching (e.g., "003018" -> 3018)
      installations = instRecords.map(inst => {
        // Normalize INST.INST value (strip leading zeros if it's a string)
        const normalizedInstId = typeof inst.INST === 'string' 
          ? Number(String(inst.INST).replace(/^0+/, '') || '0')
          : inst.INST;
        
        const customer = inst.TRDR ? trdrToCustomerMap.get(inst.TRDR) || null : null;
        return {
          ...inst,
          lines: allInstLines
            .filter(line => {
              // Normalize INSTLINES.INST value (strip leading zeros)
              const lineInst = typeof line.INST === 'string' 
                ? Number(String(line.INST).replace(/^0+/, '') || '0')
                : (line.INST ? Number(String(line.INST).replace(/^0+/, '') || '0') : null);
              
              // Match: INSTLINES.INST === INST.INST (both normalized)
              return lineInst !== null && lineInst === normalizedInstId;
            })
            .map(line => {
              // Add MTRL NAME to each INSTLINE
              const normalizedMtrl = line.MTRL ? String(line.MTRL).replace(/^0+/, '') || String(line.MTRL) : null;
              const mtrlName = normalizedMtrl ? (mtrlToNameMap.get(normalizedMtrl) || null) : null;
              
              return {
                ...line,
                MTRL_NAME: mtrlName,
              };
            }),
          CUSTOMER_NAME: customer?.NAME ?? null,
          customerDetails: customer ?? null,
        };
      });
      
      console.log(`[CONTRACTS] Fetched ${installations.length} installations, ${allInstLines.length} lines, and ${allItems.length} items (manually joined with MTRL names)`);
      
      // Debug: Log a few installations to verify data
      installations.slice(0, 5).forEach((inst, idx) => {
        console.log(`[CONTRACTS] Installation ${idx + 1} (fallback):`, {
          INST: inst.INST,
          CODE: inst.CODE,
          linesCount: inst.lines?.length || 0,
          linesWithMtrl: inst.lines?.filter(l => l.MTRL && String(l.MTRL).trim() !== '').length || 0,
          firstLineMtrl: inst.lines?.[0]?.MTRL,
          firstLineMtrlName: inst.lines?.[0]?.MTRL_NAME,
        });
        if (inst.lines && inst.lines.length > 0) {
          console.log(`[CONTRACTS] First 3 lines for INST ${inst.INST} (fallback):`, inst.lines.slice(0, 3).map(l => ({
            INSTLINES: l.INSTLINES,
            INST: l.INST,
            MTRL: l.MTRL,
            LINENUM: l.LINENUM,
          })));
        } else {
          console.warn(`[CONTRACTS] ⚠️ INST ${inst.INST} has NO INSTLINES (fallback)!`);
        }
      });
    } catch (fallbackError) {
      console.error("[CONTRACTS] Error fetching installations (fallback):", fallbackError);
    }
  }

  // Ensure all installations have lines array (even if empty) — show all INST with allowed WDATETO
  installations = installations.map(inst => ({
    ...inst,
    lines: inst.lines || [],
  }));

  const totalInstLines = installations.reduce((sum, inst) => sum + (inst.lines?.length || 0), 0);
  console.log(`[CONTRACTS] Summary: ${installations.length} installations (WDATETO max 2 months old), ${totalInstLines} total INSTLINES`);

  // INSTLINES integration ID for "Sync plates" (sync only INSTLINES for these contracts)
  const instLinesIntegration = await prisma.softOneIntegration.findFirst({
    where: {
      OR: [{ tableName: "INSTLINES" }, { tableDbname: "instlines" }],
    },
    select: { id: true },
  });
  const instLinesIntegrationId = instLinesIntegration?.id ?? null;

  return (
    <ContractsClient
      installations={installations}
      currentUserRole={session.user.role}
      instLinesIntegrationId={instLinesIntegrationId}
    />
  );
}


