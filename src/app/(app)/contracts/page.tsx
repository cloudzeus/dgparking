import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeContractWhere } from "@/lib/contract-active";
import { ContractsClient } from "@/components/contracts/contracts-client";
import type { Role } from "@prisma/client";

/** Shape of an INSTLINE used in filter/map callbacks (avoids implicit any) */
type InstLineRow = { MTRL?: string | null; INSTLINES?: unknown; INST?: unknown; LINENUM?: unknown; MTRL_PLATE?: string | null; MTRL_NAME?: string | null };

// Disable caching for this page to ensure fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContractsPage() {
  unstable_noStore();
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
      CODE: true,
      NAME: true,
    },
  });

  // Πόσα οχήματα κάθε συμβολαίου βρίσκονται ΜΕΣΑ τώρα. Ο πίνακας ενημερώνεται
  // από cron κάθε 5 λεπτά (lib/cron-manager → refreshContractCars).
  const contractCars = await prisma.contractCar.findMany({
    select: { inst: true, carsIn: true },
  });
  const carsInByInst = new Map(contractCars.map((c) => [c.inst, c.carsIn]));
  
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

  // Fetch COUNTRY table for id -> name (CUSTORMER.COUNTRY stores ERP country ID)
  const allCountries = await prisma.cOUNTRY.findMany({
    select: { COUNTRY: true, NAME: true },
  });
  const countryNameByCode: Record<string, string> = {};
  allCountries.forEach((c) => {
    const key = String(c.COUNTRY);
    countryNameByCode[key] = c.NAME ?? key;
  });

  // MTRL -> πινακίδα. Η πινακίδα είναι το CODE του είδους· το NAME συμπίπτει
  // συνήθως αλλά όχι πάντα (467 είδη διαφέρουν), οπότε το CODE είναι η αλήθεια.
  const mtrlToPlateMap = new Map<string, string>();
  const mtrlToNameMap = new Map<string, string>();
  allItems.forEach(item => {
    if (!item.MTRL) return;
    const normalizedMtrl = String(item.MTRL).replace(/^0+/, '') || String(item.MTRL);
    const plate = (item.CODE ?? '').trim().toUpperCase();
    for (const key of [normalizedMtrl, item.MTRL.trim()]) {
      if (plate) mtrlToPlateMap.set(key, plate);
      mtrlToNameMap.set(key, item.NAME || '');
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
      const raw = line.MTRL ? String(line.MTRL).trim() : '';
      const normalizedMtrl = raw ? raw.replace(/^0+/, '') || raw : null;
      const lookup = normalizedMtrl
        ? (mtrlToPlateMap.get(normalizedMtrl) ?? mtrlToPlateMap.get(raw) ?? null)
        : null;
      const mtrlName = normalizedMtrl
        ? (mtrlToNameMap.get(normalizedMtrl) ?? mtrlToNameMap.get(raw) ?? null)
        : null;
      return {
        ...line,
        MTRL_PLATE: lookup,
        MTRL_NAME: mtrlName,
      };
    });
  };
  
  // Μόνο ενεργές συμβάσεις — όσες δεν έχουν λήξει ακόμα.
  const contractsWhere = activeContractWhere();

  try {
    // Fetch INST (contracts) then ALL INSTLINES and attach by INST (match by normalized INST so we never miss rows)
    const instRecords = await prisma.iNST.findMany({
      where: contractsWhere,
      orderBy: { INST: "desc" },
    });
    const instIdSet = new Set(instRecords.map((i) => Number(i.INST)));
    const allInstLines = await prisma.iNSTLINES.findMany({
      orderBy: [{ INST: "asc" }, { LINENUM: "asc" }],
    });
    const linesByInst = new Map<number, (typeof allInstLines)[number][]>();
    for (const line of allInstLines) {
      const instId = line.INST != null ? Number(line.INST) : null;
      if (instId == null || isNaN(instId) || !instIdSet.has(instId)) continue;
      if (!linesByInst.has(instId)) linesByInst.set(instId, []);
      linesByInst.get(instId)!.push(line);
    }
    installations = instRecords.map((inst) => {
      const customer = inst.TRDR ? trdrToCustomerMap.get(inst.TRDR) || null : null;
      const lines = linesByInst.get(Number(inst.INST)) || [];
      return {
        ...inst,
        lines: addMtrlNamesToLines(lines),
        CUSTOMER_NAME: customer?.NAME ?? null,
        customerDetails: customer ?? null,
      };
    });
    const totalLines = installations.reduce((s, i) => s + (i.lines?.length ?? 0), 0);
    console.log(`[CONTRACTS] Fetched ${installations.length} installations, ${allInstLines.length} INSTLINES in DB, ${totalLines} attached`);
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
            // Ίδιος helper με την άλλη διαδρομή — δύο αντίγραφα της ίδιας
            // αντιστοίχισης ήταν ο λόγος που οι πινακίδες έμεναν λάθος εδώ.
            .map(line => addMtrlNamesToLines([line])[0]),
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
          linesWithMtrl: inst.lines?.filter((l: InstLineRow) => l.MTRL && String(l.MTRL).trim() !== '').length || 0,
          firstLineMtrl: inst.lines?.[0]?.MTRL,
          firstLineMtrlName: inst.lines?.[0]?.MTRL_NAME,
        });
        if (inst.lines && inst.lines.length > 0) {
          console.log(`[CONTRACTS] First 3 lines for INST ${inst.INST} (fallback):`, inst.lines.slice(0, 3).map((l: InstLineRow) => ({
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
  console.log(`[CONTRACTS] Summary: ${installations.length} installations (WDATETO 30 Nov 2025 – today), ${totalInstLines} total INSTLINES`);

  // INSTLINES integration ID for "Sync plates" (sync only INSTLINES for these contracts)
  const instLinesIntegration = await prisma.softOneIntegration.findFirst({
    where: {
      OR: [{ tableName: "INSTLINES" }, { tableDbname: "instlines" }],
    },
    select: { id: true },
  });
  const instLinesIntegrationId = instLinesIntegration?.id ?? null;

  // Serialize so client receives plain objects with lines (avoids Prisma/serialization dropping relation)
  const serializedInstallations = (
    JSON.parse(
      JSON.stringify(installations, (_, v) => (v === undefined ? null : v))
    ) as typeof installations
  ).map((inst) => ({
    ...inst,
    // Οχήματα του συμβολαίου που βρίσκονται μέσα αυτή τη στιγμή.
    CARS_IN: carsInByInst.get(Number((inst as { INST: unknown }).INST)) ?? 0,
  }));

  return (
    <ContractsClient
      installations={serializedInstallations}
      currentUserRole={session.user.role}
      instLinesIntegrationId={instLinesIntegrationId}
      countryNameByCode={countryNameByCode}
    />
  );
}


