/**
 * Δείγματα για την προεπισκόπηση των email στο διαχειριστικό.
 *
 * Οι ημερομηνίες είναι σταθερές επίτηδες: η προεπισκόπηση πρέπει να βγάζει
 * το ίδιο αποτέλεσμα κάθε φορά, ώστε να φαίνεται αμέσως αν κάτι άλλαξε.
 */

import type { RenderedEmail } from "./templates/_shared";

import { contactReceivedEmail, type ContactReceivedProps } from "./templates/contact-received";
import {
  gdprRequestCompletedEmail,
  type GdprRequestCompletedProps,
} from "./templates/gdpr-request-completed";
import {
  gdprRequestReceivedEmail,
  type GdprRequestReceivedProps,
} from "./templates/gdpr-request-received";
import { newsletterConfirmEmail, type NewsletterConfirmProps } from "./templates/newsletter-confirm";
import { newsletterWelcomeEmail, type NewsletterWelcomeProps } from "./templates/newsletter-welcome";
import { passwordChangedEmail, type PasswordChangedProps } from "./templates/password-changed";
import { passwordResetEmail, type PasswordResetProps } from "./templates/password-reset";
import { proposalReceivedEmail, type ProposalReceivedProps } from "./templates/proposal-received";
import { welcomeAccountEmail, type WelcomeAccountProps } from "./templates/welcome-account";

const SITE = "https://megaparking.gr";

/** Σταθερό «τώρα» για τα δείγματα: 12 Μαρτίου 2026, 14:30 ώρα Ελλάδας. */
const SAMPLE_NOW = new Date("2026-03-12T12:30:00.000Z");

function plusHours(hours: number): Date {
  return new Date(SAMPLE_NOW.getTime() + hours * 60 * 60 * 1000);
}

function plusDays(days: number): Date {
  return plusHours(days * 24);
}

export const SAMPLE_PROPS = {
  "newsletter-confirm": {
    confirmUrl: `${SITE}/el/newsletter/confirm?token=dei-gma-token`,
    email: "maria.papadopoulou@example.com",
    name: "Μαρία",
  } satisfies NewsletterConfirmProps,

  "newsletter-welcome": {
    unsubscribeUrl: `${SITE}/el/newsletter/unsubscribe?token=dei-gma-token`,
    name: "Μαρία",
    ctaUrl: `${SITE}/el`,
  } satisfies NewsletterWelcomeProps,

  "password-reset": {
    resetUrl: `${SITE}/el/reset-password?token=dei-gma-token`,
    expiresAt: plusHours(1),
    name: "Γιώργος",
  } satisfies PasswordResetProps,

  "password-changed": {
    changedAt: SAMPLE_NOW,
    name: "Γιώργος",
    contactUrl: `${SITE}/el/contact`,
    ipAddress: "85.72.14.203",
  } satisfies PasswordChangedProps,

  "welcome-account": {
    loginUrl: `${SITE}/el/login`,
    name: "Γιώργος",
    email: "giorgos.nikolaou@example.com",
  } satisfies WelcomeAccountProps,

  "contact-received": {
    name: "Ελένη Δημητρίου",
    email: "eleni.dimitriou@example.com",
    subject: "Διαθεσιμότητα μηνιαίας θέσης",
    message:
      "Καλησπέρα σας,\n\nΕργάζομαι κοντά στο λιμάνι και ψάχνω μηνιαία θέση για ένα SUV.\nΥπάρχει διαθεσιμότητα από την 1η Απριλίου;\n\nΕυχαριστώ πολύ.",
    submittedAt: SAMPLE_NOW,
  } satisfies ContactReceivedProps,

  "proposal-received": {
    companyName: "Αιγαίον Μεταφορική Α.Ε.",
    contactName: "Νίκος Αντωνίου",
    email: "n.antoniou@aigaion.example.com",
    phone: "210 45 12 300",
    serviceType: "Μηνιαία στάθμευση εταιρικού στόλου",
    vehicleCount: "10–25",
    accessNeeded: "24/7",
    additionalInfo:
      "Τα οχήματα μπαινοβγαίνουν και τα Σαββατοκύριακα. Θα θέλαμε και τιμολόγηση ανά μήνα με ένα παραστατικό.",
    submittedAt: SAMPLE_NOW,
  } satisfies ProposalReceivedProps,


  "gdpr-request-received": {
    requestType: "ACCESS",
    verifyUrl: `${SITE}/el/gdpr/verify?token=dei-gma-token`,
    dueDate: plusDays(30),
    referenceId: "DSR-2026-0042",
    email: "eleni.dimitriou@example.com",
    fullName: "Ελένη Δημητρίου",
    submittedAt: SAMPLE_NOW,
  } satisfies GdprRequestReceivedProps,

  "gdpr-request-completed": {
    requestType: "ACCESS",
    referenceId: "DSR-2026-0042",
    resolution:
      "Ετοιμάσαμε αντίγραφο όλων των δεδομένων που τηρούμε για εσάς: στοιχεία λογαριασμού, ιστορικό στάθμευσης από 01/2025, παραστατικά και αρχείο συγκαταθέσεων. Τα δεδομένα των καμερών διατηρούνται μόνο 15 ημέρες, οπότε δεν υπάρχει παλαιότερο υλικό.",
    completedAt: plusDays(6),
    fullName: "Ελένη Δημητρίου",
    downloadUrl: `${SITE}/el/gdpr/download?token=dei-gma-token`,
  } satisfies GdprRequestCompletedProps,
} as const;

export type EmailTemplateId = keyof typeof SAMPLE_PROPS;

export type EmailPreview = {
  id: EmailTemplateId;
  /** Πώς εμφανίζεται στη λίστα του διαχειριστικού. */
  label: string;
  /** Πότε στέλνεται. */
  when: string;
  render: () => RenderedEmail;
};

export const EMAIL_PREVIEWS: readonly EmailPreview[] = [
  {
    id: "newsletter-confirm",
    label: "Επιβεβαίωση εγγραφής",
    when: "Μόλις κάποιος δηλώσει email στο ενημερωτικό δελτίο.",
    render: () => newsletterConfirmEmail(SAMPLE_PROPS["newsletter-confirm"]),
  },
  {
    id: "newsletter-welcome",
    label: "Καλωσόρισμα ενημερωτικού δελτίου",
    when: "Μόλις πατηθεί ο σύνδεσμος επιβεβαίωσης.",
    render: () => newsletterWelcomeEmail(SAMPLE_PROPS["newsletter-welcome"]),
  },
  {
    id: "password-reset",
    label: "Επαναφορά κωδικού",
    when: "Όταν ζητηθεί νέος κωδικός από τη σελίδα σύνδεσης.",
    render: () => passwordResetEmail(SAMPLE_PROPS["password-reset"]),
  },
  {
    id: "password-changed",
    label: "Ο κωδικός άλλαξε",
    when: "Αμέσως μετά από κάθε αλλαγή κωδικού.",
    render: () => passwordChangedEmail(SAMPLE_PROPS["password-changed"]),
  },
  {
    id: "welcome-account",
    label: "Καλωσόρισμα λογαριασμού",
    when: "Μετά την εγγραφή στην πύλη πελατών.",
    render: () => welcomeAccountEmail(SAMPLE_PROPS["welcome-account"]),
  },
  {
    id: "contact-received",
    label: "Λάβαμε το μήνυμά σας",
    when: "Στον αποστολέα της φόρμας επικοινωνίας.",
    render: () => contactReceivedEmail(SAMPLE_PROPS["contact-received"]),
  },
  {
    id: "proposal-received",
    label: "Λάβαμε το αίτημα προσφοράς",
    when: "Στον αιτούντα επαγγελματικής προσφοράς.",
    render: () => proposalReceivedEmail(SAMPLE_PROPS["proposal-received"]),
  },
  {
    id: "gdpr-request-received",
    label: "Λάβαμε αίτημα ΓΚΠΔ",
    when: "Μόλις υποβληθεί αίτημα άσκησης δικαιωμάτων.",
    render: () => gdprRequestReceivedEmail(SAMPLE_PROPS["gdpr-request-received"]),
  },
  {
    id: "gdpr-request-completed",
    label: "Αίτημα ΓΚΠΔ ολοκληρώθηκε",
    when: "Όταν ο υπεύθυνος κλείσει το αίτημα.",
    render: () => gdprRequestCompletedEmail(SAMPLE_PROPS["gdpr-request-completed"]),
  },
];

/** Ένα δείγμα με το id του — για τη σελίδα προεπισκόπησης. */
export function getEmailPreview(id: string): EmailPreview | undefined {
  return EMAIL_PREVIEWS.find((preview) => preview.id === id);
}

/** Έτοιμο `{ subject, html, text }` για το id. */
export function renderEmailPreview(id: string): RenderedEmail | undefined {
  return getEmailPreview(id)?.render();
}
