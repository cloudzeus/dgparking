/**
 * Κοινοί τύποι και βοηθοί για τη βιβλιοθήκη πολυμέσων.
 *
 * Χωρίς `sharp` και χωρίς Prisma client — τρέχει και στον browser, ώστε να το
 * χρησιμοποιούν το gallery, ο επιλογέας (picker) και οι server actions μαζί.
 */

/** Οι γλώσσες του site — εναλλακτικό κείμενο ανά γλώσσα. */
export const MEDIA_LOCALES = ["el", "en", "it"] as const;
export type MediaLocale = (typeof MEDIA_LOCALES)[number];

export const MEDIA_LOCALE_LABELS: Record<MediaLocale, string> = {
  el: "Ελληνικά",
  en: "Αγγλικά",
  it: "Ιταλικά",
};

export type MediaAlt = Record<MediaLocale, string>;

/** Το αρχείο όπως ταξιδεύει προς τον browser (σειριοποιήσιμο). */
export type MediaAssetDTO = {
  id: string;
  title: string;
  fileName: string;
  url: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  alt: MediaAlt;
  folder: string;
  createdAt: string;
};

/** Αποτέλεσμα ενέργειας διαχείρισης αρχείου. */
export type MediaActionResult =
  | { ok: true; message: string; warning?: string }
  | { ok: false; error: string };

/** Κατηγορία αρχείου — για εικονίδια, φίλτρα και μετρητές. */
export type MediaKind = "image" | "video" | "audio" | "pdf" | "archive" | "document";

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: "Εικόνα",
  video: "Βίντεο",
  audio: "Ήχος",
  pdf: "PDF",
  archive: "Συμπιεσμένο",
  document: "Έγγραφο",
};

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function mediaKind(mimeType: string): MediaKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType === "application/zip" ||
    mimeType === "application/vnd.rar" ||
    mimeType === "application/x-7z-compressed"
  ) {
    return "archive";
  }
  return "document";
}

/** Διαβάζει το `alt` (Json) της βάσης σε σταθερή μορφή ανά γλώσσα. */
export function parseMediaAlt(value: unknown): MediaAlt {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  return {
    el: typeof source.el === "string" ? source.el : "",
    en: typeof source.en === "string" ? source.en : "",
    it: typeof source.it === "string" ? source.it : "",
  };
}

/** Μέγεθος αρχείου σε ανθρώπινη μορφή, ελληνικά. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString("el-GR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${units[unit]}`;
}

/** Ημερομηνία σε ελληνική μορφή, ζώνη Αθήνας. */
export function formatMediaDate(value: string): string {
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

/**
 * Η διαδρομή του αρχείου μέσα στο storage zone, από το δημόσιο URL του CDN.
 * Χρειάζεται για τη διαγραφή από το BunnyCDN.
 */
export function storagePathFromUrl(url: string, storageZone?: string): string | null {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    // Το storage endpoint έχει το zone ως πρώτο τμήμα· το pull zone δεν το έχει.
    if (storageZone && segments[0] === storageZone) segments.shift();
    return segments.length > 0 ? segments.join("/") : null;
  } catch {
    return null;
  }
}
