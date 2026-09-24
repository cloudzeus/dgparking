/**
 * Οι επιλογές cookie του επισκέπτη, όπως ζουν στον browser του.
 *
 * Στη συσκευή του κρατάμε μόνο ό,τι χρειάζεται η διεπαφή (να μη δείχνουμε
 * ξανά το banner, να ξέρουμε ποια scripts επιτρέπονται). Η ΝΟΜΙΚΗ απόδειξη
 * είναι η εγγραφή `ConsentLog` στη βάση — όχι το localStorage, που ο
 * επισκέπτης μπορεί να σβήσει ανά πάσα στιγμή.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "cookie-consent";

/** Το γεγονός με το οποίο ξανανοίγει το banner από άλλη σελίδα/υποσέλιδο. */
export const COOKIE_CONSENT_OPEN_EVENT = "mega:cookie-preferences:open";

/** Οι κατηγορίες για τις οποίες αποφασίζει ο επισκέπτης. Τα απαραίτητα δεν ρωτιούνται. */
export type CookieCategory = "analytics" | "marketing";

export type CookiePreferences = {
  analytics: boolean;
  marketing: boolean;
  /**
   * Πότε δόθηκε η επιλογή — ISO. Μόνο για τη διεπαφή· η έκδοση πολιτικής και
   * η ώρα που μετράνε νομικά γράφονται στο `ConsentLog`.
   */
  decidedAt: string;
};

export const DENY_ALL: Pick<CookiePreferences, CookieCategory> = {
  analytics: false,
  marketing: false,
};

export const ALLOW_ALL: Pick<CookiePreferences, CookieCategory> = {
  analytics: true,
  marketing: true,
};

function isPreferences(value: unknown): value is CookiePreferences {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.analytics === "boolean" && typeof candidate.marketing === "boolean";
}

/** Οι αποθηκευμένες επιλογές, ή `null` όταν ο επισκέπτης δεν έχει αποφασίσει ακόμη. */
export function readCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPreferences(parsed) ? parsed : null;
  } catch {
    // Ιδιωτική περιήγηση, αποκλεισμένη αποθήκευση ή παλιά μορφή («true»).
    return null;
  }
}

export function writeCookiePreferences(preferences: CookiePreferences): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Αν δεν μπορεί να αποθηκευτεί, η επιλογή ισχύει μόνο για αυτή την επίσκεψη.
  }
}

/** Ξανανοίγει το banner ρυθμίσεων — από το υποσέλιδο ή τη σελίδα cookies. */
export function openCookiePreferences(): void {
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_OPEN_EVENT));
}
