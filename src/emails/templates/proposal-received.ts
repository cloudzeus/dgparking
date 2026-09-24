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

export type ProposalReceivedProps = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  /** Τύπος υπηρεσίας που ζητήθηκε, όπως τον επέλεξε στη φόρμα. */
  serviceType?: string;
  /** Πλήθος οχημάτων — δέχεται και εύρος, π.χ. «10-25». */
  vehicleCount?: string;
  /** Είδος πρόσβασης που χρειάζεται, π.χ. «24/7». */
  accessNeeded?: string;
  /** Ελεύθερο κείμενο από τη φόρμα. */
  additionalInfo?: string;
  submittedAt?: Date;
};

/** Βεβαίωση παραλαβής αιτήματος επαγγελματικής προσφοράς. */
export function proposalReceivedEmail({
  companyName,
  contactName,
  email,
  phone,
  serviceType,
  vehicleCount,
  accessNeeded,
  additionalInfo,
  submittedAt = new Date(),
}: ProposalReceivedProps): RenderedEmail {
  const when = formatDateTime(submittedAt);

  const rows: Array<[string, string]> = [
    ["Επωνυμία", companyName],
    ["Υπεύθυνος επικοινωνίας", contactName],
    ["Email", email],
    ["Τηλέφωνο", phone],
  ];
  if (serviceType) rows.push(["Υπηρεσία", serviceType]);
  if (vehicleCount) rows.push(["Οχήματα", vehicleCount]);
  if (accessNeeded) rows.push(["Πρόσβαση", accessNeeded]);
  rows.push(["Ημερομηνία", when]);

  const body = [
    p(greeting(contactName)),
    p(
      "Λάβαμε το αίτημά σας για επαγγελματική προσφορά. Θα το δει ο υπεύθυνος συνεργασιών και θα επικοινωνήσει μαζί σας εντός δύο εργάσιμων ημερών με πρόταση προσαρμοσμένη στον στόλο σας."
    ),
    heading("Τα στοιχεία που καταχωρήσαμε"),
    dataTable(rows),
    additionalInfo ? quoteBlock(additionalInfo) : "",
    p(`Αν κάτι από τα παραπάνω δεν είναι σωστό, πάρτε μας στο ${COMPANY.phone} και το διορθώνουμε.`),
    button("Τηλεφωνήστε μας", `tel:${COMPANY.phoneHref}`),
    note("Αυτό το μήνυμα είναι αυτόματη βεβαίωση παραλαβής — η προσφορά θα έρθει ξεχωριστά."),
  ].join("");

  return {
    subject: "Λάβαμε το αίτημα προσφοράς",
    html: renderEmail({
      title: "Λάβαμε το αίτημά σας",
      preheader: "Απαντάμε με προσφορά εντός δύο εργάσιμων ημερών.",
      body,
    }),
    text: textVersion([
      greetingText(contactName),
      "",
      "Λάβαμε το αίτημά σας για επαγγελματική προσφορά.",
      "Θα επικοινωνήσουμε μαζί σας εντός δύο εργάσιμων ημερών με πρόταση προσαρμοσμένη στον στόλο σας.",
      "",
      "Τα στοιχεία που καταχωρήσαμε:",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      ...(additionalInfo ? ["", "Σημειώσεις:", additionalInfo] : []),
      "",
      `Αν κάτι δεν είναι σωστό, πάρτε μας στο ${COMPANY.phone} και το διορθώνουμε.`,
      "",
      "Αυτό το μήνυμα είναι αυτόματη βεβαίωση παραλαβής — η προσφορά θα έρθει ξεχωριστά.",
    ]),
  };
}
