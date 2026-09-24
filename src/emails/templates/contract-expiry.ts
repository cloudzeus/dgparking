import { button, dataTable, escapeHtml, renderEmail, textVersion } from "../layout";
import { heading, note, p, RenderedEmail } from "./_shared";

/**
 * Ειδοποίηση επικείμενης λήξης σύμβασης.
 *
 * Ο σκοπός δεν είναι να πληροφορήσει αλλά να αποτρέψει διακοπή: ο πελάτης
 * πρέπει να καταλάβει σε τρία δευτερόλεπτα πότε λήγει και τι να κάνει.
 */
export function contractExpiryEmail({
  customerName,
  inst,
  expiresOn,
  daysLeft,
  slots,
  plateCount,
  portalUrl,
}: {
  customerName: string;
  inst: number;
  expiresOn: Date;
  daysLeft: number;
  slots: number | null;
  plateCount: number;
  portalUrl?: string;
}): RenderedEmail {
  const when = expiresOn.toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const urgency =
    daysLeft <= 0
      ? "λήγει σήμερα"
      : daysLeft === 1
        ? "λήγει αύριο"
        : `λήγει σε ${daysLeft} ημέρες`;

  const body = [
    heading(`Η σύμβασή σας ${urgency}`),
    p(`Αγαπητοί συνεργάτες της <strong>${escapeHtml(customerName)}</strong>,`),
    p(
      `Η σύμβαση στάθμευσης <strong>${inst}</strong> ${urgency}, στις <strong>${escapeHtml(when)}</strong>. ` +
        "Μετά τη λήξη, τα οχήματά σας θα χρεώνονται με την κανονική τιμή επισκέπτη σε κάθε στάθμευση."
    ),
    dataTable([
      ["Σύμβαση", String(inst)],
      ["Ημερομηνία λήξης", when],
      ["Θέσεις", slots != null ? String(slots) : "—"],
      ["Δηλωμένες πινακίδες", String(plateCount)],
    ]),
    portalUrl ? button("Ανανέωση σύμβασης", portalUrl) : "",
    note(
      "Από το portal μπορείτε να ζητήσετε ανανέωση, να αλλάξετε τον αριθμό θέσεων και να ενημερώσετε τις πινακίδες σας."
    ),
  ].join("");

  return {
    subject: `Η σύμβαση στάθμευσης ${inst} ${urgency}`,
    html: renderEmail({
      title: "Λήξη σύμβασης",
      preheader: `${customerName} · λήξη ${when}`,
      masthead: "ΕΝΗΜΕΡΩΣΗ",
      body,
    }),
    text: textVersion([
      `Η σύμβασή σας ${urgency}`,
      "",
      `Πελάτης: ${customerName}`,
      `Σύμβαση: ${inst}`,
      `Λήξη: ${when}`,
      `Θέσεις: ${slots ?? "—"}`,
      `Δηλωμένες πινακίδες: ${plateCount}`,
      "",
      "Μετά τη λήξη τα οχήματά σας χρεώνονται με την κανονική τιμή επισκέπτη.",
      ...(portalUrl ? ["", `Ανανέωση: ${portalUrl}`] : []),
    ]),
  };
}
