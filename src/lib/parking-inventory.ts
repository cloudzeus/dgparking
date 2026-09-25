/**
 * Απογραφή παρκινγκ — ποια οχήματα βρίσκονται ΤΩΡΑ μέσα.
 *
 * ΓΙΑΤΙ ΜΟΝΙΜΟΣ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΥΠΟΛΟΓΙΣΜΟΣ
 * Μέχρι τώρα η απάντηση «ποιος είναι μέσα» προέκυπτε σαρώνοντας τα συμβάντα των
 * καμερών. Αυτό έχει δύο προβλήματα: κοστίζει σε κάθε φόρτωση, και καταρρέει αν
 * τα ιστορικά συμβάντα σβηστούν ή αν η κάμερα χάσει ένα πέρασμα — μία χαμένη
 * έξοδος μολύνει την εικόνα για πάντα.
 *
 * Τώρα η απογραφή είναι ΚΑΤΑΣΤΑΣΗ: ξεκινά από το ψηφιακό πελατολόγιο της ΑΑΔΕ
 * (η επίσημη εικόνα) και μεταβάλλεται με κάθε πέρασμα. Όταν χρειαστεί, ξανα-
 * συγχρονίζεται από το ERP με ένα `seedFromErp`.
 */

import { prisma } from "@/lib/prisma";
import { wallClockNow, isReadablePlate } from "@/lib/parking-time";
import { normalizePlate } from "@/lib/plate";
import { fetchErpStays } from "@/lib/parking-reconcile";
import { getActiveContractPlates, MIN_STAY_MINUTES } from "@/lib/parking-sessions";
import { calculateCharge } from "@/lib/parking-tariff";
import { isExempt } from "@/lib/exempt-plates";
import { notifyDclEntry, notifyDclExit } from "@/lib/dcl/live";
import type { InventorySource } from "@prisma/client";

/** Πόσο πίσω ψάχνουμε ανοιχτές εγγραφές του ERP κατά το seed. */
const SEED_LOOKBACK_DAYS = 30;

/**
 * Μηδενίζει την απογραφή και τη γεμίζει από τις ανοιχτές εγγραφές του ψηφιακού
 * πελατολογίου. Αυτή είναι η «απογραφή από την αρχή».
 */
export async function seedFromErp() {
  const now = wallClockNow();
  const from = new Date(now.getTime() - SEED_LOOKBACK_DAYS * 24 * 3600 * 1000);

  const [stays, plateToInst] = await Promise.all([
    fetchErpStays(from, now),
    getActiveContractPlates(),
  ]);

  const open = stays.filter((s) => s.exit === null && s.entry !== null);

  // Μία πινακίδα μπορεί να έχει περισσότερες από μία ανοιχτές εγγραφές στο ERP
  // (ξεχασμένο κλείσιμο). Κρατάμε την πιο πρόσφατη — αυτή περιγράφει το όχημα
  // που είναι όντως μέσα.
  const latest = new Map<string, (typeof open)[number]>();
  for (const s of open) {
    const prev = latest.get(s.plate);
    if (!prev || s.entry!.getTime() > prev.entry!.getTime()) latest.set(s.plate, s);
  }

  const rows = [...latest.values()].map((s) => ({
    plate: s.plate,
    enteredAt: s.entry!,
    source: "ERP_SEED" as InventorySource,
    erpSoaction: s.soaction,
    contractInst: s.inst ?? plateToInst.get(s.plate) ?? null,
  }));

  const removed = await prisma.parkingInventory.deleteMany({});
  if (rows.length) {
    await prisma.parkingInventory.createMany({ data: rows });
  }

  return {
    seeded: rows.length,
    removed: removed.count,
    duplicatesCollapsed: open.length - rows.length,
    at: new Date(),
  };
}

/**
 * Εφαρμόζει ένα πέρασμα κάμερας στην απογραφή.
 *
 * Καλείται από το webhook των καμερών, μετά την αποθήκευση του συμβάντος.
 * Δεν πετάει ποτέ: ένα σφάλμα απογραφής δεν επιτρέπεται να ρίξει την παραλαβή
 * του συμβάντος — το συμβάν είναι το αποδεικτικό, η απογραφή είναι παράγωγο.
 */
export async function applyCameraPass(
  plate: string,
  direction: "IN" | "OUT",
  at: Date
): Promise<{ action: "added" | "removed" | "ignored"; reason?: string }> {
  try {
    // Η κανονικοποίηση είναι η ίδια με του ERP — αλλιώς η ίδια πινακίδα
    // γράφεται με δύο τρόπους και δεν ταιριάζει ποτέ στην αντιπαραβολή.
    const key = normalizePlate(plate);
    if (!key) return { action: "ignored", reason: "κενή πινακίδα" };

    // Χωρίς αναγνώσιμη πινακίδα δεν υπάρχει εγγραφή στο ψηφιακό πελατολόγιο:
    // το ERP δεν δέχεται στάθμευση χωρίς πινακίδα. Μια λήψη «NO PLATES» (συχνά
    // πεζός μπροστά στην κάμερα) δεν είναι όχημα — αν μπει στην απογραφή,
    // παράγει στάση και χρέωση που δεν μπορεί ποτέ να αντιπαραβληθεί.
    if (!isReadablePlate(key)) {
      return { action: "ignored", reason: "μη αναγνώσιμη πινακίδα" };
    }

    if (direction === "IN") {
      const existing = await prisma.parkingInventory.findUnique({ where: { plate: key } });
      if (existing) {
        // Ήδη μέσα: δεύτερο IN χωρίς OUT. Κρατάμε την ΠΡΩΤΗ είσοδο, γιατί αυτή
        // ορίζει τη χρέωση· αν κρατούσαμε τη νέα, μια διπλοανάγνωση στην μπάρα
        // θα μηδένιζε τον χρόνο παραμονής.
        return { action: "ignored", reason: "βρίσκεται ήδη στην απογραφή" };
      }
      const contract = await getActiveContractPlates();
      const contractInst = contract.get(key) ?? null;
      await prisma.parkingInventory.create({
        data: { plate: key, enteredAt: at, source: "CAMERA", contractInst },
      });

      // Ψηφιακό Πελατολόγιο ΑΑΔΕ. Καλείται ΑΦΟΥ γραφτεί η απογραφή: χωρίς
      // μπάρες, η καταγραφή του περάσματος είναι το μόνο που εγγυάται ότι
      // ξέρουμε ποιος μπήκε — δεν θυσιάζεται για μια κλήση σε τρίτον.
      // Δεν ρίχνει ποτέ και έχει δικό του σύντομο όριο χρόνου.
      await notifyDclEntry(key, at, contractInst);

      return { action: "added" };
    }

    const current = await prisma.parkingInventory.findUnique({ where: { plate: key } });
    if (!current) return { action: "ignored", reason: "δεν βρισκόταν στην απογραφή" };

    return closeStay(key, current, at);
  } catch (error) {
    console.error("[INVENTORY] Το πέρασμα δεν εφαρμόστηκε:", error);
    return { action: "ignored", reason: "σφάλμα" };
  }
}

/** Η τρέχουσα απογραφή, νεότερη είσοδος πρώτη. */
export async function getInventory() {
  return prisma.parkingInventory.findMany({ orderBy: { enteredAt: "desc" } });
}

export async function getInventoryStats() {
  const [total, withContract, oldest] = await Promise.all([
    prisma.parkingInventory.count(),
    prisma.parkingInventory.count({ where: { contractInst: { not: null } } }),
    prisma.parkingInventory.findFirst({ orderBy: { enteredAt: "asc" } }),
  ]);
  return { total, withContract, visitors: total - withContract, oldestEntry: oldest?.enteredAt ?? null };
}


/** Καταγραφή ανωμαλίας. Δεν ρίχνει ποτέ: το πέρασμα έχει προτεραιότητα. */
async function recordAnomaly(
  plate: string,
  kind: string,
  at: Date,
  detail: string
): Promise<void> {
  try {
    await prisma.parkingAnomaly.create({ data: { plate, kind, at, detail } });
  } catch (error) {
    console.error("[INVENTORY] Η ανωμαλία δεν καταγράφηκε:", error);
  }
}

/**
 * Κλείνει μια στάθμευση: βγάζει το όχημα από την απογραφή και, εφόσον
 * έμεινε αρκετά, γράφει τη στάση με τη χρέωσή της.
 *
 * Ζει χωριστά γιατί καλείται από ΔΥΟ σημεία: την κανονική έξοδο, και την
 * είσοδο οχήματος που βρισκόταν ήδη μέσα (έξοδος από τη λωρίδα εισόδου).
 */
async function closeStay(
  plate: string,
  current: { enteredAt: Date; contractInst: number | null; source: InventorySource },
  at: Date
): Promise<{ action: "removed"; reason?: string }> {
  const minutes = Math.max(0, Math.round((at.getTime() - current.enteredAt.getTime()) / 60000));

  // ΠΕΡΑΣΜΑ, ΟΧΙ ΣΤΑΘΜΕΥΣΗ. Όχημα που το είδαν και οι δύο κάμερες μέσα σε
  // λίγα λεπτά απλώς πέρασε. Ο τύπος χρέωσης στρογγυλοποιεί ΠΑΝΩ, οπότε μια
  // διαδρομή τριάντα δευτερολέπτων θα χρεωνόταν ολόκληρη ώρα — 5 €. Το ERP
  // δεν καταγράφει καν τέτοια, άρα θα φαινόταν και ως ψεύτικη απόκλιση.
  if (minutes <= MIN_STAY_MINUTES) {
    await prisma.parkingInventory.delete({ where: { plate } });
    return { action: "removed", reason: `πέρασμα ${minutes}′ — χωρίς χρέωση` };
  }

  const charge = calculateCharge({
    entry: current.enteredAt,
    exit: at,
    hasContract: current.contractInst != null,
    // Η απαλλαγή ελέγχεται με την ώρα της ΕΞΟΔΟΥ, όχι με το «τώρα»: μια
    // απαλλαγή που καταχωρήθηκε αργότερα δεν ισχύει αναδρομικά.
    isExempt: await isExempt(plate, at),
  });

  await prisma.$transaction([
    prisma.parkingStay.create({
      data: {
        plate,
        enteredAt: current.enteredAt,
        exitedAt: at,
        minutes,
        amount: charge.amount,
        contractInst: current.contractInst,
        enteredFrom: current.source,
      },
    }),
    prisma.parkingInventory.delete({ where: { plate } }),
  ]);

  // Κλείσιμο στο Ψηφιακό Πελατολόγιο, τη στιγμή της εξόδου. Με περιοδικό
  // συγχρονισμό, η εγγραφή έμενε ανοιχτή στην ΑΑΔΕ μέχρι το επόμενο
  // πέρασμα — που σε παραγωγικό είναι ανοιχτή φορολογική εγγραφή.
  await notifyDclExit(plate, current.enteredAt, at, charge.amount, current.contractInst);

  return { action: "removed", reason: `${minutes}′ · ${charge.amount.toFixed(2)} €` };
}
