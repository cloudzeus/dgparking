"use server";

/**
 * Διαχείριση απαλλαγμένων πινακίδων.
 *
 * Οι προτάσεις προκύπτουν από τα ίδια τα δεδομένα του ψηφιακού πελατολογίου:
 * οχήματα εκτός σύμβασης που δεν χρεώθηκαν ΠΟΤΕ σε βάθος μηνών είναι σχεδόν
 * σίγουρα συμφωνία, και είναι παράλογο να πληκτρολογηθούν 199 πινακίδες στο
 * χέρι όταν η βάση τις ξέρει ήδη.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePlate } from "@/lib/exempt-plates";
import { fetchErpStays } from "@/lib/parking-reconcile";
import { wallClockNow } from "@/lib/parking-time";
import { calculateCharge } from "@/lib/parking-tariff";

export type ExemptResult = { success?: boolean; error?: string };

async function requireManager() {
  const session = await auth();
  if (!session?.user) return { error: "Απαιτείται σύνδεση." } as const;
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Δεν έχετε δικαίωμα." } as const;
  }
  return { userId: session.user.id as string } as const;
}

export async function addExemptPlate(
  plateInput: string,
  category: string,
  note?: string
): Promise<ExemptResult> {
  const who = await requireManager();
  if ("error" in who) return { error: who.error };

  const plate = normalizePlate(plateInput);
  if (plate.length < 4 || plate.length > 12) {
    return { error: "Η πινακίδα πρέπει να έχει 4 έως 12 χαρακτήρες." };
  }
  if (!category.trim()) return { error: "Επίλεξε κατηγορία." };

  const existing = await prisma.exemptPlate.findUnique({ where: { plate } });
  if (existing) {
    if (existing.isActive) return { error: `Η ${plate} είναι ήδη καταχωρημένη.` };
    await prisma.exemptPlate.update({
      where: { plate },
      data: { isActive: true, category, note: note?.trim() || null, validFrom: new Date(), validUntil: null },
    });
    revalidatePath("/exempt-plates");
    return { success: true };
  }

  await prisma.exemptPlate.create({
    data: { plate, category, note: note?.trim() || null, createdById: who.userId },
  });
  revalidatePath("/exempt-plates");
  return { success: true };
}

/**
 * Απενεργοποιεί την απαλλαγή αντί να τη διαγράψει.
 *
 * Η διαγραφή θα έσβηνε το ιστορικό «από πότε ίσχυε», που είναι ακριβώς αυτό
 * που κάνει τις παλιές στάσεις εξηγήσιμες.
 */
export async function deactivateExemptPlate(id: string): Promise<ExemptResult> {
  const who = await requireManager();
  if ("error" in who) return { error: who.error };

  await prisma.exemptPlate.update({
    where: { id },
    data: { isActive: false, validUntil: new Date() },
  });
  revalidatePath("/exempt-plates");
  return { success: true };
}

export type Suggestion = {
  plate: string;
  stays: number;
  neverCharged: boolean;
  timesCharged: number;
  dueTotal: number;
  firstSeen: string;
  lastSeen: string;
};

/**
 * Υποψήφιες προς απαλλαγή: οχήματα εκτός σύμβασης με πολλές μη χρεωμένες
 * στάσεις. Διαβάζει το ERP, οπότε καλείται κατ' απαίτηση και όχι σε κάθε
 * φόρτωση σελίδας.
 */
export async function suggestExemptPlates(months = 6): Promise<Suggestion[]> {
  const who = await requireManager();
  if ("error" in who) return [];

  const now = wallClockNow();
  const all: Awaited<ReturnType<typeof fetchErpStays>> = [];
  for (let i = 0; i < months; i++) {
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    try {
      all.push(...(await fetchErpStays(from, to > now ? now : to)));
    } catch {
      // Ένας μήνας που δεν διαβάστηκε δεν ακυρώνει τους υπόλοιπους.
    }
  }

  const stays = [...new Map(all.map((s) => [s.soaction, s])).values()].filter(
    (s) => s.entry && s.exit && s.inst == null
  );

  const already = await prisma.exemptPlate.findMany({ select: { plate: true } });
  const known = new Set(already.map((a) => a.plate));

  const byPlate = new Map<
    string,
    { stays: number; charged: number; due: number; first: Date; last: Date }
  >();
  for (const s of stays) {
    if (known.has(s.plate)) continue;
    const due = calculateCharge({ entry: s.entry!, exit: s.exit! }).amount;
    if (due === 0) continue; // εντός δωρεάν χρόνου — δεν λέει τίποτα
    const b = byPlate.get(s.plate) ?? {
      stays: 0,
      charged: 0,
      due: 0,
      first: s.entry!,
      last: s.entry!,
    };
    b.stays++;
    if (s.amount > 0) b.charged++;
    else b.due += due;
    if (s.entry! < b.first) b.first = s.entry!;
    if (s.entry! > b.last) b.last = s.entry!;
    byPlate.set(s.plate, b);
  }

  const d = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;

  return [...byPlate.entries()]
    // Τουλάχιστον τρεις στάσεις: μία ή δύο δεν στοιχειοθετούν συμφωνία.
    .filter(([, b]) => b.stays >= 3 && b.due > 0)
    .map(([plate, b]) => ({
      plate,
      stays: b.stays,
      neverCharged: b.charged === 0,
      timesCharged: b.charged,
      dueTotal: Math.round(b.due * 100) / 100,
      firstSeen: d(b.first),
      lastSeen: d(b.last),
    }))
    .sort((a, b) => b.dueTotal - a.dueTotal)
    .slice(0, 150);
}
