import type { ContentStatus } from "@prisma/client";
import type { Locale } from "@/i18n/routing";

/**
 * Κοινοί τύποι και ετικέτες του CMS (σελίδες + νέα).
 *
 * Ζουν εδώ, ξεχωριστά από τις ενέργειες διακομιστή, επειδή ένα αρχείο
 * `"use server"` επιτρέπεται να εξάγει μόνο ασύγχρονες συναρτήσεις.
 */

/** Ό,τι επιβιώνει από τη σειριοποίηση μιας ενέργειας διακομιστή (Tiptap JSON). */
export type JsonLike = Record<string, unknown> | unknown[] | string | number | boolean | null;

/** Μία μετάφραση, όπως ταξιδεύει από τον επεξεργαστή προς τον διακομιστή. */
export type TranslationInput = {
  locale: Locale;
  title: string;
  slug: string;
  excerpt: string;
  /** Η κατάσταση του επεξεργαστή (Tiptap JSON). */
  contentJson: JsonLike;
  /** Το ίδιο περιεχόμενο ως HTML — αυτό αποδίδει το δημόσιο site. */
  contentHtml: string;
  seoTitle: string;
  seoDescription: string;
  /** Μόνο για σελίδες· τα νέα κρατούν εικόνα εξωφύλλου στο άρθρο. */
  ogImageUrl: string;
  isMachineTranslated: boolean;
};

export type PageInput = {
  key: string;
  status: ContentStatus;
  showInMenu: boolean;
  menuOrder: number | null;
  translations: TranslationInput[];
};

export type PostInput = {
  status: ContentStatus;
  coverImageUrl: string | null;
  /** ISO ημερομηνία δημοσίευσης ή κενό. */
  publishedAt: string | null;
  translations: TranslationInput[];
};

export type CmsEntity = "page" | "news";

/** Τα slug όπως αποθηκεύτηκαν τελικά (μπορεί να πήραν κατάληξη -2, -3…). */
export type SavedTranslation = { locale: Locale; slug: string };

export type CmsResult =
  | { success: true; id: string; message: string; translations: SavedTranslation[] }
  | { success: false; error: string };

export type TranslatedFields = {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  seoTitle: string;
  seoDescription: string;
};

export type AutoTranslateResult =
  | { success: true; fields: TranslatedFields }
  | { success: false; error: string };

/** Μία καρτέλα γλώσσας μέσα στον επεξεργαστή. */
export type TranslationDraft = {
  locale: Locale;
  title: string;
  slug: string;
  /** Ο χρήστης άγγιξε το slug — σταματά η αυτόματη συμπλήρωση από τον τίτλο. */
  slugTouched: boolean;
  excerpt: string;
  contentJson: JsonLike;
  contentHtml: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  isMachineTranslated: boolean;
  /** Αυξάνεται όταν το περιεχόμενο αλλάζει από έξω, ώστε να ξαναστηθεί ο επεξεργαστής. */
  epoch: number;
};

export type ContentDraft = {
  id: string | null;
  status: ContentStatus;
  /** Σελίδες μόνο. */
  key: string;
  showInMenu: boolean;
  menuOrder: string;
  /** Νέα μόνο. */
  coverImageUrl: string;
  /** Νέα μόνο — τιμή για `input[type=datetime-local]`. */
  publishedAt: string;
  translations: TranslationDraft[];
};

export function emptyTranslationDraft(locale: Locale): TranslationDraft {
  return {
    locale,
    title: "",
    slug: "",
    slugTouched: false,
    excerpt: "",
    contentJson: null,
    contentHtml: "",
    seoTitle: "",
    seoDescription: "",
    ogImageUrl: "",
    isMachineTranslated: false,
    epoch: 0,
  };
}

/** Ημερομηνία σε τιμή για `input[type=datetime-local]`, σε ώρα Ελλάδας. */
export function toDateTimeLocal(date: Date | null): string {
  if (!date) return "";
  const text = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return text.replace(" ", "T");
}

export const LOCALE_LABEL: Record<Locale, string> = {
  el: "Ελληνικά",
  en: "Αγγλικά",
  it: "Ιταλικά",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  el: "EL",
  en: "EN",
  it: "IT",
};

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Πρόχειρο",
  PUBLISHED: "Δημοσιευμένο",
  ARCHIVED: "Αρχειοθετημένο",
};

export const CONTENT_STATUS_VARIANT: Record<ContentStatus, "neutral" | "success" | "warning"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};
