/**
 * ΑΦΜ — κανονικοποίηση και έλεγχος ψηφίου ελέγχου.
 *
 * Το ΑΦΜ είναι ΔΗΜΟΣΙΑ πληροφορία: το ότι κάποιος το γνωρίζει δεν αποδεικνύει
 * ότι ανήκει στην εταιρία. Χρησιμεύει μόνο για να βρεθεί ο πελάτης· η πρόσβαση
 * δίνεται πάντα με ανθρώπινη έγκριση (βλ. CustomerPortalAccess).
 *
 * Ο έλεγχος εδώ πιάνει τυπογραφικά λάθη πριν φτάσουν στην ουρά εγκρίσεων.
 */

/** Κρατά μόνο ψηφία και συμπληρώνει στα 9 με μηδενικά μπροστά. */
export function normalizeAfm(input: string): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 0) return "";
  return digits.length < 9 ? digits.padStart(9, "0") : digits;
}

/**
 * Αλγόριθμος ΑΑΔΕ: τα οκτώ πρώτα ψηφία σταθμίζονται με δυνάμεις του 2 από το
 * 2^8 ως το 2^1, το άθροισμα mod 11 και mod 10 δίνει το ένατο ψηφίο.
 */
export function isValidAfm(input: string): boolean {
  const afm = normalizeAfm(input);
  if (!/^\d{9}$/.test(afm)) return false;
  if (afm === "000000000") return false;
  // Το 999999999 είναι ο «πελάτης λιανικής» του ERP, όχι πραγματική οντότητα.
  if (afm === "999999999") return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(afm[i]) * 2 ** (8 - i);
  }
  return (sum % 11) % 10 === Number(afm[8]);
}
