/**
 * Τα πακέτα πλυσίματος και οι τιμές τους. Τα ονόματα και τα χαρακτηριστικά
 * ζουν στα μηνύματα (`carWash.packages`, `carWash.booking.services`) — εδώ
 * μένουν μόνο τα κλειδιά και τα ποσά, ώστε να μορφοποιούνται ανά γλώσσα.
 */
export const WASH_PACKAGES = [
  { key: "basic", price: 20, featured: false, features: ["exterior", "tires", "windows"] },
  { key: "premium", price: 30, featured: true, features: ["basic", "vacuum", "dashboard", "freshener"] },
  { key: "deluxe", price: 40, featured: false, features: ["premium", "wax", "shine", "detailing"] },
] as const;

/** Όλες οι υπηρεσίες που μπορεί να ζητήσει ο πελάτης στη φόρμα κράτησης. */
export const WASH_SERVICES = [
  { key: "basic", price: 20 },
  { key: "premium", price: 30 },
  { key: "deluxe", price: 40 },
  { key: "interior", price: 35 },
  { key: "complete", price: 70 },
] as const;

export type WashServiceKey = (typeof WASH_SERVICES)[number]["key"];

/** Οι διαθέσιμες ώρες ραντεβού. */
export const WASH_TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;
