/**
 * Συντονισμός με το ψηφιακό πελατολόγιο και παρακολούθηση αποκλίσεων.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ BASELINE
 * Πριν τον συντονισμό, η αντιπαραβολή έβγαζε εκατοντάδες «αποκλίσεις» που ήταν
 * απλώς ιστορικό: σταθμεύσεις ξεκινημένες πριν αρχίσουμε να κοιτάμε, κλεισίματα
 * βάρδιας, χαμένα περάσματα. Παίρνουμε λοιπόν μία φωτογραφία της στιγμής που
 * συντονιζόμαστε — ποια οχήματα θεωρεί το ERP ανοιχτά και ποια οι κάμερες — και
 * από εκεί και μετά παρακολουθούμε ΜΟΝΟ ό,τι γεννιέται καινούργιο.
 *
 * ΜΟΝΟ ΑΝΑΓΝΩΣΗ προς το ERP. Γράφουμε μόνο στη δική μας βάση.
 */

import { prisma } from "@/lib/prisma";
import { wallClockNow } from "@/lib/parking-time";
import { getCarsInside } from "@/lib/parking-sessions";
import {
  fetchErpStays,
  reconcilePeriod,
  type ReconRow,
  type MatchStatus,
} from "@/lib/parking-reconcile";
import type { ParkingDeviationKind } from "@prisma/client";

/** Πόσο πίσω κοιτάμε για ανοιχτές εγγραφές όταν παίρνουμε το baseline. */
const OPEN_LOOKBACK_DAYS = 14;

/**
 * Παίρνει τη φωτογραφία της τρέχουσας στιγμής. Τρέχει ΜΙΑ φορά, όταν θέλουμε
 * να συντονιστούμε· κάθε νέα κλήση ανοίγει νέο baseline και η παρακολούθηση
 * ξεκινά ξανά από εκεί.
 */
export async function takeBaseline(note?: string) {
  const now = wallClockNow();
  const from = new Date(now.getTime() - OPEN_LOOKBACK_DAYS * 24 * 3600 * 1000);

  const [cameraInside, erpStays] = await Promise.all([
    getCarsInside(OPEN_LOOKBACK_DAYS),
    fetchErpStays(from, now),
  ]);

  const erpOpen = erpStays.filter((s) => s.exit === null);
  const erpByPlate = new Map(erpOpen.map((s) => [s.plate, s]));
  const camByPlate = new Map(cameraInside.map((s) => [s.plate, s]));
  const plates = new Set([...erpByPlate.keys(), ...camByPlate.keys()]);

  let matched = 0;
  const entries = [...plates].map((plate) => {
    const erp = erpByPlate.get(plate) ?? null;
    const cam = camByPlate.get(plate) ?? null;
    if (erp && cam) matched++;
    return {
      plate,
      erpSoaction: erp?.soaction ?? null,
      erpEntry: erp?.entry ?? null,
      cameraEntry: cam?.entry ?? null,
      inErp: erp != null,
      inCameras: cam != null,
      contractInst: cam?.contractInst ?? erp?.inst ?? null,
    };
  });

  const baseline = await prisma.parkingBaseline.create({
    data: {
      takenAt: new Date(),
      erpOpen: erpOpen.length,
      cameraIn: cameraInside.length,
      matched,
      note: note ?? null,
      entries: { createMany: { data: entries } },
    },
    include: { _count: { select: { entries: true } } },
  });

  return {
    baseline,
    erpOpen: erpOpen.length,
    cameraIn: cameraInside.length,
    matched,
    onlyErp: erpOpen.length - matched,
    onlyCameras: cameraInside.length - matched,
  };
}

export async function getLatestBaseline() {
  return prisma.parkingBaseline.findFirst({ orderBy: { takenAt: "desc" } });
}

const KIND: Record<Exclude<MatchStatus, "MATCH">, ParkingDeviationKind> = {
  AMOUNT_DIFF: "AMOUNT_DIFF",
  TIME_DIFF: "TIME_DIFF",
  MISSING_IN_ERP: "MISSING_IN_ERP",
  MISSING_IN_CAMERAS: "MISSING_IN_CAMERAS",
};

/**
 * Ταυτότητα απόκλισης. Πρέπει να είναι σταθερή ανάμεσα σε δύο εκτελέσεις για
 * την ίδια πραγματική απόκλιση, αλλιώς θα στέλναμε το ίδιο email ξανά και ξανά.
 * Κλειδώνουμε σε πινακίδα + είδος + ώρα εισόδου στο λεπτό.
 */
function signatureOf(row: ReconRow): string {
  const anchor = row.ours?.entry ?? row.erp?.entry ?? new Date(0);
  return `${row.plate}|${row.status}|${anchor.toISOString().slice(0, 16)}`;
}

/**
 * Ανιχνεύει αποκλίσεις από το baseline μέχρι τώρα και τις καταγράφει.
 * Επιστρέφει ΜΟΝΟ τις καινούργιες — αυτές που δεν έχουν ξανακαταγραφεί.
 */
export async function detectDeviations() {
  const baseline = await getLatestBaseline();
  if (!baseline) {
    throw new Error(
      "Δεν έχει ληφθεί baseline. Τρέξε πρώτα τον συντονισμό με το ψηφιακό πελατολόγιο."
    );
  }

  const now = wallClockNow();
  // Το baseline αποθηκεύεται σε πραγματικό χρόνο· η αντιπαραβολή δουλεύει σε
  // ρολόι τοίχου. Μετατρέπουμε κρατώντας το διάστημα που πέρασε.
  const elapsedMs = Date.now() - baseline.takenAt.getTime();
  const fromWall = new Date(now.getTime() - elapsedMs);

  const { rows, summary } = await reconcilePeriod(fromWall, now);

  // Πινακίδες που ήταν ήδη ανοιχτές τη στιγμή του συντονισμού: ό,τι τις αφορά
  // πριν κλείσουν είναι κληρονομιά, όχι νέα απόκλιση.
  const baselinePlates = new Set(
    (
      await prisma.parkingBaselineEntry.findMany({
        where: { baselineId: baseline.id },
        select: { plate: true },
      })
    ).map((e) => e.plate)
  );

  const candidates = rows.filter(
    (r) => r.status !== "MATCH" && !baselinePlates.has(r.plate)
  );

  const created: { signature: string; plate: string; kind: ParkingDeviationKind; explanation: string }[] = [];

  for (const row of candidates) {
    const signature = signatureOf(row);
    const kind = KIND[row.status as Exclude<MatchStatus, "MATCH">];
    const data = {
      plate: row.plate,
      kind,
      ourEntry: row.ours?.entry ?? null,
      ourExit: row.ours?.exit ?? null,
      ourAmount: row.ourAmount,
      erpSoaction: row.erp?.soaction ?? null,
      erpEntry: row.erp?.entry ?? null,
      erpExit: row.erp?.exit ?? null,
      erpAmount: row.erpAmount,
      explanation: row.explanation,
    };

    const existing = await prisma.parkingDeviation.findUnique({
      where: { signature },
      select: { id: true },
    });
    if (existing) {
      await prisma.parkingDeviation.update({ where: { signature }, data });
      continue;
    }
    await prisma.parkingDeviation.create({ data: { signature, ...data } });
    created.push({ signature, plate: row.plate, kind, explanation: row.explanation });
  }

  return { baseline, summary, examined: rows.length, created, since: baseline.takenAt };
}

/** Αποκλίσεις που δεν έχουν ακόμα σταλεί με email. */
export async function pendingNotifications(limit = 100) {
  return prisma.parkingDeviation.findMany({
    where: { notifiedAt: null, resolvedAt: null },
    orderBy: { firstSeenAt: "asc" },
    take: limit,
  });
}

export async function markNotified(ids: string[]) {
  if (ids.length === 0) return;
  await prisma.parkingDeviation.updateMany({
    where: { id: { in: ids } },
    data: { notifiedAt: new Date() },
  });
}
