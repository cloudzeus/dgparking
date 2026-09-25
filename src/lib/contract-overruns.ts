/**
 * Υπερβάσεις συμβάσεων: πότε μια σύμβαση είχε περισσότερα οχήματα ΤΑΥΤΟΧΡΟΝΑ
 * μέσα από τις θέσεις που πληρώνει.
 *
 * ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΝΑ ΜΕΤΡΗΘΟΥΝ ΟΙ ΠΙΝΑΚΙΔΕΣ
 * Μια σύμβαση δύο θέσεων επιτρέπεται να έχει έξι δηλωμένες πινακίδες — τρεις
 * ανά θέση. Υπέρβαση δεν είναι «έχει πολλές πινακίδες», είναι «είχε τρία
 * αυτοκίνητα μέσα την ίδια στιγμή». Το ερώτημα είναι χρονικό, όχι
 * απογραφικό, και απαντιέται μόνο με σάρωση της γραμμής του χρόνου.
 *
 * Η ΣΑΡΩΣΗ
 * Για κάθε σύμβαση, τα περάσματα των οχημάτων της γίνονται συμβάντα «+1» στην
 * είσοδο και «−1» στην έξοδο, ταξινομούνται, και μετριέται το τρέχον πλήθος.
 * Κάθε διάστημα όπου το πλήθος ξεπερνά τις θέσεις είναι μία υπέρβαση, με
 * αρχή, τέλος και τα οχήματα που ήταν μέσα.
 *
 * ΓΙΑΤΙ ΑΠΟ ΤΟ ERP ΚΑΙ ΟΧΙ ΑΠΟ ΤΙΣ ΔΙΚΕΣ ΜΑΣ ΣΤΑΣΕΙΣ
 * Οι δικές μας στάσεις ξεκινούν από τον τελευταίο μηδενισμό· το βιβλίο πόρτας
 * έχει μήνες ιστορικού. Για ερώτημα «πόσο συχνά συμβαίνει», το ιστορικό είναι
 * το παν.
 */

import { prisma } from "@/lib/prisma";
import { activeContractWhere } from "@/lib/contract-active";
import { fetchErpStays } from "@/lib/parking-reconcile";
import { wallClockNow } from "@/lib/parking-time";

export type OverrunWindow = {
  /** Ημέρα σε μορφή ΗΗ/ΜΜ, για ομαδοποίηση. */
  day: string;
  start: Date;
  end: Date | null;
  minutes: number;
  /** Πόσα οχήματα ήταν μέσα στην κορύφωση. */
  peak: number;
  slots: number;
  plates: string[];
  /**
   * Το όχημα του οποίου η είσοδος ξεπέρασε το όριο.
   *
   * Είναι η αιτιολόγηση: «τρία σε δύο θέσεις» δεν λέει σε ποιον να μιλήσεις,
   * «το ΙΖΖ4504 μπήκε στις 08:17 ενώ ήταν ήδη δύο μέσα» λέει.
   */
  causedBy: string | null;
  /** Ποια ήταν ήδη μέσα όταν συνέβη. */
  alreadyInside: string[];
  /** Ανοιχτή τώρα — το τέλος δεν έχει έρθει ακόμα. */
  ongoing: boolean;
};

export type ContractOverrun = {
  inst: number;
  name: string;
  slots: number;
  windows: OverrunWindow[];
  totalMinutes: number;
  worstPeak: number;
};

export type OverrunReport = {
  from: Date;
  to: Date;
  contractsChecked: number;
  contracts: ContractOverrun[];
  totals: { contracts: number; windows: number; minutes: number };
  error?: string;
};

const dayLabel = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

type Pass = { plate: string; entry: Date; exit: Date | null };

/**
 * Οι υπερβάσεις μιας σύμβασης.
 *
 * Τα οχήματα που δεν έχουν βγει παίρνουν τέλος «τώρα», αλλιώς μια ανοιχτή
 * στάθμευση θα έκρυβε την υπέρβαση που προκαλεί αυτή τη στιγμή.
 */
function scan(passes: Pass[], slots: number, now: Date): OverrunWindow[] {
  type Ev = { at: Date; delta: number; plate: string };
  const events: Ev[] = [];
  for (const p of passes) {
    events.push({ at: p.entry, delta: +1, plate: p.plate });
    events.push({ at: p.exit ?? now, delta: -1, plate: p.plate });
  }
  // Οι έξοδοι προηγούνται των εισόδων στην ίδια στιγμή: ένα αυτοκίνητο που
  // φεύγει τη στιγμή που έρχεται το επόμενο δεν είναι υπέρβαση.
  events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.delta - b.delta);

  const windows: OverrunWindow[] = [];
  const active = new Set<string>();
  let current: OverrunWindow | null = null;

  for (const e of events) {
    if (e.delta > 0) active.add(e.plate);
    else active.delete(e.plate);

    const count = active.size;

    if (count > slots) {
      if (!current) {
        current = {
          day: dayLabel(e.at),
          start: e.at,
          end: null,
          minutes: 0,
          peak: count,
          slots,
          plates: [...active],
          causedBy: e.delta > 0 ? e.plate : null,
          alreadyInside: [...active].filter((p) => p !== e.plate),
          ongoing: false,
        };
      } else {
        current.peak = Math.max(current.peak, count);
        for (const p of active) if (!current.plates.includes(p)) current.plates.push(p);
      }
    } else if (current) {
      current.end = e.at;
      current.minutes = Math.round((e.at.getTime() - current.start.getTime()) / 60000);
      windows.push(current);
      current = null;
    }
  }

  if (current) {
    current.ongoing = true;
    current.end = null;
    current.minutes = Math.round((now.getTime() - current.start.getTime()) / 60000);
    windows.push(current);
  }

  // Στιγμιαίες υπερβάσεις είναι θόρυβος αναγνώρισης, όχι πραγματικό γεγονός.
  return windows.filter((w) => w.minutes >= 1);
}

export async function buildOverrunReport(days = 7): Promise<OverrunReport> {
  const now = wallClockNow();
  const to = now;
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1)
  );

  const base: OverrunReport = {
    from,
    to,
    contractsChecked: 0,
    contracts: [],
    totals: { contracts: 0, windows: 0, minutes: 0 },
  };

  const contracts = await prisma.iNST.findMany({
    where: { ...activeContractWhere(), lines: { some: {} } },
    select: { INST: true, NAME: true, NUM01: true, TRDR: true },
  });
  base.contractsChecked = contracts.length;

  const slotsByInst = new Map(
    contracts.map((c) => [c.INST, c.NUM01 != null ? Math.max(1, Number(c.NUM01)) : 1])
  );
  const nameByInst = new Map(contracts.map((c) => [c.INST, (c.NAME ?? "—").trim()]));

  let erpStays: Awaited<ReturnType<typeof fetchErpStays>>;
  try {
    erpStays = await fetchErpStays(from, to);
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Το βιβλίο πόρτας δεν διαβάστηκε." };
  }

  // Όσα βρίσκονται ΤΩΡΑ μέσα και δεν έχουν κλείσει στο ERP.
  const inventory = await prisma.parkingInventory.findMany({
    where: { contractInst: { not: null } },
  });

  const byInst = new Map<number, Pass[]>();
  for (const s of erpStays) {
    if (s.inst == null || !s.entry) continue;
    if (!slotsByInst.has(s.inst)) continue;
    if (!byInst.has(s.inst)) byInst.set(s.inst, []);
    byInst.get(s.inst)!.push({ plate: s.plate, entry: s.entry, exit: s.exit });
  }
  for (const i of inventory) {
    const inst = i.contractInst!;
    if (!slotsByInst.has(inst)) continue;
    const list = byInst.get(inst) ?? [];
    // Αν το ERP έχει ήδη την ίδια στάθμευση ανοιχτή, δεν τη διπλομετράμε.
    const already = list.some(
      (p) => p.plate === i.plate && Math.abs(p.entry.getTime() - i.enteredAt.getTime()) < 10 * 60_000
    );
    if (!already) list.push({ plate: i.plate, entry: i.enteredAt, exit: null });
    byInst.set(inst, list);
  }

  const result: ContractOverrun[] = [];
  for (const [inst, passes] of byInst) {
    const slots = slotsByInst.get(inst)!;
    const windows = scan(passes, slots, now);
    if (windows.length === 0) continue;
    result.push({
      inst,
      name: nameByInst.get(inst) ?? "—",
      slots,
      windows: windows.sort((a, b) => b.start.getTime() - a.start.getTime()),
      totalMinutes: windows.reduce((s, w) => s + w.minutes, 0),
      worstPeak: Math.max(...windows.map((w) => w.peak)),
    });
  }

  result.sort((a, b) => b.totalMinutes - a.totalMinutes);

  return {
    ...base,
    contracts: result,
    totals: {
      contracts: result.length,
      windows: result.reduce((s, c) => s + c.windows.length, 0),
      minutes: result.reduce((s, c) => s + c.totalMinutes, 0),
    },
  };
}
