/**
 * Κανονικοποίηση πινακίδας — ΜΙΑ πηγή αλήθειας.
 *
 * Το SoftOne αποθηκεύει τις πινακίδες μεταγραμμένες σε λατινικά με δικό του
 * χάρτη, υλοποιημένο στο advanced JavaScript `Kolleris.SoTaskFunc`
 * (συνάρτηση `renameCarPlate`). Κάθε σημείο της εφαρμογής που συγκρίνει ή
 * καταχωρεί πινακίδα ΠΡΕΠΕΙ να χρησιμοποιεί αυτόν τον χάρτη — αλλιώς η ίδια
 * πινακίδα γράφεται με δύο τρόπους και δεν ταιριάζει ποτέ.
 *
 * Δύο αντιστοιχίσεις δεν είναι οι προφανείς και χάνονται εύκολα σε αντιγραφή:
 *   Θ → U    Ξ → J    Ψ → C    Ω → V
 * και το κρίσιμο: το ελληνικό Ρ και το λατινικό R καταλήγουν ΚΑΙ ΤΑ ΔΥΟ σε P.
 *
 * Το ERP απορρίπτει επίσης πινακίδες με κενό, τελεία ή παύλα.
 */

/** Ο χάρτης του `renameCarPlate`, στη σειρά που τον εφαρμόζει το ERP. */
const GREEK_TO_LATIN: Array<[RegExp, string]> = [
  [/Α/g, "A"], [/Β/g, "B"], [/Γ/g, "G"], [/Δ/g, "D"],
  [/Ε/g, "E"], [/Ζ/g, "Z"], [/Η/g, "H"], [/Θ/g, "U"],
  [/Ι/g, "I"], [/Κ/g, "K"], [/Λ/g, "L"], [/Μ/g, "M"],
  [/Ν/g, "N"], [/Ξ/g, "J"], [/Ο/g, "O"], [/Π/g, "P"],
  [/Ρ/g, "P"], [/Σ/g, "S"], [/Τ/g, "T"], [/Υ/g, "Y"],
  [/Φ/g, "F"], [/Χ/g, "X"], [/Ψ/g, "C"], [/Ω/g, "V"],
  // ΤΕΛΕΥΤΑΙΟ, όπως στο ERP: εφαρμόζεται και πάνω στο αποτέλεσμα των παραπάνω.
  [/R/g, "P"],
];

/**
 * Η πινακίδα όπως την κρατά το SoftOne.
 *
 * Αφαιρεί κενά, τελείες, παύλες και τόνους, κεφαλαιοποιεί και μεταγράφει.
 */
export function normalizePlate(input: string): string {
  let out = (input ?? "")
    // Τα τονισμένα κεφαλαία δεν υπάρχουν σε πινακίδες, αλλά μπαίνουν από
    // πληκτρολόγηση· χωρίς αυτό το «Ά» δεν θα γινόταν «A».
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[\s.\-_/]/g, "");

  for (const [pattern, replacement] of GREEK_TO_LATIN) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Δέχεται μόνο λατινικά και ψηφία, στο μήκος που έχουν οι ελληνικές πινακίδες. */
export function isValidPlate(input: string): boolean {
  const plate = normalizePlate(input);
  return /^[A-Z0-9]{4,12}$/.test(plate);
}

/** Άλλαξε η πινακίδα κατά τη μεταγραφή; Χρήσιμο για προεπισκόπηση στη φόρμα. */
export function wasTransliterated(input: string): boolean {
  const raw = (input ?? "").toUpperCase().replace(/[\s.\-_/]/g, "");
  return raw.length > 0 && raw !== normalizePlate(input);
}
