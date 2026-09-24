import { button, escapeHtml, renderEmail, textVersion } from "../layout";
import { greeting, greetingText, note, p, RenderedEmail } from "./_shared";

export type NewsletterConfirmProps = {
  /** Ο σύνδεσμος διπλής επιβεβαίωσης (double opt-in). */
  confirmUrl: string;
  /** Η διεύθυνση που δήλωσε ο χρήστης — για να δει ότι είναι η σωστή. */
  email: string;
  /** Προαιρετικό όνομα, αν το ξέρουμε από τη φόρμα. */
  name?: string;
};

/** Διπλή επιβεβαίωση εγγραφής στο ενημερωτικό δελτίο. */
export function newsletterConfirmEmail({ confirmUrl, email, name }: NewsletterConfirmProps): RenderedEmail {
  const body = [
    p(greeting(name)),
    p(
      `Λάβαμε αίτημα εγγραφής στο ενημερωτικό δελτίο του MEGA Parking για τη διεύθυνση <strong>${escapeHtml(email)}</strong>.`
    ),
    p("Πατήστε το κουμπί για να το επιβεβαιώσετε. Χρειάζεται ένα κλικ, τίποτα άλλο."),
    button("Επιβεβαίωση εγγραφής", confirmUrl),
    p(
      "<strong>Χωρίς την επιβεβαίωση δεν θα λάβετε κανένα μήνυμα από εμάς.</strong> Το αίτημα απλώς λήγει και η διεύθυνσή σας διαγράφεται."
    ),
    note("Αν δεν ζητήσατε εσείς την εγγραφή, αγνοήστε αυτό το μήνυμα."),
  ].join("");

  return {
    subject: "Επιβεβαιώστε την εγγραφή σας",
    html: renderEmail({
      title: "Επιβεβαιώστε την εγγραφή σας",
      preheader: "Ένα κλικ και μπαίνετε στη λίστα μας.",
      body,
    }),
    text: textVersion([
      greetingText(name),
      "",
      `Λάβαμε αίτημα εγγραφής στο ενημερωτικό δελτίο του MEGA Parking για τη διεύθυνση ${email}.`,
      "",
      "Επιβεβαιώστε την εγγραφή σας εδώ:",
      confirmUrl,
      "",
      "Χωρίς την επιβεβαίωση δεν θα λάβετε κανένα μήνυμα από εμάς — το αίτημα λήγει και η διεύθυνσή σας διαγράφεται.",
      "",
      "Αν δεν ζητήσατε εσείς την εγγραφή, αγνοήστε αυτό το μήνυμα.",
    ]),
  };
}
