/**
 * Περίοδοι συμβάσεων στάθμευσης.
 *
 * Η ανανέωση ΔΕΝ παρατείνει την υπάρχουσα σύμβαση: δημιουργείται ΝΕΑ για τον
 * επόμενο μήνα, με αντιγραφή των πινακίδων. Αυτή είναι η πραγματική πρακτική
 * στο ERP — ο πελάτης ΑΦΟΙ ΚΟΛΛΕΡΗ έχει 302 συμβάσεις, μία ανά μήνα, με τον
 * μήνα γραμμένο στην επωνυμία.
 *
 * Το μοτίβο περιόδου επαληθεύτηκε στις ενεργές συμβάσεις: έναρξη την 1η του
 * μήνα, λήξη την 7η του επόμενου — 55 στις 57.
 */

const GREEK_MONTHS = [
  "ΙΑΝΟΥΑΡΙΟΣ",
  "ΦΕΒΡΟΥΑΡΙΟΣ",
  "ΜΑΡΤΙΟΣ",
  "ΑΠΡΙΛΙΟΣ",
  "ΜΑΙΟΣ",
  "ΙΟΥΝΙΟΣ",
  "ΙΟΥΛΙΟΣ",
  "ΑΥΓΟΥΣΤΟΣ",
  "ΣΕΠΤΕΜΒΡΙΟΣ",
  "ΟΚΤΩΒΡΙΟΣ",
  "ΝΟΕΜΒΡΙΟΣ",
  "ΔΕΚΕΜΒΡΙΟΣ",
];

export type ContractPeriod = {
  from: Date;
  to: Date;
  /** Ο μήνας που καλύπτει, για την επωνυμία της σύμβασης. */
  monthLabel: string;
  year: number;
};

/**
 * Η επόμενη περίοδος μετά από μια σύμβαση.
 *
 * Υπολογίζεται από τον ΜΗΝΑ ΕΝΑΡΞΗΣ της τρέχουσας, όχι από τη λήξη: η λήξη
 * πέφτει στον επόμενο μήνα (7η), οπότε αν βασιζόμασταν σε αυτήν θα χάναμε έναν
 * μήνα σε κάθε ανανέωση.
 */
export function nextContractPeriod(currentStart: Date | null, currentEnd: Date | null): ContractPeriod {
  // Αν λείπει η έναρξη, στηριζόμαστε στη λήξη μείον έναν μήνα.
  const base = currentStart
    ? new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth(), 1))
    : currentEnd
      ? new Date(Date.UTC(currentEnd.getUTCFullYear(), currentEnd.getUTCMonth() - 1, 1))
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const from = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 7));

  return {
    from,
    to,
    monthLabel: GREEK_MONTHS[from.getUTCMonth()],
    year: from.getUTCFullYear(),
  };
}

/** Η προτεινόμενη επωνυμία της νέας σύμβασης, στο ύφος που χρησιμοποιεί το ERP. */
export function proposedContractName(customerName: string, period: ContractPeriod): string {
  const base = customerName.replace(/\s*-\s*[Α-ΩA-Z]+\s*-?\s*\d{4}\s*$/u, "").trim();
  return `${base} -${period.monthLabel}- ${period.year}`;
}

/** Μορφοποίηση περιόδου για εμφάνιση. */
export function formatPeriod(period: ContractPeriod): string {
  const d = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
  return `${d(period.from)} — ${d(period.to)}`;
}
