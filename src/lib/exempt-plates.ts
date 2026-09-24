/**
 * Απαλλαγμένες πινακίδες.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * Η απαλλαγή ήταν ως τώρα απόφαση της στιγμής: το ERP κρατά μόνο `GVAL=0`,
 * χωρίς λόγο. Στα δεδομένα 12 μηνών, 199 πινακίδες δεν χρεώθηκαν ΠΟΤΕ ενώ 47
 * άλλες άλλοτε χρεώθηκαν και άλλοτε όχι — και κανείς δεν μπορούσε να πει ποιο
 * ήταν το λάθος. Με καταγεγραμμένη λίστα, η αντιπαραβολή σταματά να τις
 * αναφέρει ως ανείσπρακτες και αρχίζει να αναφέρει τις ΧΡΕΩΣΕΙΣ τους ως λάθος.
 *
 * Η απαλλαγή έχει ημερομηνία έναρξης: στάσεις πριν από αυτήν παραμένουν
 * χρεώσιμες, ώστε μια σημερινή καταχώρηση να μην «σβήνει» ιστορικό.
 */

import { prisma } from "@/lib/prisma";
import { normalizePlate } from "@/lib/plate";

export { normalizePlate };

export const EXEMPT_CATEGORIES = [
  "Προσωπικό",
  "Ιδιοκτήτες",
  "Συνεργάτες",
  "Προμηθευτές",
  "Υπηρεσιακό όχημα",
  "Άλλο",
] as const;

export type ExemptCategory = (typeof EXEMPT_CATEGORIES)[number];

/**
 * Οι πινακίδες που απαλλάσσονται σε δεδομένη στιγμή.
 *
 * Το `at` είναι η ώρα της στάθμευσης, όχι η τρέχουσα: μια απαλλαγή που
 * καταχωρήθηκε σήμερα δεν ισχύει αναδρομικά.
 */
export async function getExemptPlates(at: Date = new Date()): Promise<Set<string>> {
  const rows = await prisma.exemptPlate.findMany({
    where: {
      isActive: true,
      validFrom: { lte: at },
      OR: [{ validUntil: null }, { validUntil: { gte: at } }],
    },
    select: { plate: true },
  });
  return new Set(rows.map((r) => r.plate));
}

/** Είναι η πινακίδα απαλλαγμένη τη στιγμή της στάθμευσης; */
export async function isExempt(plate: string, at: Date = new Date()): Promise<boolean> {
  const row = await prisma.exemptPlate.findUnique({
    where: { plate: normalizePlate(plate) },
    select: { isActive: true, validFrom: true, validUntil: true },
  });
  if (!row || !row.isActive) return false;
  if (row.validFrom > at) return false;
  if (row.validUntil && row.validUntil < at) return false;
  return true;
}
