import { COMPANY } from "../brand";
import { button, dataTable, renderEmail, textVersion } from "../layout";
import {
  formatDateTime,
  greeting,
  greetingText,
  heading,
  note,
  p,
  quoteBlock,
  RenderedEmail,
} from "./_shared";

export type ContactReceivedProps = {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Πότε υποβλήθηκε η φόρμα. Προεπιλογή: τώρα. */
  submittedAt?: Date;
};

/** Βεβαίωση παραλαβής για όποιον συμπλήρωσε τη φόρμα επικοινωνίας. */
export function contactReceivedEmail({
  name,
  email,
  subject,
  message,
  submittedAt = new Date(),
}: ContactReceivedProps): RenderedEmail {
  const when = formatDateTime(submittedAt);

  const rows: Array<[string, string]> = [
    ["Ονοματεπώνυμο", name],
    ["Email", email],
    ["Θέμα", subject],
    ["Ημερομηνία", when],
  ];

  const body = [
    p(greeting(name)),
    p("Λάβαμε το μήνυμά σας. Απαντάμε συνήθως εντός μίας εργάσιμης ημέρας."),
    heading("Τι μας στείλατε"),
    dataTable(rows),
    quoteBlock(message),
    p(`Αν βιάζεστε, πάρτε μας τηλέφωνο στο ${COMPANY.phone} μέσα στο ωράριο λειτουργίας.`),
    button("Τηλεφωνήστε μας", `tel:${COMPANY.phoneHref}`),
    note("Αυτό το μήνυμα είναι αυτόματη βεβαίωση παραλαβής — η απάντησή μας θα έρθει ξεχωριστά."),
  ].join("");

  return {
    subject: "Λάβαμε το μήνυμά σας",
    html: renderEmail({
      title: "Λάβαμε το μήνυμά σας",
      preheader: "Απαντάμε εντός μίας εργάσιμης ημέρας.",
      body,
    }),
    text: textVersion([
      greetingText(name),
      "",
      "Λάβαμε το μήνυμά σας. Απαντάμε συνήθως εντός μίας εργάσιμης ημέρας.",
      "",
      "Τι μας στείλατε:",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      "Μήνυμα:",
      message,
      "",
      `Αν βιάζεστε, πάρτε μας τηλέφωνο στο ${COMPANY.phone} μέσα στο ωράριο λειτουργίας.`,
      "",
      "Αυτό το μήνυμα είναι αυτόματη βεβαίωση παραλαβής — η απάντησή μας θα έρθει ξεχωριστά.",
    ]),
  };
}
