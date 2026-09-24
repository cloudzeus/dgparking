import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { uploadImageToBunnyCDN } from "@/lib/bunny-cdn";

/**
 * Ανέβασμα εικόνας για το ενημερωτικό δελτίο.
 *
 * Τα email clients είναι ό,τι πιο συντηρητικό υπάρχει: δεν εμφανίζουν SVG,
 * δεν καταλαβαίνουν σύγχρονα προφίλ χρώματος και «σπάνε» σε τεράστια αρχεία.
 * Γι' αυτό ό,τι κι αν ανεβάσει ο συντάκτης βγαίνει από εδώ ως:
 *   JPEG (ή PNG όταν η πηγή έχει διαφάνεια) · sRGB · χωρίς μεταδεδομένα ·
 *   έως 1200 px πλάτος · ποιότητα ~82.
 * Το SVG ΡΑΣΤΕΡΟΠΟΙΕΙΤΑΙ — δεν περνάει ποτέ ως έχει.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Πάνω όριο αρχείου πριν καν ανοίξει το sharp. */
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_WIDTH = 1200;
const QUALITY = 82;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return error("Απαιτείται σύνδεση.", 401);
  }
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return error("Δεν έχεις δικαίωμα ανεβάσματος εικόνων.", 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("Το αίτημα δεν είναι έγκυρη φόρμα πολλαπλών μερών.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return error("Δεν στάλθηκε αρχείο.", 400);
  }
  if (!file.type.startsWith("image/")) {
    return error("Επιτρέπονται μόνο εικόνες.", 415);
  }
  if (file.size > MAX_BYTES) {
    return error("Η εικόνα ξεπερνά τα 10 MB.", 413);
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    // `density` για τα διανυσματικά: ρασταροποίηση σε αξιοπρεπή ανάλυση.
    const pipeline = sharp(input, { density: 200, failOn: "none" });
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      return error("Το αρχείο δεν αναγνωρίζεται ως εικόνα.", 415);
    }

    const resized = pipeline
      .rotate() // σεβασμός στο EXIF πριν πεταχτούν τα μεταδεδομένα
      .resize({ width: Math.min(metadata.width, MAX_WIDTH), withoutEnlargement: true })
      .toColourspace("srgb");

    const usePng = metadata.hasAlpha === true;
    const output = usePng
      ? await resized.png({ compressionLevel: 9 }).toBuffer()
      : await resized.flatten({ background: "#ffffff" }).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();

    const baseName = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
    const fileName = `${baseName}.${usePng ? "png" : "jpg"}`;

    const uploaded = await uploadImageToBunnyCDN(output.toString("base64"), fileName, "newsletter");

    return NextResponse.json({
      url: uploaded.url,
      fileName: uploaded.fileName,
      width: Math.min(metadata.width, MAX_WIDTH),
      format: usePng ? "png" : "jpeg",
    });
  } catch (err) {
    console.error("[NEWSLETTER] image upload failed:", err);
    return error("Η επεξεργασία της εικόνας απέτυχε.", 500);
  }
}
