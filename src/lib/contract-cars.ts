/**
 * ContractCar help table: stores per-contract (INST) max cars (num01) and current count inside (carsIn).
 * Used on dashboard to show (carsIn/num01) and highlight exceeded contracts.
 *
 * ΑΠΟΔΟΣΗ — γιατί είναι γραμμένο έτσι:
 * Η βάση είναι απομακρυσμένη (~76 ms ανά ερώτημα), οπότε ό,τι κοστίζει είναι ο
 * ΑΡΙΘΜΟΣ των ερωτημάτων, όχι η δουλειά της MySQL. Παλιότερα το dashboard
 * φόρτωνε τρεις φορές τα ίδια δεδομένα και έγραφε 57 σειριακά upsert (5 SQL το
 * καθένα) σε κάθε άνοιγμα — 25 δευτερόλεπτα. Τώρα:
 *   - τα δεδομένα φορτώνονται ΜΙΑ φορά (`loadContractState`, 3 ερωτήματα)
 *   - η ανάγνωση (`getContractInfoByPlate`) ΔΕΝ γράφει τίποτα
 *   - η ενημέρωση του πίνακα (`refreshContractCars`) γίνεται με ΕΝΑ bulk upsert
 *     και ανήκει στο cron / στο webhook της κάμερας, όχι στη φόρτωση σελίδας.
 */

import { normalizePlate } from "@/lib/plate";
import { prisma } from "@/lib/prisma";

/**
 * Ποιες από αυτές τις πινακίδες βρίσκονται μέσα, με την ώρα εισόδου τους.
 *
 * Πηγή είναι η απογραφή — ο πίνακας που γράφει το `applyCameraPass` τη στιγμή
 * που διαβάζεται η πινακίδα, και που διαβάζουν το βιβλίο πόρτας, το ψηφιακό
 * πελατολόγιο, ο τζίρος και οι υπερβάσεις.
 *
 * Παλιότερα εδώ ξαναπαίζαμε τα περάσματα δύο ημερών. Έβγαζε άλλο αποτέλεσμα από
 * την υπόλοιπη εφαρμογή σε τρεις περιπτώσεις: όχημα που μπήκε πριν από δύο
 * μέρες, όχημα που ήρθε από το ψηφιακό πελατολόγιο χωρίς πέρασμα κάμερας, και
 * πινακίδα γραμμένη αλλιώς στο συμβάν απ' ό,τι στην απογραφή.
 */
async function getPlatesStillInsideWithEntryTime(
  plates: Set<string>
): Promise<Map<string, Date>> {
  if (plates.size === 0) return new Map();

  // Η απογραφή κρατά κανονικοποιημένες πινακίδες· το ERP δίνει ό,τι έχει
  // καταχωρήσει ο χρήστης. Συγκρίνουμε μόνο κανονικοποιημένες.
  const wanted = new Map<string, string>();
  for (const p of plates) wanted.set(normalizePlate(p), p);

  const inside = await prisma.parkingInventory.findMany({
    select: { plate: true, enteredAt: true },
  });

  const result = new Map<string, Date>();
  for (const row of inside) {
    const original = wanted.get(normalizePlate(row.plate));
    if (original) result.set(original, row.enteredAt);
  }
  return result;
}

type ContractState = {
  activeInst: {
    INST: number;
    NUM01: number | null;
    lines: { MTRL: string | null }[];
  }[];
  /** MTRL (και η κανονικοποιημένη μορφή του) → πινακίδα. */
  mtrlToPlate: Map<string, string>;
  /** Πινακίδα → ώρα εισόδου, για όσες βρίσκονται μέσα τώρα. */
  platesInside: Map<string, Date>;
};

/**
 * Φορτώνει ΜΙΑ φορά ό,τι χρειάζονται και οι δύο λειτουργίες: ενεργά συμβόλαια
 * με τις γραμμές τους, τον χάρτη MTRL→πινακίδα, και ποιες πινακίδες είναι μέσα.
 * Τρία ερωτήματα συνολικά.
 */
async function loadContractState(): Promise<ContractState> {
  const now = new Date();

  const [activeInst, itemsWithCode] = await Promise.all([
    prisma.iNST.findMany({
      where: { WDATETO: { gte: now }, ISACTIVE: 1, lines: { some: {} } },
      select: { INST: true, NUM01: true, lines: { select: { MTRL: true } } },
    }),
    prisma.iTEMS.findMany({
      where: { CODE: { not: null } },
      select: { MTRL: true, CODE: true },
    }),
  ]);

  const mtrlToPlate = new Map<string, string>();
  for (const item of itemsWithCode) {
    if (!item.CODE || typeof item.CODE !== "string") continue;
    const plate = item.CODE.trim().toUpperCase();
    if (plate.length === 0) continue;
    const normalizedMtrl = item.MTRL
      ? String(item.MTRL).replace(/^0+/, "") || item.MTRL.trim()
      : "";
    if (normalizedMtrl) mtrlToPlate.set(normalizedMtrl, plate);
    if (item.MTRL) mtrlToPlate.set(item.MTRL.trim(), plate);
  }

  const platesInside = await getPlatesStillInsideWithEntryTime(
    new Set(mtrlToPlate.values())
  );

  return {
    activeInst: activeInst.map((i) => ({
      INST: i.INST,
      NUM01: i.NUM01 != null ? Number(i.NUM01) : null,
      lines: i.lines,
    })),
    mtrlToPlate,
    platesInside,
  };
}

/** Οι πινακίδες ενός συμβολαίου, από τις γραμμές του. */
function platesOfContract(
  lines: { MTRL: string | null }[],
  mtrlToPlate: Map<string, string>
): Set<string> {
  const plates = new Set<string>();
  for (const line of lines) {
    if (!line.MTRL || String(line.MTRL).trim() === "") continue;
    const normalized = String(line.MTRL).replace(/^0+/, "") || line.MTRL.trim();
    const plate = mtrlToPlate.get(normalized) ?? mtrlToPlate.get(line.MTRL.trim());
    if (plate) plates.add(plate);
  }
  return plates;
}

/**
 * Refresh ContractCar table: for each active INST (WDATETO future, ISACTIVE=1, has lines),
 * compute carsIn (count of contract plates still inside) and upsert.
 *
 * ΔΕΝ καλείται από τη φόρτωση σελίδας — μόνο από cron ή από το webhook της
 * κάμερας, όταν αλλάζει πραγματικά η κατάσταση του πάρκινγκ.
 */
export async function refreshContractCars(): Promise<void> {
  const { activeInst, mtrlToPlate, platesInside } = await loadContractState();

  const rows = activeInst.map((inst) => {
    const plates = platesOfContract(inst.lines, mtrlToPlate);
    const carsIn = Array.from(plates).filter((p) => platesInside.has(p)).length;
    return { inst: inst.INST, num01: inst.NUM01, carsIn };
  });

  if (rows.length === 0) return;

  // Ένα ερώτημα αντί για 57 upsert × 5 SQL. Το `inst` είναι unique, οπότε το
  // ON DUPLICATE KEY ενημερώνει τις υπάρχουσες γραμμές.
  const values = rows
    .map(
      (r) =>
        `(${prismaCuid()}, ${r.inst}, ${r.num01 == null ? "NULL" : r.num01}, ${r.carsIn}, NOW(3))`
    )
    .join(",");

  await prisma.$executeRawUnsafe(
    `INSERT INTO contract_cars (id, inst, num01, cars_in, updated_at)
     VALUES ${values}
     ON DUPLICATE KEY UPDATE
       num01 = VALUES(num01),
       cars_in = VALUES(cars_in),
       updated_at = VALUES(updated_at)`
  );
}

/**
 * Το `id` είναι cuid στο schema και δεν έχει DB default — το παράγουμε εμείς
 * για τις γραμμές που θα εισαχθούν (στις υπάρχουσες αγνοείται).
 */
function prismaCuid(): string {
  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `'${id}'`;
}

export type ContractSlotType = "contract" | "visitor";

/**
 * Returns contract info per license plate for dashboard: { num01, carsIn, inst, slotType }.
 * slotType: "contract" = car counts toward contract (within NUM01); "visitor" = over limit, pays regular fee.
 * Plate must belong to an active contract (INST with future WDATETO, has lines).
 *
 * Καθαρή ανάγνωση: υπολογίζει το `carsIn` επιτόπου αντί να το διαβάσει από τον
 * βοηθητικό πίνακα, οπότε είναι πάντα φρέσκο και δεν χρειάζεται καμία εγγραφή.
 */
export async function getContractInfoByPlate(): Promise<
  Map<string, { num01: number; carsIn: number; inst: number; slotType?: ContractSlotType }>
> {
  const { activeInst, mtrlToPlate, platesInside } = await loadContractState();

  const result = new Map<
    string,
    { num01: number; carsIn: number; inst: number; slotType?: ContractSlotType }
  >();

  for (const inst of activeInst) {
    const num01 = inst.NUM01 != null ? Math.max(0, Math.floor(inst.NUM01)) : 0;
    const contractPlates = platesOfContract(inst.lines, mtrlToPlate);

    // Όποιος μπήκε πρώτος πιάνει θέση συμβολαίου· οι υπόλοιποι χρεώνονται ως επισκέπτες.
    const insideOrdered = Array.from(contractPlates)
      .filter((p) => platesInside.has(p))
      .map((p) => ({ plate: p, entryTime: platesInside.get(p)! }))
      .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

    const carsIn = insideOrdered.length;
    const contractSlots = new Set(insideOrdered.slice(0, num01).map((x) => x.plate));
    const visitorSlots = new Set(insideOrdered.slice(num01).map((x) => x.plate));

    for (const plate of contractPlates) {
      const slotType = visitorSlots.has(plate)
        ? ("visitor" as const)
        : contractSlots.has(plate)
          ? ("contract" as const)
          : undefined;
      result.set(plate, { num01, carsIn, inst: inst.INST, slotType });
    }
  }

  return result;
}
