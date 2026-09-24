import { COMPANY } from "../brand";
import { button, dataTable, renderEmail, textVersion } from "../layout";
import {
  formatDateTime,
  GDPR_REQUEST_LABELS,
  GdprRequestType,
  greeting,
  greetingText,
  heading,
  note,
  p,
  quoteBlock,
  RenderedEmail,
} from "./_shared";

export type GdprRequestCompletedProps = {
  requestType: GdprRequestType;
  /** Κωδικός αιτήματος. */
  referenceId: string;
  /** Τι ακριβώς έγινε — το κείμενο που έγραψε ο υπεύθυνος. */
  resolution: string;
  /** Πότε ολοκληρώθηκε. */
  completedAt: Date;
  fullName?: string;
  /** Σύνδεσμος λήψης, όταν το αίτημα ήταν πρόσβαση ή φορητότητα. */
  downloadUrl?: string;
};

/** Ενημέρωση ότι το αίτημα ΓΚΠΔ διεκπεραιώθηκε. */
export function gdprRequestCompletedEmail({
  requestType,
  referenceId,
  resolution,
  completedAt,
  fullName,
  downloadUrl,
}: GdprRequestCompletedProps): RenderedEmail {
  const when = formatDateTime(completedAt);

  const rows: Array<[string, string]> = [
    ["Δικαίωμα", GDPR_REQUEST_LABELS[requestType]],
    ["Κωδικός αιτήματος", referenceId],
    ["Ολοκληρώθηκε", when],
  ];

  const body = [
    p(greeting(fullName)),
    p("Το αίτημά σας διεκπεραιώθηκε."),
    dataTable(rows),
    heading("Τι έγινε"),
    quoteBlock(resolution),
    downloadUrl
      ? [
          p("Το αρχείο με τα δεδομένα σας είναι διαθέσιμο για περιορισμένο διάστημα."),
          button("Λήψη αρχείου", downloadUrl),
        ].join("")
      : "",
    p(
      "Αν διαφωνείτε με τον χειρισμό μας, μπορείτε να υποβάλετε καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα."
    ),
    note(`Ερωτήσεις; Γράψτε μας στο ${COMPANY.email} αναφέροντας τον κωδικό ${referenceId}.`),
  ].join("");

  return {
    subject: "Το αίτημά σας ολοκληρώθηκε",
    html: renderEmail({
      title: "Το αίτημά σας ολοκληρώθηκε",
      preheader: `Κωδικός ${referenceId} — ολοκληρώθηκε στις ${when}.`,
      body,
    }),
    text: textVersion([
      greetingText(fullName),
      "",
      "Το αίτημά σας διεκπεραιώθηκε.",
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Τι έγινε:",
      resolution,
      ...(downloadUrl
        ? ["", "Το αρχείο με τα δεδομένα σας είναι διαθέσιμο για περιορισμένο διάστημα:", downloadUrl]
        : []),
      "",
      "Αν διαφωνείτε με τον χειρισμό μας, μπορείτε να υποβάλετε καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.",
      "",
      `Ερωτήσεις; Γράψτε μας στο ${COMPANY.email} αναφέροντας τον κωδικό ${referenceId}.`,
    ]),
  };
}
