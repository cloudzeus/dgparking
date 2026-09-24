import { COMPANY } from "../brand";
import { button, renderEmail, textVersion } from "../layout";
import { dataTable } from "../layout";
import { formatDateTime, greeting, greetingText, note, p, RenderedEmail } from "./_shared";

export type PasswordChangedProps = {
  /** Πότε άλλαξε ο κωδικός. Εμφανίζεται σε ώρα Ελλάδας. */
  changedAt: Date;
  name?: string;
  /** Πού στέλνουμε όποιον δεν αναγνωρίζει την αλλαγή. */
  contactUrl: string;
  /** Προαιρετικά, η IP από την οποία έγινε η αλλαγή. */
  ipAddress?: string;
};

/** Ειδοποίηση ότι ο κωδικός άλλαξε. */
export function passwordChangedEmail({
  changedAt,
  name,
  contactUrl,
  ipAddress,
}: PasswordChangedProps): RenderedEmail {
  const when = formatDateTime(changedAt);

  const rows: Array<[string, string]> = [["Ημερομηνία & ώρα", when]];
  if (ipAddress) rows.push(["Διεύθυνση IP", ipAddress]);

  const body = [
    p(greeting(name)),
    p("Ο κωδικός πρόσβασης του λογαριασμού σας άλλαξε."),
    dataTable(rows),
    p(
      `<strong>Αν δεν την κάνατε εσείς, επικοινωνήστε αμέσως μαζί μας</strong> — στο ${COMPANY.phone} ή μέσω της φόρμας. Θα κλειδώσουμε τον λογαριασμό μέχρι να το ξεκαθαρίσουμε.`
    ),
    button("Επικοινωνήστε μαζί μας", contactUrl),
    note("Αν την αλλαγή την κάνατε εσείς, δεν χρειάζεται να κάνετε τίποτα."),
  ].join("");

  return {
    subject: "Ο κωδικός σας άλλαξε",
    html: renderEmail({
      title: "Ο κωδικός σας άλλαξε",
      preheader: `Η αλλαγή έγινε στις ${when}.`,
      body,
    }),
    text: textVersion([
      greetingText(name),
      "",
      "Ο κωδικός πρόσβασης του λογαριασμού σας άλλαξε.",
      "",
      `Ημερομηνία & ώρα: ${when}`,
      ...(ipAddress ? [`Διεύθυνση IP: ${ipAddress}`] : []),
      "",
      `Αν δεν την κάνατε εσείς, επικοινωνήστε αμέσως μαζί μας στο ${COMPANY.phone} ή εδώ: ${contactUrl}`,
      "Θα κλειδώσουμε τον λογαριασμό μέχρι να το ξεκαθαρίσουμε.",
      "",
      "Αν την αλλαγή την κάνατε εσείς, δεν χρειάζεται να κάνετε τίποτα.",
    ]),
  };
}
