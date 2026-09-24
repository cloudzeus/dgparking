import { button, dataTable, escapeHtml, renderEmail, textVersion } from "../layout";
import { heading, note, p, RenderedEmail } from "./_shared";

/**
 * Απόφαση πρόσβασης στο portal πελατών.
 *
 * Δύο πολύ διαφορετικά μηνύματα από το ίδιο πρότυπο: η έγκριση καλεί σε δράση
 * (σύνδεση), η απόρριψη πρέπει να αφήνει ανοιχτό δρόμο επικοινωνίας — σπάνια
 * φταίει ο πελάτης, συνήθως λείπει κάτι από την καρτέλα του ERP.
 */
export function portalAccessDecisionEmail({
  approved,
  firstName,
  customerName,
  reason,
  loginUrl,
}: {
  approved: boolean;
  firstName?: string;
  customerName?: string;
  reason?: string;
  loginUrl?: string;
}): RenderedEmail {
  const url = loginUrl ?? `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/login`;
  const hello = firstName ? `Γεια σας ${escapeHtml(firstName)},` : "Γεια σας,";

  if (approved) {
    const body = [
      heading("Ο λογαριασμός σας ενεργοποιήθηκε"),
      p(hello),
      p(
        customerName
          ? `Η πρόσβασή σας στο portal εγκρίθηκε για τον λογαριασμό <strong>${escapeHtml(customerName)}</strong>.`
          : "Η πρόσβασή σας στο portal εγκρίθηκε."
      ),
      p(
        "Μπορείτε πλέον να δείτε τη σύμβασή σας, να διαχειριστείτε τις πινακίδες των οχημάτων σας και να κατεβάσετε τα τιμολόγιά σας."
      ),
      url ? button("Σύνδεση στο portal", url) : "",
    ].join("");

    return {
      subject: "Η πρόσβασή σας στο MEGA Parking ενεργοποιήθηκε",
      html: renderEmail({
        title: "Καλώς ήρθατε",
        preheader: "Ο λογαριασμός σας είναι έτοιμος.",
        masthead: "PORTAL ΠΕΛΑΤΩΝ",
        body,
      }),
      text: textVersion([
        "Ο λογαριασμός σας ενεργοποιήθηκε",
        "",
        customerName ? `Λογαριασμός: ${customerName}` : "",
        "Μπορείτε να δείτε τη σύμβασή σας, τις πινακίδες και τα τιμολόγιά σας.",
        ...(url ? ["", `Σύνδεση: ${url}`] : []),
      ]),
    };
  }

  const body = [
    heading("Σχετικά με την αίτησή σας"),
    p(hello),
    p("Δεν καταφέραμε να επιβεβαιώσουμε τη σύνδεσή σας με λογαριασμό πελάτη."),
    reason ? dataTable([["Αιτιολογία", reason]]) : "",
    note(
      "Αυτό συνήθως σημαίνει ότι λείπει κάποιο στοιχείο από την καρτέλα σας — όχι ότι υπάρχει πρόβλημα με τα στοιχεία που δώσατε. Επικοινωνήστε μαζί μας και θα το τακτοποιήσουμε."
    ),
  ].join("");

  return {
    subject: "Σχετικά με την αίτηση πρόσβασης στο MEGA Parking",
    html: renderEmail({
      title: "Αίτηση πρόσβασης",
      preheader: "Χρειαζόμαστε κάποια επιπλέον στοιχεία.",
      masthead: "PORTAL ΠΕΛΑΤΩΝ",
      body,
    }),
    text: textVersion([
      "Σχετικά με την αίτησή σας",
      "",
      "Δεν καταφέραμε να επιβεβαιώσουμε τη σύνδεσή σας με λογαριασμό πελάτη.",
      ...(reason ? ["", `Αιτιολογία: ${reason}`] : []),
      "",
      "Επικοινωνήστε μαζί μας και θα το τακτοποιήσουμε.",
    ]),
  };
}
