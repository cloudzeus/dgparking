import type {
  ConsentAction,
  ConsentType,
  DataRequestStatus,
  DataRequestType,
} from "@prisma/client";

/**
 * Ελληνικές ετικέτες για το μητρώο GDPR της διαχείρισης.
 *
 * Μία λέξη ανά κατάσταση, ίδια σε κάθε οθόνη — όπως ορίζει το MASTER.md.
 */

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  NEWSLETTER: "Ενημερωτικό δελτίο",
  COOKIES_ANALYTICS: "Cookies στατιστικών",
  COOKIES_MARKETING: "Cookies μάρκετινγκ",
  CONTACT_FORM: "Φόρμα επικοινωνίας",
  PROPOSAL_FORM: "Αίτημα προσφοράς",
  CAR_WASH_BOOKING: "Κράτηση πλυσίματος",
  TERMS: "Όροι χρήσης",
  PRIVACY_POLICY: "Πολιτική απορρήτου",
};

export const CONSENT_ACTION_LABELS: Record<ConsentAction, string> = {
  GRANTED: "Δόθηκε",
  WITHDRAWN: "Ανακλήθηκε",
};

export const DATA_REQUEST_TYPE_LABELS: Record<DataRequestType, string> = {
  ACCESS: "Πρόσβαση (άρ. 15)",
  RECTIFICATION: "Διόρθωση (άρ. 16)",
  ERASURE: "Διαγραφή (άρ. 17)",
  RESTRICTION: "Περιορισμός (άρ. 18)",
  PORTABILITY: "Φορητότητα (άρ. 20)",
  OBJECTION: "Εναντίωση (άρ. 21)",
  WITHDRAW: "Ανάκληση συγκατάθεσης (άρ. 7 §3)",
};

export const DATA_REQUEST_STATUS_LABELS: Record<DataRequestStatus, string> = {
  RECEIVED: "Παραλήφθηκε",
  VERIFYING: "Αναμονή επιβεβαίωσης",
  IN_PROGRESS: "Σε εξέλιξη",
  COMPLETED: "Ολοκληρώθηκε",
  REJECTED: "Απορρίφθηκε",
};

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export const DATA_REQUEST_STATUS_VARIANTS: Record<DataRequestStatus, BadgeVariant> = {
  RECEIVED: "neutral",
  VERIFYING: "warning",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
};

/** Ημερομηνία και ώρα Ελλάδας — η μόνη μορφή στη διαχείριση. */
export function formatAthens(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

export function formatAthensDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

/** Πόσες μέρες μένουν ως την προθεσμία· αρνητικό = έχει περάσει. */
export function daysUntil(due: Date | string | null | undefined): number | null {
  if (!due) return null;
  const diff = new Date(due).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}
