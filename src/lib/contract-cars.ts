/**
 * ContractCar help table: stores per-contract (INST) max cars (num01) and current count inside (carsIn).
 * Used on dashboard to show (carsIn/num01) and highlight exceeded contracts.
 */

import { prisma } from "@/lib/prisma";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * For a set of license plates, determine which are "still inside" (latest event IN, no OUT after).
 */
async function getPlatesStillInside(plates: Set<string>): Promise<Set<string>> {
  const withTime = await getPlatesStillInsideWithEntryTime(plates);
  return new Set(withTime.keys());
}

/**
 * Plates still inside with their entry time (latest IN with no OUT after).
 * Used to order cars by entry time: first NUM01 = contract slots, rest = visitor (regular fee).
 */
async function getPlatesStillInsideWithEntryTime(
  plates: Set<string>
): Promise<Map<string, Date>> {
  if (plates.size === 0) return new Map();
  const twoDaysAgo = new Date(Date.now() - TWO_DAYS_MS);
  const events = await prisma.lprRecognitionEvent.findMany({
    where: {
      licensePlate: { in: Array.from(plates) },
      recognitionTime: { gte: twoDaysAgo },
    },
    select: { licensePlate: true, direction: true, recognitionTime: true },
    orderBy: { recognitionTime: "asc" },
  });
  const byPlate = new Map<string, { direction: string | null; time: Date }[]>();
  for (const e of events) {
    const plate = (e.licensePlate || "").trim().toUpperCase();
    if (!plate || !plates.has(plate)) continue;
    if (!byPlate.has(plate)) byPlate.set(plate, []);
    byPlate.get(plate)!.push({
      direction: e.direction,
      time: e.recognitionTime,
    });
  }
  const stillInsideWithTime = new Map<string, Date>();
  for (const [plate, evs] of byPlate.entries()) {
    const sorted = [...evs].sort((a, b) => a.time.getTime() - b.time.getTime());
    const latest = sorted[sorted.length - 1];
    if (latest?.direction !== "IN") continue;
    const hasOutAfter = sorted.some(
      (e) =>
        e.direction === "OUT" && e.time.getTime() > latest.time.getTime()
    );
    if (!hasOutAfter) stillInsideWithTime.set(plate, latest.time);
  }
  return stillInsideWithTime;
}

/**
 * Refresh ContractCar table: for each active INST (WDATETO future, ISACTIVE=1, has lines),
 * compute carsIn (count of contract plates still inside) and upsert.
 */
export async function refreshContractCars(): Promise<void> {
  const now = new Date();
  const activeInst = await prisma.iNST.findMany({
    where: {
      WDATETO: { gte: now },
      ISACTIVE: 1,
      lines: { some: {} },
    },
    include: { lines: { select: { MTRL: true } } },
  });

  const itemsWithCode = await prisma.iTEMS.findMany({
    where: { CODE: { not: null } },
    select: { MTRL: true, CODE: true },
  });
  const mtrlToPlate = new Map<string, string>();
  for (const item of itemsWithCode) {
    if (!item.CODE || typeof item.CODE !== "string") continue;
    const plate = item.CODE.trim().toUpperCase();
    if (plate.length === 0) continue;
    const normalizedMtrl = item.MTRL
      ? (String(item.MTRL).replace(/^0+/, "") || item.MTRL.trim())
      : "";
    if (normalizedMtrl) mtrlToPlate.set(normalizedMtrl, plate);
    if (item.MTRL) mtrlToPlate.set(item.MTRL.trim(), plate);
  }

  const allPlatesStillInside = await getPlatesStillInside(
    new Set(mtrlToPlate.values())
  );

  for (const inst of activeInst) {
    const plates = new Set<string>();
    for (const line of inst.lines) {
      if (!line.MTRL || String(line.MTRL).trim() === "") continue;
      const normalized = String(line.MTRL).replace(/^0+/, "") || line.MTRL.trim();
      const plate = mtrlToPlate.get(normalized) ?? mtrlToPlate.get(line.MTRL.trim());
      if (plate) plates.add(plate);
    }
    const carsIn = Array.from(plates).filter((p) =>
      allPlatesStillInside.has(p)
    ).length;
    const num01 = inst.NUM01 != null ? Number(inst.NUM01) : null;
    await prisma.contractCar.upsert({
      where: { inst: inst.INST },
      create: {
        inst: inst.INST,
        num01: num01 ?? undefined,
        carsIn,
      },
      update: {
        num01: num01 ?? undefined,
        carsIn,
      },
    });
  }
}

export type ContractSlotType = "contract" | "visitor";

/**
 * Returns contract info per license plate for dashboard: { num01, carsIn, inst, slotType }.
 * slotType: "contract" = car counts toward contract (within NUM01); "visitor" = over limit, pays regular fee.
 * Plate must belong to an active contract (INST with future WDATETO, has lines).
 */
export async function getContractInfoByPlate(): Promise<
  Map<string, { num01: number; carsIn: number; inst: number; slotType?: ContractSlotType }>
> {
  await refreshContractCars();
  const now = new Date();
  const activeInst = await prisma.iNST.findMany({
    where: {
      WDATETO: { gte: now },
      ISACTIVE: 1,
      lines: { some: {} },
    },
    include: {
      lines: { select: { MTRL: true } },
    },
  });

  const instIds = activeInst.map((i) => i.INST);
  const contractCars = await prisma.contractCar.findMany({
    where: { inst: { in: instIds } },
  });
  const carsInByInst = new Map(contractCars.map((c) => [c.inst, c.carsIn]));
  const num01ByInst = new Map(
    contractCars.map((c) => [c.inst, c.num01 != null ? Math.floor(Number(c.num01)) : null])
  );

  const itemsWithCode = await prisma.iTEMS.findMany({
    where: { CODE: { not: null } },
    select: { MTRL: true, CODE: true },
  });
  const mtrlToPlate = new Map<string, string>();
  for (const item of itemsWithCode) {
    if (!item.CODE || typeof item.CODE !== "string") continue;
    const plate = item.CODE.trim().toUpperCase();
    if (plate.length === 0) continue;
    const normalizedMtrl = item.MTRL
      ? (String(item.MTRL).replace(/^0+/, "") || item.MTRL.trim())
      : "";
    if (normalizedMtrl) mtrlToPlate.set(normalizedMtrl, plate);
    if (item.MTRL) mtrlToPlate.set(item.MTRL.trim(), plate);
  }

  const allPlatesEntryTime = await getPlatesStillInsideWithEntryTime(
    new Set(mtrlToPlate.values())
  );

  const result = new Map<
    string,
    { num01: number; carsIn: number; inst: number; slotType?: ContractSlotType }
  >();
  for (const inst of activeInst) {
    const num01FromTable = num01ByInst.get(inst.INST);
    const num01 =
      num01FromTable != null
        ? num01FromTable
        : inst.NUM01 != null
          ? Math.floor(Number(inst.NUM01))
          : 0;
    const carsIn = carsInByInst.get(inst.INST) ?? 0;

    const contractPlates = new Set<string>();
    for (const line of inst.lines) {
      if (!line.MTRL || String(line.MTRL).trim() === "") continue;
      const normalized = String(line.MTRL).replace(/^0+/, "") || line.MTRL.trim();
      const plate = mtrlToPlate.get(normalized) ?? mtrlToPlate.get(line.MTRL.trim());
      if (plate) contractPlates.add(plate);
    }
    const platesInsideWithTime = Array.from(contractPlates)
      .filter((p) => allPlatesEntryTime.has(p))
      .map((p) => ({ plate: p, entryTime: allPlatesEntryTime.get(p)! }))
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
    const num01Int = Math.max(0, num01);
    const contractSlots = new Set(
      platesInsideWithTime.slice(0, num01Int).map((x) => x.plate)
    );
    const visitorSlots = new Set(
      platesInsideWithTime.slice(num01Int).map((x) => x.plate)
    );

    for (const line of inst.lines) {
      if (!line.MTRL || String(line.MTRL).trim() === "") continue;
      const normalized = String(line.MTRL).replace(/^0+/, "") || line.MTRL.trim();
      const plate = mtrlToPlate.get(normalized) ?? mtrlToPlate.get(line.MTRL.trim());
      if (plate) {
        const slotType = visitorSlots.has(plate)
          ? ("visitor" as const)
          : contractSlots.has(plate)
            ? ("contract" as const)
            : undefined;
        result.set(plate, { num01, carsIn, inst: inst.INST, slotType });
      }
    }
  }
  return result;
}
