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
import { calculateCharge } from "@/lib/parking-tariff";

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
  /**
   * Τι ΘΑ χρεωνόταν, ανά όχημα, αν ίσχυε χρέωση υπέρβασης.
   *
   * Σήμερα δεν χρεώνεται: ο τιμοκατάλογος επιστρέφει μηδέν για κάθε όχημα
   * σύμβασης. Ο αριθμός υπάρχει για να φαίνεται το μέγεθος πριν παρθεί η
   * απόφαση, όχι επειδή κόβεται.
   */
  chargeable: { plate: string; minutes: number; amount: number }[];
  chargeableAmount: number;
};

export type OverrunReport = {
  from: Date;
  to: Date;
  contractsChecked: number;
  contracts: ContractOverrun[];
  totals: { contracts: number; windows: number; minutes: number; amount: number };
  error?: string;
};

const dayLabel = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export type Pass = { plate: string; entry: Date; exit: Date | null };

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
    totals: { contracts: 0, windows: 0, minutes: 0, amount: 0 },
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

    // Τι θα χρεωνόταν κάθε όχημα για τον χρόνο που ήταν πέρα από τις θέσεις.
    const chargeable: { plate: string; minutes: number; amount: number }[] = [];
    for (const p of passes) {
      const exit = p.exit ?? now;
      const minutes = chargeableOverrunMinutes(passes, slots, p.plate, p.entry, exit, now);
      if (minutes <= 0) continue;
      // Ο τιμοκατάλογος δουλεύει σε διάστημα, οπότε ο χρεώσιμος χρόνος
      // τιμολογείται σαν αυτοτελής στάθμευση απλού πελάτη.
      const base = new Date(0);
      const amount = calculateCharge({
        entry: base,
        exit: new Date(minutes * 60_000),
        hasContract: false,
      }).amount;
      chargeable.push({ plate: p.plate, minutes, amount });
    }

    result.push({
      inst,
      name: nameByInst.get(inst) ?? "—",
      slots,
      windows: windows.sort((a, b) => b.start.getTime() - a.start.getTime()),
      totalMinutes: windows.reduce((s, w) => s + w.minutes, 0),
      worstPeak: Math.max(...windows.map((w) => w.peak)),
      chargeable: chargeable.sort((a, b) => b.minutes - a.minutes),
      chargeableAmount: chargeable.reduce((s, c) => s + c.amount, 0),
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
      amount: result.reduce((s, c) => s + c.chargeableAmount, 0),
    },
  };
}

/* ── Χρεώσιμος χρόνος υπέρβασης ──────────────────────────────────────────── */

/**
 * Πόσα λεπτά ένα όχημα σύμβασης ήταν ΠΕΡΑ από τις πληρωμένες θέσεις.
 *
 * Ο ΚΑΝΟΝΑΣ
 * Οι θέσεις πιάνονται κατά σειρά άφιξης. Αν η σύμβαση έχει δύο θέσεις και
 * μέσα βρίσκονται τρία οχήματα, καλυμμένα είναι τα δύο που ήρθαν πρώτα και
 * χρεώσιμο το τρίτο. Μόλις φύγει ένα από τα δύο πρώτα, το τρίτο ανεβαίνει σε
 * καλυμμένη θέση και η χρέωσή του ΣΤΑΜΑΤΑ.
 *
 * ΓΙΑΤΙ ΕΤΣΙ ΚΑΙ ΟΧΙ «ΠΛΗΡΩΝΕΙ ΟΠΟΙΟΣ ΠΡΟΚΑΛΕΣΕ»
 * Το «ποιος προκάλεσε» είναι χρήσιμο για εξήγηση, αλλά άδικο ως χρέωση: αν το
 * όχημα που ήρθε τρίτο μείνει δέκα λεπτά και φύγει ένα από τα προηγούμενα
 * στο πέμπτο, δεν υπάρχει λόγος να πληρώνει για τα υπόλοιπα πέντε. Η σειρά
 * άφιξης δίνει κανόνα που στέκει και εξηγείται στον πελάτη.
 */
export function chargeableOverrunMinutes(
  passes: Pass[],
  slots: number,
  plate: string,
  entry: Date,
  exit: Date,
  now: Date
): number {
  // Όλες οι χρονικές στιγμές όπου αλλάζει η σύνθεση.
  const points = new Set<number>([entry.getTime(), exit.getTime()]);
  for (const p of passes) {
    points.add(p.entry.getTime());
    points.add((p.exit ?? now).getTime());
  }
  const sorted = [...points].sort((a, b) => a - b);

  let minutes = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    if (to <= entry.getTime() || from >= exit.getTime()) continue;

    // Ποια ήταν μέσα σε αυτό το διάστημα, κατά σειρά άφιξης.
    const inside = passes
      .filter((p) => p.entry.getTime() <= from && (p.exit ?? now).getTime() > from)
      .sort((a, b) => a.entry.getTime() - b.entry.getTime());

    const rank = inside.findIndex((p) => p.plate === plate);
    // `rank` μετρά από το μηδέν: με δύο θέσεις, καλυμμένα είναι τα 0 και 1.
    if (rank >= slots) {
      minutes += Math.round((Math.min(to, exit.getTime()) - Math.max(from, entry.getTime())) / 60000);
    }
  }
  return Math.max(0, minutes);
}

/** Τα περάσματα μιας σύμβασης — για τον υπολογισμό χρέωσης τη στιγμή της εξόδου. */
export async function contractPasses(inst: number, from: Date, to: Date): Promise<Pass[]> {
  const [erp, inventory] = await Promise.all([
    fetchErpStays(from, to).catch(() => []),
    prisma.parkingInventory.findMany({ where: { contractInst: inst } }),
  ]);

  const passes: Pass[] = erp
    .filter((s) => s.inst === inst && s.entry)
    .map((s) => ({ plate: s.plate, entry: s.entry!, exit: s.exit }));

  for (const i of inventory) {
    const already = passes.some(
      (p) => p.plate === i.plate && Math.abs(p.entry.getTime() - i.enteredAt.getTime()) < 10 * 60_000
    );
    if (!already) passes.push({ plate: i.plate, entry: i.enteredAt, exit: null });
  }
  return passes;
}
