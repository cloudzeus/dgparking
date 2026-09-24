import { button, dataTable, renderEmail, textVersion } from "../layout";
import {
  formatDate,
  formatDateTime,
  GDPR_REQUEST_LABELS,
  GdprRequestType,
  greeting,
  greetingText,
  heading,
  note,
  p,
  RenderedEmail,
} from "./_shared";

export type GdprRequestReceivedProps = {
  /** Το δικαίωμα που ασκείται. */
  requestType: GdprRequestType;
  /** Ο σύνδεσμος επαλήθευσης ταυτότητας. */
  verifyUrl: string;
  /** Η νόμιμη προθεσμία απάντησης (άρ. 12 §3 ΓΚΠΔ — 30 ημέρες). */
  dueDate: Date;
  /** Κωδικός αιτήματος, για να το βρίσκουμε και οι δύο. */
  referenceId: string;
  email: string;
  fullName?: string;
  submittedAt?: Date;
};

/** Βεβαίωση παραλαβής αιτήματος άσκησης δικαιωμάτων ΓΚΠΔ. */
export function gdprRequestReceivedEmail({
  requestType,
  verifyUrl,
  dueDate,
  referenceId,
  email,
  fullName,
  submittedAt = new Date(),
}: GdprRequestReceivedProps): RenderedEmail {
  const due = formatDate(dueDate);
  const when = formatDateTime(submittedAt);

  const rows: Array<[string, string]> = [
    ["Δικαίωμα", GDPR_REQUEST_LABELS[requestType]],
    ["Κωδικός αιτήματος", referenceId],
    ["Email", email],
    ["Υποβλήθηκε", when],
    ["Προθεσμία απάντησης", due],
  ];

  const body = [
    p(greeting(fullName)),
    p("Λάβαμε το αίτημά σας για άσκηση δικαιώματος προστασίας δεδομένων."),
    dataTable(rows),
    heading("Χρειάζεται ένα βήμα ακόμη"),
    p(
      "<strong>Πρέπει πρώτα να επαληθεύσουμε την ταυτότητά σας.</strong> Ο νόμος μάς υποχρεώνει να βεβαιωθούμε ότι το αίτημα το υποβάλλει το ίδιο το πρόσωπο που αφορούν τα δεδομένα. Πατήστε το κουμπί για να το ολοκληρώσετε — μέχρι τότε το αίτημα μένει σε αναμονή."
    ),
    button("Επαλήθευση ταυτότητας", verifyUrl),
    p(
      `Μόλις επαληθευτεί, απαντάμε <strong>το αργότερο μέχρι τις ${due}</strong> — εντός της προθεσμίας 30 ημερών που ορίζει ο ΓΚΠΔ (άρ. 12 §3).`
    ),
    note("Αν δεν υποβάλατε εσείς αυτό το αίτημα, αγνοήστε το μήνυμα και ενημερώστε μας."),
  ].join("");

  return {
    subject: "Λάβαμε το αίτημά σας ΓΚΠΔ",
    html: renderEmail({
      title: "Λάβαμε το αίτημά σας",
      preheader: `Επαληθεύστε την ταυτότητά σας — απαντάμε μέχρι τις ${due}.`,
      body,
    }),
    text: textVersion([
      greetingText(fullName),
      "",
      "Λάβαμε το αίτημά σας για άσκηση δικαιώματος προστασίας δεδομένων.",
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Χρειάζεται ένα βήμα ακόμη: πρέπει πρώτα να επαληθεύσουμε την ταυτότητά σας.",
      "Ο νόμος μάς υποχρεώνει να βεβαιωθούμε ότι το αίτημα το υποβάλλει το ίδιο το πρόσωπο που αφορούν τα δεδομένα.",
      "",
      `Επαλήθευση ταυτότητας: ${verifyUrl}`,
      "",
      `Μόλις επαληθευτεί, απαντάμε το αργότερο μέχρι τις ${due} — εντός της προθεσμίας 30 ημερών που ορίζει ο ΓΚΠΔ (άρ. 12 §3).`,
      "",
      "Αν δεν υποβάλατε εσείς αυτό το αίτημα, αγνοήστε το μήνυμα και ενημερώστε μας.",
    ]),
  };
}
