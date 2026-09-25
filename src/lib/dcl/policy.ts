/**
 * ΟΙ ΔΙΚΟΙ ΜΑΣ ΚΑΝΟΝΕΣ: μια στάθμευση → το σωστό payload του Ψηφιακού
 * Πελατολογίου.
 *
 * Είναι το μόνο αρχείο του component με πραγματική επιχειρηματική λογική· τα
 * υπόλοιπα είναι XML και HTTP. Γι' αυτό ζει χωριστά και δεν ξέρει τίποτα για
 * δίκτυο ή βάση — παίρνει δεδομένα, γυρίζει δεδομένα, και ελέγχεται εύκολα.
 *
 * ΤΡΙΑ ΜΟΝΟΠΑΤΙΑ, ΕΝΑΣ ΤΥΠΟΣ ΥΠΗΡΕΣΙΑΣ
 * Είμαστε αμιγώς πάρκινγκ (`clientServiceType = 2`). Μέσα σε αυτό, οι πελάτες
 * μας χωρίζονται σε τρεις κατηγορίες που γεμίζουν ΔΙΑΦΟΡΕΤΙΚΑ πεδία:
 *
 *   Συμβασιούχοι  → Επαναλαμβανόμενη υπηρεσία, κατόπιν συμφωνίας, χωρίς
 *                   παραστατικό ανά στάθμευση (βγαίνει μηνιαίο ΤΠΥ).
 *   Απλοί         → Βάσει τιμοκαταλόγου, με ποσό και ΑΛΠ στην έξοδο.
 *   Απαλλαγμένοι  → Χωρίς παραστατικό, με αιτιολογία δωρεάν ή ιδιόχρησης.
 *
 * ΓΙΑΤΙ ΜΙΑ ΕΓΓΡΑΦΗ ΑΝΑ ΣΤΑΘΜΕΥΣΗ ΚΑΙ ΟΧΙ ΑΝΑ ΣΥΜΒΑΣΗ
 * Ο αριθμός κυκλοφορίας ζει ΜΕΣΑ στην εγγραφή. Μια σύμβαση με τρεις πινακίδες
 * ανά θέση δεν χωράει σε μία εγγραφή περιόδου. Η «Διαρκής Υπηρεσία» του
 * σχήματος είναι για συνδρομές χωρίς όχημα — όχι για πάρκινγκ.
 */

import {
  ClientServiceType,
  InvoiceKind,
  ProvidedServiceCategory,
  ReasonNonIssueType,
  type NewDigitalClient,
  type UpdateDigitalClient,
} from "./types";

/** Οι τρεις κατηγορίες πελάτη, όπως τις ξέρει η εφαρμογή. */
export type CustomerKind = "CONTRACT" | "WALK_IN" | "EXEMPT";

/**
 * Πώς χαρτογραφούνται οι κατηγορίες των απαλλαγμένων πινακίδων στην ΑΑΔΕ.
 *
 * Η ΑΑΔΕ ξεχωρίζει δύο μόνο λόγους μη χρέωσης που μας αφορούν: «δωρεάν
 * υπηρεσία» σε τρίτον, και «ιδιόχρηση» από την ίδια την επιχείρηση. Οι δικές
 * μας έξι κατηγορίες πέφτουν στα δύο αυτά καλάθια.
 */
export const EXEMPT_TO_AADE: Record<
  string,
  { category: 4 | 9; reason: 1 | 2 }
> = {
  Προσωπικό: { category: 4, reason: 1 },
  Συνεργάτες: { category: 4, reason: 1 },
  Προμηθευτές: { category: 4, reason: 1 },
  Ιδιοκτήτες: { category: 9, reason: 2 },
  "Υπηρεσιακό όχημα": { category: 9, reason: 2 },
  Άλλο: { category: 4, reason: 1 },
};

export type StayForDcl = {
  plate: string;
  entry: Date;
  exit: Date | null;
  amount: number;
  kind: CustomerKind;
  /** Μόνο για συμβασιούχους: το ΑΦΜ που απαιτεί η επαναλαμβανόμενη υπηρεσία. */
  customerVatNumber?: string | null;
  /** Μόνο για απαλλαγές: η δική μας κατηγορία, για τη χαρτογράφηση. */
  exemptCategory?: string | null;
  contractInst?: number | null;
};

/**
 * Ρολόι τοίχου → πραγματικό UTC.
 *
 * Οι ώρες μας είναι Αθήνας γραμμένες στα πεδία UTC (βλ. `parking-time`). Η
 * ΑΑΔΕ θέλει το `creationDateTime` σε αληθινό UTC όταν δηλώνουμε απώλεια
 * διασύνδεσης. Χωρίς αυτή τη μετατροπή, κάθε εγγραφή θα καταχωρούνταν δύο ή
 * τρεις ώρες μπροστά — και το λάθος θα φαινόταν μόνο σε έλεγχο.
 */
export function wallClockToUtcIso(wall: Date): string {
  // Πόσο απέχει η Αθήνα από το UTC τη ΣΥΓΚΕΚΡΙΜΕΝΗ στιγμή (θερινή/χειμερινή).
  const probe = new Date(wall.getTime());
  const athens = new Date(probe.toLocaleString("en-US", { timeZone: "Europe/Athens" }));
  const utc = new Date(probe.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = athens.getTime() - utc.getTime();
  return new Date(wall.getTime() - offsetMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Πόσο παλιά πρέπει να είναι μια είσοδος για να δηλωθεί ως εκ των υστέρων.
 *
 * Αν στείλουμε χωρίς `transmissionFailure`, η ΑΑΔΕ βάζει το «τώρα» ως ώρα
 * εισόδου. Για ό,τι συνέβη πριν από λίγα λεπτά αυτό είναι ανεκτό· για ό,τι
 * συνέβη πριν από ώρες, καταστρέφει το δεδομένο.
 */
const LATE_ENTRY_MINUTES = 3;

/** Το άνοιγμα εγγραφής για μια είσοδο. */
export function buildSendClient(
  stay: StayForDcl,
  branch: number,
  now: Date
): NewDigitalClient {
  const minutesLate = Math.round((now.getTime() - stay.entry.getTime()) / 60000);
  const late = minutesLate > LATE_ENTRY_MINUTES;

  const payload: NewDigitalClient = {
    clientServiceType: ClientServiceType.PARKING_CARWASH,
    branch,
    vehicleRegistrationNumber: stay.plate,
  };

  if (late) {
    payload.transmissionFailure = 1;
    payload.creationDateTime = wallClockToUtcIso(stay.entry);
  }

  // Επαναλαμβανόμενη υπηρεσία ΜΟΝΟ για συμβασιούχους, και μόνο εφόσον έχουμε
  // ΑΦΜ: χωρίς αυτό η ΑΑΔΕ απορρίπτει την εγγραφή (σφάλμα 203).
  if (stay.kind === "CONTRACT" && stay.customerVatNumber) {
    payload.recurringService = true;
    payload.customerVatNumber = stay.customerVatNumber;
    payload.customerCountry = "GR";
  }

  if (stay.contractInst) payload.comments = `Σύμβαση ${stay.contractInst}`;

  return payload;
}

/** Το κλείσιμο εγγραφής για μια έξοδο. */
export function buildUpdateClient(
  stay: StayForDcl,
  initialDclId: number
): UpdateDigitalClient {
  const base = {
    initialDclId,
    clientServiceType: ClientServiceType.PARKING_CARWASH,
    entryCompletion: true,
  } as const;

  if (stay.kind === "EXEMPT") {
    const map = EXEMPT_TO_AADE[stay.exemptCategory ?? "Άλλο"] ?? EXEMPT_TO_AADE["Άλλο"];
    return {
      ...base,
      nonIssueInvoice: true,
      amount: 0,
      providedServiceCategory: map.category,
      reasonNonIssueType: map.reason,
      comments: stay.exemptCategory ? `Απαλλαγή: ${stay.exemptCategory}` : undefined,
    };
  }

  if (stay.kind === "CONTRACT") {
    // Κανένα παραστατικό ανά στάθμευση: το ΤΠΥ βγαίνει μηνιαίο και συνδέεται
    // αργότερα με `ClientCorrelations`.
    return {
      ...base,
      nonIssueInvoice: true,
      amount: 0,
      providedServiceCategory: ProvidedServiceCategory.BY_AGREEMENT,
      comments: stay.contractInst ? `Σύμβαση ${stay.contractInst}` : undefined,
    };
  }

  // Απλός πελάτης: ΑΛΠ με το ποσό του τιμοκαταλόγου.
  return {
    ...base,
    amount: stay.amount,
    providedServiceCategory: ProvidedServiceCategory.PRICE_LIST,
    invoiceKind: InvoiceKind.RECEIPT,
  };
}

/** Ανθρώπινη περιγραφή, για τη σελίδα. */
export function describeKind(kind: CustomerKind): string {
  return kind === "CONTRACT"
    ? "Συμβασιούχος"
    : kind === "EXEMPT"
      ? "Απαλλαγή"
      : "Απλός πελάτης";
}

export { ProvidedServiceCategory, ReasonNonIssueType };
