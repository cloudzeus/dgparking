import { COMPANY } from "../brand";
import { button, renderEmail, textVersion } from "../layout";
import { bullets, greeting, greetingText, heading, note, p, RenderedEmail } from "./_shared";

export type NewsletterWelcomeProps = {
  /** Υποχρεωτικός σύνδεσμος διαγραφής — μπαίνει στο υποσέλιδο. */
  unsubscribeUrl: string;
  name?: string;
  /** Πού οδηγεί το κουμπί. Προεπιλογή: η αρχική του site. */
  ctaUrl?: string;
};

const PERKS = [
  "Αλλαγές στις τιμές και στα μηνιαία πακέτα, πριν ισχύσουν",
  "Προσφορές για πλύσιμο αυτοκινήτου και συνδυαστικά πακέτα",
  "Έκτακτες ανακοινώσεις για το ωράριο και τη λειτουργία του χώρου",
];

/** Καλωσόρισμα μετά την επιβεβαίωση της εγγραφής. */
export function newsletterWelcomeEmail({
  unsubscribeUrl,
  name,
  ctaUrl = COMPANY.site,
}: NewsletterWelcomeProps): RenderedEmail {
  const body = [
    p(greeting(name)),
    p("Η εγγραφή σας επιβεβαιώθηκε. Είστε πλέον στη λίστα μας."),
    heading("Τι θα λαμβάνετε"),
    bullets(PERKS),
    p(
      "<strong>Μία φορά τον μήνα</strong> — και μόνο όταν υπάρχει κάτι έκτακτο, όπως αλλαγή ωραρίου. Δεν στέλνουμε τίποτα άλλο και δεν δίνουμε τη διεύθυνσή σας σε κανέναν."
    ),
    button("Δείτε τις υπηρεσίες μας", ctaUrl),
    note("Μπορείτε να διαγραφείτε όποτε θέλετε, με τον σύνδεσμο στο τέλος κάθε μηνύματος."),
  ].join("");

  return {
    subject: "Καλώς ήρθατε στο MEGA Parking",
    html: renderEmail({
      title: "Καλώς ήρθατε στη λίστα μας",
      preheader: "Ένα μήνυμα τον μήνα, χωρίς θόρυβο.",
      body,
      unsubscribeUrl,
    }),
    text: textVersion([
      greetingText(name),
      "",
      "Η εγγραφή σας επιβεβαιώθηκε. Είστε πλέον στη λίστα μας.",
      "",
      "Τι θα λαμβάνετε:",
      ...PERKS.map((perk) => `- ${perk}`),
      "",
      "Μία φορά τον μήνα — και μόνο όταν υπάρχει κάτι έκτακτο, όπως αλλαγή ωραρίου.",
      "Δεν δίνουμε τη διεύθυνσή σας σε κανέναν.",
      "",
      `Δείτε τις υπηρεσίες μας: ${ctaUrl}`,
      "",
      `Διαγραφή από το ενημερωτικό δελτίο: ${unsubscribeUrl}`,
    ]),
  };
}
