import { button, renderEmail, textVersion } from "../layout";
import { formatDateTime, greeting, greetingText, note, p, RenderedEmail } from "./_shared";

export type PasswordResetProps = {
  /** Ο μοναδικός σύνδεσμος επαναφοράς. */
  resetUrl: string;
  /** Πότε παύει να ισχύει ο σύνδεσμος. */
  expiresAt: Date;
  name?: string;
};

/** Επαναφορά κωδικού πρόσβασης. */
export function passwordResetEmail({ resetUrl, expiresAt, name }: PasswordResetProps): RenderedEmail {
  const expiry = formatDateTime(expiresAt);

  const body = [
    p(greeting(name)),
    p("Ζητήθηκε νέος κωδικός πρόσβασης για τον λογαριασμό σας στο MEGA Parking."),
    button("Ορισμός νέου κωδικού", resetUrl),
    p(`Ο σύνδεσμος ισχύει μέχρι τις <strong>${expiry}</strong>. Μετά από αυτό θα χρειαστεί να ζητήσετε νέον.`),
    note(
      "Αν δεν το ζητήσατε εσείς, αγνοήστε το. Ο κωδικός σας παραμένει ο ίδιος και κανείς δεν μπορεί να τον αλλάξει χωρίς αυτόν τον σύνδεσμο."
    ),
  ].join("");

  return {
    subject: "Επαναφορά κωδικού πρόσβασης",
    html: renderEmail({
      title: "Επαναφορά κωδικού πρόσβασης",
      preheader: `Ο σύνδεσμος ισχύει μέχρι τις ${expiry}.`,
      body,
    }),
    text: textVersion([
      greetingText(name),
      "",
      "Ζητήθηκε νέος κωδικός πρόσβασης για τον λογαριασμό σας στο MEGA Parking.",
      "",
      "Ορίστε νέο κωδικό εδώ:",
      resetUrl,
      "",
      `Ο σύνδεσμος ισχύει μέχρι τις ${expiry}. Μετά θα χρειαστεί να ζητήσετε νέον.`,
      "",
      "Αν δεν το ζητήσατε εσείς, αγνοήστε το. Ο κωδικός σας παραμένει ο ίδιος.",
    ]),
  };
}
