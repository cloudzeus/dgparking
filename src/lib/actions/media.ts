"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImageFromBunnyCDN } from "@/lib/bunny-cdn";
import {
  MEDIA_LOCALES,
  mediaKind,
  parseMediaAlt,
  storagePathFromUrl,
  type MediaActionResult,
  type MediaAssetDTO,
  type MediaKind,
} from "@/lib/media-asset";

/** Τη βιβλιοθήκη τη διαχειρίζονται διαχειριστές και υπεύθυνοι. */
async function requireLibraryAccess() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    throw new Error("Δεν έχεις δικαίωμα σε αυτή την ενέργεια.");
  }
  return session.user;
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Συμπλήρωσε τίτλο.").max(255, "Ο τίτλος είναι πολύ μεγάλος."),
  alt: z.object({
    el: z.string().trim().max(500).default(""),
    en: z.string().trim().max(500).default(""),
    it: z.string().trim().max(500).default(""),
  }),
});

type MediaAssetRow = {
  id: string;
  title: string;
  fileName: string;
  url: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  alt: unknown;
  folder: string;
  createdAt: Date;
};

function toDto(row: MediaAssetRow): MediaAssetDTO {
  return {
    id: row.id,
    title: row.title,
    fileName: row.fileName,
    url: row.url,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    width: row.width,
    height: row.height,
    alt: parseMediaAlt(row.alt),
    folder: row.folder,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Φίλτρο τύπου → συνθήκη `mimeType` για το Prisma. */
function mimeFilter(kind: MediaKind | "all") {
  switch (kind) {
    case "image":
      return { startsWith: "image/" };
    case "video":
      return { startsWith: "video/" };
    case "audio":
      return { startsWith: "audio/" };
    case "pdf":
      return { equals: "application/pdf" };
    default:
      return undefined;
  }
}

/**
 * Λίστα αρχείων για τον επιλογέα (`MediaPicker`) και για ανανέωση της συλλογής.
 * Το «document»/«archive» φιλτράρεται στη μνήμη γιατί δεν έχει ενιαίο πρόθεμα.
 */
export async function listMediaAssets(params: {
  search?: string;
  kind?: MediaKind | "all";
  take?: number;
}): Promise<MediaAssetDTO[]> {
  await requireLibraryAccess();

  const kind = params.kind ?? "all";
  const search = params.search?.trim();
  const take = Math.min(Math.max(params.take ?? 200, 1), 500);

  const rows = await prisma.mediaAsset.findMany({
    where: {
      ...(search ? { OR: [{ title: { contains: search } }, { fileName: { contains: search } }] } : {}),
      ...(mimeFilter(kind) ? { mimeType: mimeFilter(kind) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const assets = rows.map(toDto);

  if (kind === "document" || kind === "archive") {
    return assets.filter((asset) => mediaKind(asset.mimeType) === kind);
  }
  return assets;
}

/** Αλλαγή τίτλου και εναλλακτικού κειμένου ανά γλώσσα. */
export async function updateMediaAsset(input: {
  id: string;
  title: string;
  alt: Record<string, string>;
}): Promise<MediaActionResult> {
  try {
    await requireLibraryAccess();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Δεν έχεις δικαίωμα." };
  }

  const parsed = updateSchema.safeParse({
    id: input.id,
    title: input.title,
    alt: Object.fromEntries(MEDIA_LOCALES.map((locale) => [locale, input.alt?.[locale] ?? ""])),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Τα στοιχεία δεν είναι έγκυρα." };
  }

  try {
    await prisma.mediaAsset.update({
      where: { id: parsed.data.id },
      data: { title: parsed.data.title, alt: parsed.data.alt },
    });
  } catch (error) {
    console.error("[media] update failed", error);
    return { ok: false, error: "Η αποθήκευση απέτυχε." };
  }

  revalidatePath("/media");
  return { ok: true, message: "Το αρχείο αποθηκεύτηκε." };
}

/**
 * Διαγραφή αρχείου: πρώτα από το BunnyCDN, μετά από τη βάση.
 * Αν αποτύχει το CDN, η εγγραφή διαγράφεται ούτως ή άλλως και το λέμε καθαρά
 * στον χρήστη — το αρχείο μένει στο storage και θέλει χειροκίνητο καθάρισμα.
 */
export async function deleteMediaAsset(id: string): Promise<MediaActionResult> {
  try {
    await requireLibraryAccess();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Δεν έχεις δικαίωμα." };
  }

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return { ok: false, error: "Το αρχείο δεν βρέθηκε." };
  }

  let warning: string | undefined;
  const path = storagePathFromUrl(asset.url, process.env.BUNNY_STORAGE_ZONE);

  if (!path) {
    warning = "Δεν ήταν δυνατό να εντοπιστεί η διαδρομή του αρχείου στο CDN — διαγράψ' το χειροκίνητα.";
  } else {
    try {
      await deleteImageFromBunnyCDN(path);
    } catch (error) {
      console.error("[media] CDN delete failed", path, error);
      warning = `Το αρχείο δεν διαγράφηκε από το BunnyCDN (${path}) — διαγράψ' το χειροκίνητα.`;
    }
  }

  try {
    await prisma.mediaAsset.delete({ where: { id } });
  } catch (error) {
    console.error("[media] delete failed", error);
    return { ok: false, error: "Η διαγραφή από τη βάση απέτυχε." };
  }

  revalidatePath("/media");
  return { ok: true, message: "Το αρχείο διαγράφηκε.", warning };
}
