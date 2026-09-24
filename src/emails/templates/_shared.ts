import { BRAND, FONT_STACK } from "../brand";
import { escapeHtml } from "../layout";

/**
 * Μικρά κοινά κομμάτια για τα πρότυπα. Καμία πρόσβαση σε βάση, δίκτυο ή
 * μεταβλητές περιβάλλοντος — μόνο καθαρές συναρτήσεις πάνω στο κέλυφος
 * του `layout.ts`.
 */

/** Ό,τι επιστρέφει κάθε πρότυπο. */
export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/** Παράγραφος σώματος. Το `html` περνά όπως είναι — φρόντισε να το έχεις καθαρίσει. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:16px;line-height:24px;color:${BRAND.ink};">${html}</p>`;
}

/** Παράγραφος από απλό κείμενο χρήστη. */
export function pText(text: string): string {
  return p(escapeHtml(text));
}

/** Μικρό, δευτερεύον κείμενο — σημειώσεις, νομικά, «αν δεν το ζητήσατε εσείς». */
export function note(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:13px;line-height:20px;color:${BRAND.steel};">${html}</p>`;
}

/** Μικρός τίτλος ενότητας μέσα στο σώμα. */
export function heading(text: string): string {
  return `<p style="margin:24px 0 8px;font-family:${FONT_STACK};font-size:16px;line-height:22px;font-weight:bold;color:${BRAND.navy};">${escapeHtml(text)}</p>`;
}

/** Λίστα με κουκκίδες — πίνακας, ώστε να μη «σπάει» σε Outlook. */
export function bullets(items: string[]): string {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td valign="top" style="padding:0 8px 8px 0;font-family:${FONT_STACK};font-size:16px;line-height:24px;color:${BRAND.red};">&bull;</td>
      <td valign="top" style="padding:0 0 8px;font-family:${FONT_STACK};font-size:16px;line-height:24px;color:${BRAND.ink};">${escapeHtml(item)}</td>
    </tr>`
    )
    .join("");

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
    ${rows}
  </table>`;
}

/** Το μήνυμα του χρήστη αυτούσιο, σε πλαίσιο — διατηρεί τις αλλαγές γραμμής. */
export function quoteBlock(text: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
    <tr>
      <td style="padding:16px;background-color:${BRAND.cloud};border-left:4px solid ${BRAND.navy};font-family:${FONT_STACK};font-size:15px;line-height:23px;color:${BRAND.ink};">
        ${escapeHtml(text).replace(/\r?\n/g, "<br />")}
      </td>
    </tr>
  </table>`;
}

const EL = "el-GR";
const TZ = "Europe/Athens";

/**
 * Ημερομηνία και ώρα Ελλάδας, π.χ. «12 Μαρτίου 2026 στις 14:30».
 * Ρητά 24ωρο: το `dateStyle/timeStyle` βγάζει «2:30 μ.μ.», που δεν γράφουμε.
 */
export function formatDateTime(value: Date): string {
  return value.toLocaleString(EL, {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Μόνο ημερομηνία, π.χ. «12 Μαρτίου 2026». */
export function formatDate(value: Date): string {
  return value.toLocaleDateString(EL, { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
}

/** Μόνο ώρα, π.χ. «14:30». */
export function formatTime(value: Date): string {
  // hour12:false — ελληνικό ωράριο 24ώρου, όχι «02:30 μ.μ.».
  return value.toLocaleTimeString(EL, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Ποσό σε ευρώ, π.χ. «25,00 €». */
export function formatEuro(amount: number): string {
  return amount.toLocaleString(EL, { style: "currency", currency: "EUR" });
}

/**
 * Τα δικαιώματα του ΓΚΠΔ όπως τα ονομάζει ο νόμος. Τα κλειδιά ταιριάζουν με
 * το `DataRequestType` του Prisma, αλλά δεν το εισάγουμε: τα πρότυπα μένουν
 * καθαρά, χωρίς εξάρτηση από τον client της βάσης.
 */
export type GdprRequestType =
  | "ACCESS"
  | "RECTIFICATION"
  | "ERASURE"
  | "RESTRICTION"
  | "PORTABILITY"
  | "OBJECTION"
  | "WITHDRAW";

export const GDPR_REQUEST_LABELS: Record<GdprRequestType, string> = {
  ACCESS: "Πρόσβαση στα δεδομένα σας (άρ. 15)",
  RECTIFICATION: "Διόρθωση των δεδομένων σας (άρ. 16)",
  ERASURE: "Διαγραφή των δεδομένων σας (άρ. 17)",
  RESTRICTION: "Περιορισμός της επεξεργασίας (άρ. 18)",
  PORTABILITY: "Φορητότητα των δεδομένων σας (άρ. 20)",
  OBJECTION: "Εναντίωση στην επεξεργασία (άρ. 21)",
  WITHDRAW: "Ανάκληση της συγκατάθεσής σας (άρ. 7 §3)",
};

/** «Γεια σας, Μαρία,» ή σκέτο «Γεια σας,» όταν δεν ξέρουμε το όνομα. */
export function greeting(name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? `Γεια σας ${escapeHtml(trimmed)},` : "Γεια σας,";
}

/** Το ίδιο, για την έκδοση κειμένου. */
export function greetingText(name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? `Γεια σας ${trimmed},` : "Γεια σας,";
}
