/**
 * Κοινά βοηθήματα ενημερωτικού δελτίου — τα χρησιμοποιούν και οι server
 * actions της διαχείρισης και τα route handlers του δημόσιου site.
 *
 * Χωρίς εξαρτήσεις Node: το ίδιο αρχείο φορτώνεται και από τη φόρμα εγγραφής
 * του site (client component), οπότε η τυχαιότητα έρχεται από το Web Crypto.
 */

/** Η δημόσια διεύθυνση της εφαρμογής, για συνδέσμους μέσα σε email. */
export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "https://megaparking.gr";
  return raw.replace(/\/+$/, "");
}

/** Τυχαίο κλειδί επιβεβαίωσης/διαγραφής — χωρίς σύνδεση χρήστη. */
export function newSubscriberToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function unsubscribeUrl(token: string): string {
  return `${appBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function confirmUrl(token: string): string {
  return `${appBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

/**
 * Το ακριβές κείμενο δίπλα στο checkbox της εγγραφής.
 * Καταγράφεται αυτούσιο στο αρχείο συγκαταθέσεων (GDPR άρ. 7 §1).
 */
export const NEWSLETTER_CONSENT_TEXT =
  "Θέλω να λαμβάνω το ενημερωτικό δελτίο της MEGA Parking με νέα, προσφορές και ανακοινώσεις. " +
  "Μπορώ να διαγραφώ οποτεδήποτε από τον σύνδεσμο σε κάθε μήνυμα.";

/** Ελληνική ετικέτα κατάστασης συνδρομητή. */
export const SUBSCRIBER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Εκκρεμεί επιβεβαίωση",
  SUBSCRIBED: "Εγγεγραμμένος",
  UNSUBSCRIBED: "Διαγράφηκε",
  BOUNCED: "Μη παραδοτέο",
  COMPLAINED: "Καταγγελία",
};

export const SUBSCRIBER_STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  PENDING: "warning",
  SUBSCRIBED: "success",
  UNSUBSCRIBED: "neutral",
  BOUNCED: "danger",
  COMPLAINED: "danger",
};

/** Ελληνική ετικέτα κατάστασης εκστρατείας. */
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Πρόχειρη",
  SENDING: "Αποστέλλεται",
  SENT: "Στάλθηκε",
  FAILED: "Απέτυχε",
};

export const CAMPAIGN_STATUS_VARIANT: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  DRAFT: "neutral",
  SENDING: "info",
  SENT: "success",
  FAILED: "danger",
};

/** Το περιεχόμενο που κρατάμε στο `contentJson` της εκστρατείας. */
export type CampaignContent = {
  html: string;
  ctaLabel?: string;
  ctaUrl?: string;
  heroImageUrl?: string;
};

/** Ασφαλής ανάγνωση του `contentJson` (είναι `Json`, μπορεί να είναι οτιδήποτε). */
export function readCampaignContent(value: unknown): CampaignContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { html: "" };
  const record = value as Record<string, unknown>;
  return {
    html: typeof record.html === "string" ? record.html : "",
    ctaLabel: typeof record.ctaLabel === "string" ? record.ctaLabel : undefined,
    ctaUrl: typeof record.ctaUrl === "string" ? record.ctaUrl : undefined,
    heroImageUrl: typeof record.heroImageUrl === "string" ? record.heroImageUrl : undefined,
  };
}
