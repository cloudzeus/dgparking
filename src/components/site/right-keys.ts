/**
 * Τα δικαιώματα του ΓΚΠΔ με τη σειρά του Κανονισμού. Τα κλειδιά ταιριάζουν
 * με το `DataRequestType` του Prisma, αλλά το αρχείο μένει καθαρό από
 * εξαρτήσεις ώστε να το χρησιμοποιούν και τα client components.
 */
export const RIGHT_KEYS = [
  "ACCESS",
  "RECTIFICATION",
  "ERASURE",
  "RESTRICTION",
  "PORTABILITY",
  "OBJECTION",
  "WITHDRAW",
] as const;

export type RightKey = (typeof RIGHT_KEYS)[number];

export function isRightKey(value: unknown): value is RightKey {
  return typeof value === "string" && (RIGHT_KEYS as readonly string[]).includes(value);
}
