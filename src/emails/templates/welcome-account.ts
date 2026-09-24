import { button, escapeHtml, renderEmail, textVersion } from "../layout";
import { bullets, greeting, greetingText, heading, note, p, RenderedEmail } from "./_shared";

export type WelcomeAccountProps = {
  /** Ο σύνδεσμος σύνδεσης, π.χ. https://megaparking.gr/el/login */
  loginUrl: string;
  name?: string;
  /** Η διεύθυνση με την οποία έγινε η εγγραφή. */
  email?: string;
};

const PORTAL_FEATURES = [
  "Τα παραστατικά και τις πληρωμές σας, όλα σε ένα σημείο",
  "Το ιστορικό εισόδων και εξόδων του οχήματός σας",
  "Τη συνδρομή σας: ανανέωση, αλλαγή πακέτου, στοιχεία τιμολόγησης",
  "Κρατήσεις για πλύσιμο αυτοκινήτου, χωρίς τηλέφωνο",
];

/** Καλωσόρισμα μετά την εγγραφή στην πύλη πελατών. */
export function welcomeAccountEmail({ loginUrl, name, email }: WelcomeAccountProps): RenderedEmail {
  const body = [
    p(greeting(name)),
    p("Ο λογαριασμός σας στο MEGA Parking είναι έτοιμος."),
    heading("Τι βρίσκετε στην πύλη πελατών"),
    bullets(PORTAL_FEATURES),
    button("Σύνδεση στον λογαριασμό μου", loginUrl),
    email ? note(`Συνδέεστε με τη διεύθυνση <strong>${escapeHtml(email)}</strong>.`) : "",
    note("Αν χρειαστείτε κάτι, απαντήστε απευθείας σε αυτό το μήνυμα ή πάρτε μας τηλέφωνο."),
  ].join("");

  return {
    subject: "Ο λογαριασμός σας είναι έτοιμος",
    html: renderEmail({
      title: "Ο λογαριασμός σας είναι έτοιμος",
      preheader: "Μπείτε στην πύλη πελατών και δείτε τα πάντα σε ένα σημείο.",
      body,
    }),
    text: textVersion([
      greetingText(name),
      "",
      "Ο λογαριασμός σας στο MEGA Parking είναι έτοιμος.",
      "",
      "Τι βρίσκετε στην πύλη πελατών:",
      ...PORTAL_FEATURES.map((feature) => `- ${feature}`),
      "",
      `Σύνδεση: ${loginUrl}`,
      ...(email ? ["", `Συνδέεστε με τη διεύθυνση ${email}.`] : []),
      "",
      "Αν χρειαστείτε κάτι, απαντήστε σε αυτό το μήνυμα ή πάρτε μας τηλέφωνο.",
    ]),
  };
}
