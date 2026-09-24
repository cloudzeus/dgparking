import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePlate } from "@/lib/plate";
import { isReadablePlate } from "@/lib/parking-time";

/**
 * PATCH /api/dashboard/recognition-event/[id]
 * Update a recognition event (e.g. license plate after reevaluate).
 * Body: { licensePlate: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Event id required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const licensePlate = typeof body.licensePlate === "string" ? body.licensePlate.trim() : "";
    if (!licensePlate || licensePlate.length < 2) {
      return NextResponse.json(
        { success: false, error: "Valid licensePlate required (min 2 chars)" },
        { status: 400 }
      );
    }

    const updated = await prisma.lprRecognitionEvent.update({
      where: { id },
      data: { licensePlate: licensePlate.toUpperCase() },
      include: {
        camera: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      event: {
        ...updated,
        images: [],
      },
    });
  } catch (error) {
    console.error("[DASHBOARD] PATCH recognition-event error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update event" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/recognition-event/[id]
 *
 * Διαγραφή συμβάντος αναγνώρισης.
 *
 * ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ: η κάμερα πιάνει συχνά πεζούς, φορτηγά χωρίς ορατή πινακίδα
 * ή θόρυβο, και καταγράφει συμβάντα «No Plates» που μολύνουν την κίνηση, τις
 * αναφορές και την αντιπαραβολή.
 *
 * Σβήνονται ΠΡΩΤΑ τα αρχεία από το CDN και μετά οι γραμμές: αν φύγει πρώτη η
 * γραμμή, χάνεται το URL και το αρχείο μένει ορφανό για πάντα.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Απαιτείται σύνδεση." }, { status: 401 });
    }
    if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(session.user.role)) {
      return NextResponse.json({ success: false, error: "Δεν έχετε δικαίωμα διαγραφής." }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Λείπει το αναγνωριστικό." }, { status: 400 });
    }

    const event = await prisma.lprRecognitionEvent.findUnique({
      where: { id },
      select: { id: true, licensePlate: true, direction: true, recognitionTime: true },
    });
    if (!event) {
      return NextResponse.json({ success: false, error: "Το συμβάν δεν βρέθηκε." }, { status: 404 });
    }

    const images = await prisma.lprImage.findMany({
      where: { eventType: "recognition", eventId: id },
      select: { id: true, url: true },
    });

    // Τα ίδια αρχεία μπορεί να μοιράζονται URL (full image και snapshot), οπότε
    // σβήνουμε κάθε μοναδικό μονοπάτι μία φορά.
    const zone = process.env.BUNNY_STORAGE_ZONE;
    const key = process.env.BUNNY_ACCESS_KEY;
    const host = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
    let cdnDeleted = 0;
    if (zone && key) {
      for (const url of [...new Set(images.map((i) => i.url))]) {
        try {
          const path = new URL(url).pathname.replace(/^\/+/, "");
          const res = await fetch(`https://${host}/${zone}/${path}`, {
            method: "DELETE",
            headers: { AccessKey: key },
          });
          if (res.ok || res.status === 404) cdnDeleted++;
        } catch {
          // Ένα αρχείο που δεν σβήστηκε δεν εμποδίζει τη διαγραφή του συμβάντος.
        }
      }
    }

    await prisma.lprImage.deleteMany({ where: { eventType: "recognition", eventId: id } });
    await prisma.lprRecognitionEvent.delete({ where: { id } });

    // ΚΑΙ ΤΑ ΠΑΡΑΓΩΓΑ. Το συμβάν δεν ζει μόνο του: κάθε πέρασμα ενημερώνει την
    // απογραφή και, στην έξοδο, γράφει στάση με χρέωση. Αυτοί οι πίνακες είναι
    // πλέον η πηγή της αντιπαραβολής, οπότε αν μείνουν, το διαγραμμένο συμβάν
    // εξακολουθεί να εμφανίζεται — χρεωμένο — και ας μην υπάρχει πια.
    const plate = normalizePlate(event.licensePlate);
    // Μια λήψη χωρίς αναγνώσιμη πινακίδα δεν αντιστοιχεί σε όχημα: το ψηφιακό
    // πελατολόγιο δεν δέχεται στάθμευση χωρίς πινακίδα, άρα ΚΑΘΕ παράγωγο
    // τέτοιας πινακίδας είναι σκουπίδι και φεύγει ολόκληρο.
    const junk = !isReadablePlate(plate);
    // Για αναγνώσιμη πινακίδα σβήνουμε μόνο ό,τι παρήγαγε ΑΥΤΟ το πέρασμα —
    // αλλιώς η διαγραφή μιας λήψης θα έσβηνε άσχετο ιστορικό του οχήματος.
    const t = event.recognitionTime;
    const near = { gte: new Date(t.getTime() - 60_000), lte: new Date(t.getTime() + 60_000) };

    const [invGone, stayGone] = await Promise.all([
      prisma.parkingInventory.deleteMany({
        where: junk ? { plate } : { plate, source: "CAMERA", enteredAt: near },
      }),
      prisma.parkingStay.deleteMany({
        where: junk
          ? { plate }
          : { plate, OR: [{ enteredAt: near }, { exitedAt: near }] },
      }),
    ]);

    console.log(
      `[EVENT-DELETE] ${session.user.email}: «${event.licensePlate}» ${event.direction} ` +
        `${event.recognitionTime.toISOString()} — ${images.length} εικόνες, ${cdnDeleted} από CDN, ` +
        `${invGone.count} από απογραφή, ${stayGone.count} στάσεις${junk ? " (μη αναγνώσιμη — πλήρης εκκαθάριση)" : ""}`
    );

    return NextResponse.json({
      success: true,
      deleted: {
        id,
        plate: event.licensePlate,
        images: images.length,
        cdnDeleted,
        inventory: invGone.count,
        stays: stayGone.count,
      },
    });
  } catch (error) {
    console.error("[EVENT-DELETE] Απέτυχε:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Η διαγραφή απέτυχε." },
      { status: 500 }
    );
  }
}
