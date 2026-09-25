/**
 * Οι τύποι του Ψηφιακού Πελατολογίου ΑΑΔΕ.
 *
 * Πηγή: «Ψηφιακό Πελατολόγιο ΑΑΔΕ — Τεχνική περιγραφή διεπαφών REST API»,
 * έκδοση 1.0, Απρίλιος 2025.
 *
 * Οι αριθμοί ΔΕΝ είναι δικοί μας· είναι οι κωδικοί της ΑΑΔΕ. Γράφονται ως
 * enum με το επίσημο κείμενο δίπλα, ώστε κανείς να μη χρειαστεί να ανοίξει
 * ξανά το PDF για να θυμηθεί τι σημαίνει το «8».
 */

/** Τύπος Πελατολογίου. Είμαστε αμιγώς πάρκινγκ → πάντα 2. */
export const ClientServiceType = {
  RENTAL: 1, // Ενοικίαση
  PARKING_CARWASH: 2, // Πάρκινγκ / Πλυντήρια  ← εμείς
  GARAGE: 3, // Συνεργεία
} as const;

/**
 * Κατηγορία Παρεχόμενων Υπηρεσιών — ΥΠΟΧΡΕΩΤΙΚΟ για πάρκινγκ.
 *
 * Από τις εννέα τιμές, τέσσερις αφορούν συνεργεία. Για εμάς ισχύουν μόνο
 * αυτές που σημειώνονται.
 */
export const ProvidedServiceCategory = {
  WORK_WITH_PARTS: 1, // Συνεργεία
  WORK_WITH_CUSTOMER_PARTS: 2, // Συνεργεία
  WORK_NO_PARTS: 3, // Συνεργεία
  FREE: 4, // Δωρεάν υπηρεσία            ← απαλλαγές προσωπικού
  OTHER: 5, // Λοιπά                      ← θέλει providedServiceCategoryOther
  WARRANTY_COMPENSATION: 6, // Συνεργεία
  PRICE_LIST: 7, // Βάσει Τιμοκαταλόγου    ← απλοί πελάτες
  BY_AGREEMENT: 8, // Κατόπιν Συμφωνίας    ← συμβασιούχοι
  OWN_USE: 9, // Ιδιόχρηση                 ← οχήματα της εταιρίας
} as const;

/** Είδος Παραστατικού. */
export const InvoiceKind = {
  RECEIPT: 1, // ΑΛΠ / ΑΠΥ
  INVOICE: 2, // ΤΙΜΟΛΟΓΙΟ
  RECEIPT_FIM: 3, // ΑΛΠ / ΑΠΥ μέσω ΦΗΜ
} as const;

/** Αιτιολογία Μη έκδοσης Παραστατικού. */
export const ReasonNonIssueType = {
  FREE_SERVICE: 1, // Δωρεάν Υπηρεσία
  OWN_USE: 2, // Ιδιόχρηση
  WARRANTY: 3, // Αποζημίωση Παροχής Εγγύησης (συνεργεία)
} as const;

export type ClientServiceTypeValue =
  (typeof ClientServiceType)[keyof typeof ClientServiceType];
export type ProvidedServiceCategoryValue =
  (typeof ProvidedServiceCategory)[keyof typeof ProvidedServiceCategory];
export type InvoiceKindValue = (typeof InvoiceKind)[keyof typeof InvoiceKind];
export type ReasonNonIssueTypeValue =
  (typeof ReasonNonIssueType)[keyof typeof ReasonNonIssueType];

/** Το άνοιγμα εγγραφής — `SendClient`. */
export type NewDigitalClient = {
  clientServiceType: ClientServiceTypeValue;
  branch: number;
  /**
   * Συμπληρώνεται από την ΑΑΔΕ, ΕΚΤΟΣ αν `transmissionFailure = 1`.
   * Τότε το στέλνουμε εμείς, σε **UTC** (`yyyy-MM-ddTHH:mm:ssZ`).
   */
  creationDateTime?: string;
  /** 1 = απώλεια διασύνδεσης. Η μόνη επιτρεπτή τιμή. */
  transmissionFailure?: 1;
  /** Επαναλαμβανόμενη Υπηρεσία — οι συμβασιούχοι μας. */
  recurringService?: boolean;
  /** ΑΦΜ πελάτη· απαιτείται όταν `recurringService = true`. */
  customerVatNumber?: string;
  customerCountry?: string;
  comments?: string;
  /** Περίπτωση χρήσης. Για εμάς πάντα `parkingcarwash`. */
  vehicleRegistrationNumber: string;
};

/** Το κλείσιμο εγγραφής — `UpdateClient`. */
export type UpdateDigitalClient = {
  initialDclId: number;
  clientServiceType: ClientServiceTypeValue;
  /** Ολοκλήρωση εγγραφής. */
  entryCompletion?: boolean;
  /** Μη έκδοση παραστατικού — απαλλαγές και συμβασιούχοι. */
  nonIssueInvoice?: boolean;
  amount?: number;
  providedServiceCategory: ProvidedServiceCategoryValue;
  providedServiceCategoryOther?: string;
  invoiceKind?: InvoiceKindValue;
  reasonNonIssueType?: ReasonNonIssueTypeValue;
  comments?: string;
};
