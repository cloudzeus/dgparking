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
import { wallClockNow } from "@/lib/parking-time";
import { fetchErpStays } from "@/lib/parking-reconcile";
import { getActiveContractPlates } from "@/lib/parking-sessions";
import { calculateCharge } from "@/lib/parking-tariff";
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
    const key = plate.trim().toUpperCase();
    if (!key) return { action: "ignored", reason: "κενή πινακίδα" };

    if (direction === "IN") {
      const existing = await prisma.parkingInventory.findUnique({ where: { plate: key } });
      if (existing) {
        // Ήδη μέσα: δεύτερο IN χωρίς OUT. Κρατάμε την ΠΡΩΤΗ είσοδο, γιατί αυτή
        // ορίζει τη χρέωση· αν κρατούσαμε τη νέα, μια διπλοανάγνωση στην μπάρα
        // θα μηδένιζε τον χρόνο παραμονής.
        return { action: "ignored", reason: "βρίσκεται ήδη στην απογραφή" };
      }
      const contract = await getActiveContractPlates();
      await prisma.parkingInventory.create({
        data: {
          plate: key,
          enteredAt: at,
          source: "CAMERA",
          contractInst: contract.get(key) ?? null,
        },
      });
      return { action: "added" };
    }

    const current = await prisma.parkingInventory.findUnique({ where: { plate: key } });
    if (!current) return { action: "ignored", reason: "δεν βρισκόταν στην απογραφή" };

    const minutes = Math.max(0, Math.round((at.getTime() - current.enteredAt.getTime()) / 60000));
    const charge = calculateCharge({
      entry: current.enteredAt,
      exit: at,
      hasContract: current.contractInst != null,
    });

    await prisma.$transaction([
      prisma.parkingStay.create({
        data: {
          plate: key,
          enteredAt: current.enteredAt,
          exitedAt: at,
          minutes,
          amount: charge.amount,
          contractInst: current.contractInst,
          enteredFrom: current.source,
        },
      }),
      prisma.parkingInventory.delete({ where: { plate: key } }),
    ]);

    return { action: "removed" };
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
