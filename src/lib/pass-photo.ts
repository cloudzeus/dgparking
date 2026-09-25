import { prisma } from "@/lib/prisma";

/**
 * Η φωτογραφία ενός περάσματος, ως URL.
 *
 * Το αποδεικτικό υπέρβασης κατεβάζει και συμπιέζει την εικόνα γιατί την
 * ενσωματώνει σε PDF. Μια σελίδα δεν χρειάζεται αυτό — της αρκεί το URL, που
 * το φορτώνει ο browser κατευθείαν από το CDN.
 *
 * Ανοχή ±15 λεπτά: η ώρα της στάσης έρχεται από την απογραφή, η ώρα του
 * συμβάντος από την κάμερα, και οι δύο δεν πέφτουν πάντα στο ίδιο λεπτό.
 */
const RANK: Record<string, number> = { FULL_IMAGE: 0, SNAPSHOT: 1, PLATE_IMAGE: 2 };
const TOLERANCE_MS = 15 * 60_000;

export type PassPhoto = { url: string; at: Date } | null;

export async function findPassPhoto(
  plate: string,
  at: Date,
  direction: "IN" | "OUT"
): Promise<PassPhoto> {
  const event = await prisma.lprRecognitionEvent.findFirst({
    where: {
      licensePlate: plate,
      direction,
      recognitionTime: {
        gte: new Date(at.getTime() - TOLERANCE_MS),
        lte: new Date(at.getTime() + TOLERANCE_MS),
      },
    },
    orderBy: { recognitionTime: "asc" },
    select: { id: true, recognitionTime: true },
  });
  if (!event) return null;

  const images = await prisma.lprImage.findMany({
    where: { eventType: "recognition", eventId: event.id },
    select: { url: true, imageType: true },
  });
  const best = images.sort((a, b) => (RANK[a.imageType] ?? 9) - (RANK[b.imageType] ?? 9))[0];
  return best ? { url: best.url, at: event.recognitionTime } : null;
}

/** Οι φωτογραφίες εισόδου και εξόδου μιας στάσης, σε μία κλήση. */
export async function findStayPhotos(
  plate: string,
  enteredAt: Date,
  exitedAt: Date | null
): Promise<{ in: PassPhoto; out: PassPhoto }> {
  const [inPhoto, outPhoto] = await Promise.all([
    findPassPhoto(plate, enteredAt, "IN"),
    exitedAt ? findPassPhoto(plate, exitedAt, "OUT") : Promise.resolve(null),
  ]);
  return { in: inPhoto, out: outPhoto };
}
