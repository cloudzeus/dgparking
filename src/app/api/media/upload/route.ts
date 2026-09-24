/**
 * Μεταφόρτωση αρχείων στη βιβλιοθήκη πολυμέσων.
 *
 * multipart/form-data, πεδίο `files` (ένα ή περισσότερα αρχεία).
 * Κάθε αρχείο περνά από τον αγωγό του `src/lib/media.ts`, ανεβαίνει στο
 * BunnyCDN (φάκελος `media`) και καταγράφεται ως `MediaAsset`.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadImageToBunnyCDN } from "@/lib/bunny-cdn";
import { MediaError, processMediaFile } from "@/lib/media";
import { parseMediaAlt, type MediaAssetDTO } from "@/lib/media-asset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ο φάκελος της βιβλιοθήκης — και στο CDN και στη βάση. */
const MEDIA_FOLDER = "media";

type UploadResult =
  | { ok: true; name: string; asset: MediaAssetDTO }
  | { ok: false; name: string; error: string };

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Απαιτείται σύνδεση." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Δεν έχεις δικαίωμα μεταφόρτωσης αρχείων." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο αίτημα μεταφόρτωσης." }, { status: 400 });
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Δεν στάλθηκε κανένα αρχείο." }, { status: 400 });
  }

  const results: UploadResult[] = [];

  for (const file of files) {
    const name = file.name || "αρχείο";
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const processed = await processMediaFile(input, name);

      const uploaded = await uploadImageToBunnyCDN(
        processed.buffer.toString("base64"),
        processed.fileName,
        MEDIA_FOLDER
      );

      const created = await prisma.mediaAsset.create({
        data: {
          title: name.replace(/\.[^.]+$/, "").slice(0, 255) || uploaded.fileName,
          fileName: uploaded.fileName,
          url: uploaded.url,
          mimeType: processed.mimeType,
          fileSize: processed.size,
          width: processed.width,
          height: processed.height,
          alt: { el: "", en: "", it: "" },
          folder: MEDIA_FOLDER,
          uploadedById: session.user.id,
        },
      });

      results.push({
        ok: true,
        name,
        asset: {
          id: created.id,
          title: created.title,
          fileName: created.fileName,
          url: created.url,
          mimeType: created.mimeType,
          fileSize: created.fileSize,
          width: created.width,
          height: created.height,
          alt: parseMediaAlt(created.alt),
          folder: created.folder,
          createdAt: created.createdAt.toISOString(),
        },
      });
    } catch (error) {
      const message =
        error instanceof MediaError
          ? error.message
          : "Η μεταφόρτωση απέτυχε. Δοκίμασε ξανά ή δες τα αρχεία καταγραφής.";
      if (!(error instanceof MediaError)) {
        console.error("[media/upload] failed", name, error);
      }
      results.push({ ok: false, name, error: message });
    }
  }

  const uploaded = results.filter((result) => result.ok).length;
  return NextResponse.json({ uploaded, failed: results.length - uploaded, results });
}
