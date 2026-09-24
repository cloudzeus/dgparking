import type { Prisma } from "@prisma/client";

/**
 * Ενεργή σύμβαση = δεν έχει λήξει ακόμα.
 *
 * Το μόνο πεδίο λήξης που γεμίζει το ERP είναι το `WDATETO` (3.587/3.587
 * εγγραφές). Το `ISACTIVE` είναι 1 σε όλες, άρα δεν διακρίνει τίποτα, και τα
 * `GDATEFROM`/`GDATETO` είναι κενά παντού — μην τα χρησιμοποιείς ως κριτήριο.
 *
 * Η σύγκριση γίνεται με την αρχή της σημερινής ημέρας, ώστε μια σύμβαση που
 * λήγει σήμερα να μετράει ως ενεργή μέχρι το τέλος της ημέρας.
 */
export function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Φίλτρο Prisma για τις μη ληγμένες συμβάσεις. */
export function activeContractWhere(now: Date = new Date()): Prisma.iNSTWhereInput {
  return { WDATETO: { gte: startOfToday(now) } };
}

/** Ο ίδιος κανόνας για έλεγχο σε ήδη φορτωμένη εγγραφή. */
export function isContractActive(
  contract: { WDATETO: Date | null },
  now: Date = new Date()
): boolean {
  return contract.WDATETO != null && contract.WDATETO >= startOfToday(now);
}
