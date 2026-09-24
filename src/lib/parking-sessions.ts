/**
 * Δικό μας ψηφιακό πελατολόγιο — ΜΟΝΟ ΑΝΑΓΝΩΣΗ.
 *
 * Χτίζει «στάσεις» (είσοδος → έξοδος) από τα συμβάντα των καμερών και υπολογίζει
 * τη χρέωση με τον ίδιο κανόνα που τρέχει το ERP. Δεν γράφει ΤΙΠΟΤΑ στο SoftOne:
 * η εφαρμογή παρακολουθεί και αντιπαραβάλλει, δεν τιμολογεί.
 *
 * ΣΥΜΒΑΣΕΙΣ: ο έλεγχος γίνεται ΜΟΝΟ σε ενεργές συμβάσεις (βλ. contract-active).
 * Μια πινακίδα δηλωμένη σε ληγμένη σύμβαση είναι, για εμάς, απλός πελάτης.
 */

import { prisma } from "@/lib/prisma";
import { activeContractWhere } from "@/lib/contract-active";
import { isReadablePlate, wallClockNow } from "@/lib/parking-time";
import { getExemptPlates } from "@/lib/exempt-plates";
import {
  calculateCharge,
  DEFAULT_TARIFF,
  type ChargeResult,
  type Tariff,
} from "@/lib/parking-tariff";

export type ParkingSession = {
  plate: string;
  entry: Date;
  /** null όσο το όχημα βρίσκεται ακόμα μέσα. */
  exit: Date | null;
  durationMinutes: number | null;
  /** Η ΕΝΕΡΓΗ σύμβαση που καλύπτει την πινακίδα, αν υπάρχει. */
  contractInst: number | null;
  /** Η πινακίδα είναι καταχωρημένη ως απαλλαγμένη. */
  isExempt: boolean;
  /** null όσο είναι μέσα — η χρέωση οριστικοποιείται στην έξοδο. */
  charge: ChargeResult | null;
  /** Δύο διαδοχικά IN χωρίς OUT: χάθηκε η έξοδος από την κάμερα. */
  missingExit: boolean;
  /** OUT χωρίς προηγούμενο IN: χάθηκε η είσοδος. */
  orphanExit: boolean;
  /**
   * Πέρασμα, όχι στάθμευση: το όχημα το είδαν και οι δύο κάμερες μέσα σε λίγα
   * λεπτά. Το ERP δεν καταγράφει τέτοια, οπότε δεν είναι απόκλιση.
   */
  passThrough: boolean;
};

/** Κάτω από τόσα λεπτά θεωρούμε ότι το όχημα απλώς πέρασε. */
export const MIN_STAY_MINUTES = 3;

/** Πινακίδα → INST ενεργής σύμβασης. Η πινακίδα είναι το `CODE` του είδους. */
export async function getActiveContractPlates(): Promise<Map<string, number>> {
  const [activeInst, itemsWithCode] = await Promise.all([
    prisma.iNST.findMany({
      where: { ...activeContractWhere(), lines: { some: {} } },
      select: { INST: true, lines: { select: { MTRL: true } } },
    }),
    prisma.iTEMS.findMany({
      where: { CODE: { not: null } },
      select: { MTRL: true, CODE: true },
    }),
  ]);

  const mtrlToPlate = new Map<string, string>();
  for (const item of itemsWithCode) {
    if (!item.CODE) continue;
    const plate = item.CODE.trim().toUpperCase();
    if (!plate) continue;
    const raw = String(item.MTRL ?? "").trim();
    if (!raw) continue;
    mtrlToPlate.set(raw, plate);
    mtrlToPlate.set(raw.replace(/^0+/, "") || raw, plate);
  }

  const plateToInst = new Map<string, number>();
  for (const inst of activeInst) {
    for (const line of inst.lines) {
      const raw = String(line.MTRL ?? "").trim();
      if (!raw) continue;
      const plate =
        mtrlToPlate.get(raw) ?? mtrlToPlate.get(raw.replace(/^0+/, "") || raw);
      if (plate) plateToInst.set(plate, inst.INST);
    }
  }
  return plateToInst;
}

type Event = { licensePlate: string; direction: string | null; recognitionTime: Date };

/**
 * Ζευγαρώνει IN → OUT ανά πινακίδα, σε χρονολογική σειρά.
 *
 * Οι κάμερες χάνουν περάσματα, οπότε δύο περιπτώσεις σημειώνονται αντί να
 * αγνοηθούν — είναι ακριβώς οι αποκλίσεις που θέλουμε να βλέπουμε:
 *  - IN ... IN  → η πρώτη στάση κλείνει ως `missingExit`
 *  - OUT χωρίς IN → καταγράφεται ως `orphanExit`
 */
export function buildSessions(events: Event[]): ParkingSession[] {
  const byPlate = new Map<string, Event[]>();
  for (const e of events) {
    const plate = (e.licensePlate || "").trim().toUpperCase();
    // Αναγνωρίσεις χωρίς πινακίδα ("NO PLATES") δεν αντιπαραβάλλονται με τίποτα.
    if (!isReadablePlate(plate)) continue;
    if (!byPlate.has(plate)) byPlate.set(plate, []);
    byPlate.get(plate)!.push(e);
  }

  const sessions: ParkingSession[] = [];
  for (const [plate, evs] of byPlate) {
    evs.sort((a, b) => a.recognitionTime.getTime() - b.recognitionTime.getTime());
    let openEntry: Date | null = null;

    for (const e of evs) {
      if (e.direction === "IN") {
        if (openEntry) {
          sessions.push(blank(plate, openEntry, null, { missingExit: true }));
        }
        openEntry = e.recognitionTime;
      } else if (e.direction === "OUT") {
        if (openEntry) {
          sessions.push(blank(plate, openEntry, e.recognitionTime));
          openEntry = null;
        } else {
          sessions.push(blank(plate, e.recognitionTime, e.recognitionTime, { orphanExit: true }));
        }
      }
    }
    if (openEntry) sessions.push(blank(plate, openEntry, null));
  }

  sessions.sort((a, b) => b.entry.getTime() - a.entry.getTime());
  return sessions;
}

function blank(
  plate: string,
  entry: Date,
  exit: Date | null,
  flags: { missingExit?: boolean; orphanExit?: boolean } = {}
): ParkingSession {
  return {
    plate,
    entry,
    exit,
    durationMinutes: exit ? Math.round((exit.getTime() - entry.getTime()) / 60000) : null,
    passThrough:
      exit != null &&
      !flags.orphanExit &&
      (exit.getTime() - entry.getTime()) / 60000 <= MIN_STAY_MINUTES,
    contractInst: null,
    isExempt: false,
    charge: null,
    missingExit: flags.missingExit ?? false,
    orphanExit: flags.orphanExit ?? false,
  };
}

/**
 * Οι στάσεις μιας περιόδου.
 *
 * ΠΗΓΗ ΑΛΗΘΕΙΑΣ: οι μόνιμοι πίνακες `parking_stays` και `parking_inventory`,
 * ΟΧΙ τα ακατέργαστα συμβάντα των καμερών.
 *
 * Ο λόγος είναι η ώρα εισόδου. Η απογραφή ξεκινά από το ψηφιακό πελατολόγιο,
 * οπότε ένα όχημα μπορεί να μπήκε πριν αρχίσουμε να βλέπουμε — δεν υπάρχει
 * `IN` από κάμερα, αλλά η ώρα εισόδου είναι γνωστή. Χτίζοντας τις στάσεις μόνο
 * από συμβάντα, μια τέτοια έξοδος γινόταν «στάση μηδέν λεπτών» με ώρα εισόδου
 * την ώρα της εξόδου, και η αντιπαραβολή ανέφερε τεράστιες ψεύτικες διαφορές
 * ώρας (π.χ. +178′ για όχημα που στην πραγματικότητα συμφωνούσε στο λεπτό).
 *
 * Τα συμβάντα χρησιμοποιούνται μόνο ως εφεδρεία, για ό,τι δεν καλύπτεται.
 */
export async function getParkingSessions(
  from: Date,
  to: Date,
  tariff: Tariff = DEFAULT_TARIFF
): Promise<ParkingSession[]> {
  const [stays, inside, events, plateToInst, exempt] = await Promise.all([
    prisma.parkingStay.findMany({
      where: { exitedAt: { gte: from, lte: to } },
      orderBy: { exitedAt: "desc" },
    }),
    prisma.parkingInventory.findMany(),
    prisma.lprRecognitionEvent.findMany({
      where: { recognitionTime: { gte: from, lte: to } },
      select: { licensePlate: true, direction: true, recognitionTime: true },
      orderBy: { recognitionTime: "asc" },
    }),
    getActiveContractPlates(),
    getExemptPlates(to),
  ]);

  const sessions: ParkingSession[] = [];
  const covered = new Set<string>();

  // 1) Ολοκληρωμένες σταθμεύσεις — η ώρα εισόδου είναι η πραγματική.
  for (const stay of stays) {
    sessions.push({
      plate: stay.plate,
      entry: stay.enteredAt,
      exit: stay.exitedAt,
      durationMinutes: stay.minutes,
      contractInst: stay.contractInst,
      isExempt: exempt.has(stay.plate),
      charge: calculateCharge(
        {
          entry: stay.enteredAt,
          exit: stay.exitedAt,
          hasContract: stay.contractInst != null,
          isExempt: exempt.has(stay.plate),
        },
        tariff
      ),
      missingExit: false,
      orphanExit: false,
      passThrough: stay.minutes <= MIN_STAY_MINUTES,
    });
    covered.add(stay.plate);
  }

  // 2) Οχήματα που βρίσκονται ακόμα μέσα.
  for (const row of inside) {
    if (row.enteredAt > to) continue;
    sessions.push({
      plate: row.plate,
      entry: row.enteredAt,
      exit: null,
      durationMinutes: null,
      contractInst: row.contractInst,
      isExempt: exempt.has(row.plate),
      charge: null,
      missingExit: false,
      orphanExit: false,
      passThrough: false,
    });
    covered.add(row.plate);
  }

  // 3) Εφεδρεία: πινακίδες που δεν εμφανίζονται πουθενά αλλού — π.χ. περάσματα
  //    ή συμβάντα που δεν πρόλαβαν να περάσουν στην απογραφή.
  const leftovers = events.filter(
    (e) => !covered.has((e.licensePlate || "").trim().toUpperCase())
  );
  for (const session of buildSessions(leftovers)) {
    const inst = plateToInst.get(session.plate) ?? null;
    session.contractInst = inst;
    session.isExempt = exempt.has(session.plate);
    if (session.exit && !session.orphanExit) {
      session.charge = calculateCharge(
        { entry: session.entry, exit: session.exit, hasContract: inst != null, isExempt: session.isExempt },
        tariff
      );
    }
    sessions.push(session);
  }

  sessions.sort((a, b) => b.entry.getTime() - a.entry.getTime());
  return sessions;
}

/** Ποια οχήματα βρίσκονται ΤΩΡΑ μέσα, σύμφωνα με τις κάμερες. */
export async function getCarsInside(lookbackDays = 7): Promise<ParkingSession[]> {
  const now = wallClockNow();
  const from = new Date(now.getTime() - lookbackDays * 24 * 3600 * 1000);
  const sessions = await getParkingSessions(from, now);
  return sessions.filter((s) => s.exit === null && !s.missingExit);
}
