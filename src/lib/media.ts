/**
 * Αγωγός μετατροπής αρχείων της βιβλιοθήκης πολυμέσων.
 *
 * SERVER-SIDE ONLY — φορτώνει `sharp`.
 *
 * Κανόνες:
 * - Κάθε εικόνα γίνεται WebP (με διαφάνεια όπου υπάρχει), με τη μεγάλη πλευρά
 *   το πολύ 1440px· μικρότερες εικόνες μένουν στο μέγεθός τους.
 * - Τα SVG γίνονται raster WebP: δεν ανεβαίνουν ποτέ ως SVG στο CDN (εκτελέσιμο
 *   markup από δικό μας domain = XSS).
 * - Τα κινούμενα GIF γίνονται κινούμενα WebP.
 * - Ό,τι δεν είναι εικόνα (PDF, docx, zip, βίντεο…) αποθηκεύεται όπως είναι.
 */

import sharp, { type Metadata, type Sharp } from "sharp";

/** Μέγιστο μέγεθος αρχείου προς μεταφόρτωση (25 MB). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Μέγιστη μεγάλη πλευρά εικόνας μετά τη μετατροπή. */
export const MAX_IMAGE_DIMENSION = 1440;

/** Ποιότητα WebP. */
export const WEBP_QUALITY = 82;

/** Επεκτάσεις εικόνας που περνούν από μετατροπή σε WebP. */
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "tif",
  "tiff",
  "bmp",
  "svg",
]);

/**
 * Ρητή λίστα επιτρεπτών επεκτάσεων → πραγματικός τύπος MIME.
 * Ό,τι δεν είναι εδώ απορρίπτεται (html/js/php/exe/… δεν ανεβαίνουν ποτέ).
 */
const ALLOWED_EXTENSIONS: Record<string, string> = {
  // Εικόνες
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  // Έγγραφα
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  txt: "text/plain",
  rtf: "application/rtf",
  // Συμπιεσμένα
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  // Βίντεο
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  // Ήχος
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

/** Λίστα επεκτάσεων για το `accept` του `<input type="file">`. */
export const ACCEPTED_FILE_EXTENSIONS = Object.keys(ALLOWED_EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(",");

/** Σφάλμα που μπορεί να δείξει αυτούσιο ο χρήστης (ελληνικό μήνυμα). */
export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

export type ProcessedMedia = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  /** Μόνο για εικόνες. */
  width: number | null;
  height: number | null;
  size: number;
};

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

/** Ελληνικά → λατινικά, ώστε τα ονόματα αρχείων να παραμένουν αναγνωρίσιμα. */
const GREEK_TO_LATIN: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

function transliterate(value: string): string {
  let out = "";
  for (const char of value) {
    out += GREEK_TO_LATIN[char] ?? char;
  }
  return out;
}

/** Όνομα αρχείου ασφαλές για URL· κρατά το ουσιαστικό μέρος του πρωτότυπου. */
function slugify(baseName: string): string {
  const slug = transliterate(baseName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "arxeio";
}

/** Αφαιρεί την επέκταση από το όνομα αρχείου. */
function baseNameOf(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function isImageExtension(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(fileName));
}

async function processImage(input: Buffer, slug: string, ext: string): Promise<ProcessedMedia> {
  let probe: Metadata;
  try {
    probe = await sharp(input).metadata();
  } catch {
    throw new MediaError("Το αρχείο δεν είναι έγκυρη εικόνα.");
  }

  const pages = probe.pages ?? 1;
  const animated = pages > 1;

  let pipeline: Sharp;

  if (ext === "svg") {
    // Raster στο όριο: ανεβάζουμε την πυκνότητα ώστε η μεγάλη πλευρά να φτάσει
    // το cap, αλλιώς ένα μικρό SVG θα γινόταν θολό μικροσκοπικό WebP.
    const longest = Math.max(probe.width ?? 0, probe.height ?? 0) || MAX_IMAGE_DIMENSION;
    const baseDensity = probe.density && probe.density > 0 ? probe.density : 72;
    const density = Math.min(2400, Math.max(72, Math.round(baseDensity * (MAX_IMAGE_DIMENSION / longest))));
    pipeline = sharp(input, { density }).resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
    });
  } else if (animated) {
    // `rotate()` δεν συνδυάζεται με πολυσέλιδες εικόνες.
    pipeline = sharp(input, { animated: true }).resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
  } else {
    pipeline = sharp(input)
      // Πρώτα ο προσανατολισμός από το EXIF, μετά η σμίκρυνση.
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });
  }

  // Η διαφάνεια διατηρείται — δεν κάνουμε ποτέ flatten.
  // Τα metadata δεν αντιγράφονται (χωρίς `withMetadata()`).
  const { data, info } = await pipeline
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const height = animated ? (info.pageHeight ?? info.height) : info.height;

  return {
    buffer: data,
    fileName: `${slug}.webp`,
    mimeType: "image/webp",
    width: info.width,
    height,
    size: data.length,
  };
}

/**
 * Ελέγχει και προετοιμάζει ένα αρχείο για ανέβασμα στο CDN.
 *
 * @param input Τα bytes του αρχείου.
 * @param originalName Το όνομα που έδωσε ο χρήστης (χρησιμοποιείται για επέκταση/slug).
 */
export async function processMediaFile(input: Buffer, originalName: string): Promise<ProcessedMedia> {
  if (input.length === 0) {
    throw new MediaError("Το αρχείο είναι κενό.");
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new MediaError(
      `Το αρχείο ξεπερνά το όριο των ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`
    );
  }

  const ext = extensionOf(originalName);
  if (!ext) {
    throw new MediaError("Το αρχείο δεν έχει επέκταση και δεν μπορεί να ελεγχθεί.");
  }

  const mimeType = ALLOWED_EXTENSIONS[ext];
  if (!mimeType) {
    throw new MediaError(`Δεν επιτρέπονται αρχεία τύπου «.${ext}».`);
  }

  const slug = slugify(baseNameOf(originalName));

  if (IMAGE_EXTENSIONS.has(ext)) {
    return processImage(input, slug, ext);
  }

  // Ό,τι δεν είναι εικόνα αποθηκεύεται αυτούσιο, με τον πραγματικό του τύπο.
  return {
    buffer: input,
    fileName: `${slug}.${ext}`,
    mimeType,
    width: null,
    height: null,
    size: input.length,
  };
}
