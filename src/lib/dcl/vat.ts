/**
 * Έλεγχος εγκυρότητας ελληνικού ΑΦΜ.
 *
 * ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΕΔΩ
 * Η ΑΑΔΕ απορρίπτει ολόκληρη την εγγραφή με σφάλμα 202 όταν το ΑΦΜ δεν είναι
 * έγκυρο — και το ERP κρατά «999999999» ή «000000000» για ιδιώτες που δεν
 * έχουν δώσει ΑΦΜ. Χωρίς έλεγχο, οι μισές συμβάσεις αποτυγχάνουν στο σύνολό
 * τους ενώ το μόνο που περισσεύει είναι ΕΝΑ προαιρετικό πεδίο.
 *
 * Ο σωστός χειρισμός δεν είναι να μη σταλεί η στάθμευση, αλλά να σταλεί
 * ΧΩΡΙΣ τη δήλωση επαναλαμβανόμενης υπηρεσίας.
 */

/** Οι τιμές που το ERP χρησιμοποιεί ως «δεν έχω ΑΦΜ». */
const PLACEHOLDERS = new Set(["999999999", "000000000", "111111111"]);

/**
 * Έγκυρο ελληνικό ΑΦΜ: εννέα ψηφία, με ψηφίο ελέγχου mod 11.
 *
 * Τα ψηφία 1–8 πολλαπλασιάζονται με 2^8…2^1, το άθροισμα mod 11 mod 10
 * πρέπει να ισούται με το ένατο ψηφίο.
 */
export function isValidGreekVat(value: string | null | undefined): boolean {
  const s = (value ?? "").replace(/\D/g, "");
  if (s.length !== 9) return false;
  if (PLACEHOLDERS.has(s)) return false;
  // Εννέα ίδια ψηφία δεν είναι ποτέ πραγματικό ΑΦΜ, ακόμα κι αν περνούν mod 11.
  if (/^(\d)\1{8}$/.test(s)) return false;

  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(s[i]) * 2 ** (8 - i);
  return (sum % 11) % 10 === Number(s[8]);
}

/** Γιατί απορρίφθηκε — για την αναφορά προς το προσωπικό. */
export function vatProblem(value: string | null | undefined): string | null {
  const s = (value ?? "").trim();
  if (!s) return "κενό";
  const digits = s.replace(/\D/g, "");
  if (PLACEHOLDERS.has(digits)) return "πλασματικό";
  if (digits.length !== 9) return `${digits.length} ψηφία`;
  if (!isValidGreekVat(digits)) return "άκυρο ψηφίο ελέγχου";
  return null;
}
