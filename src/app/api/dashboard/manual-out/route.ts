import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePlate } from "@/lib/plate";
import { wallClockNow } from "@/lib/parking-time";
import { applyCameraPass } from "@/lib/parking-inventory";

/**
 * POST /api/dashboard/manual-out
 *
 * Χειροκίνητη καταγραφή αποχώρησης, όταν το προσωπικό βλέπει ότι ένα όχημα
 * έφυγε χωρίς να το πιάσει η κάμερα.
 *
 * ΤΡΙΑ ΣΦΑΛΜΑΤΑ ΠΟΥ ΔΙΟΡΘΩΘΗΚΑΝ ΕΔΩ
 *
 * 1. ΩΡΑ ΤΡΕΙΣ ΩΡΕΣ ΠΙΣΩ. Το UI στέλνει πραγματικό UTC (`toISOString`), ενώ
 *    όλη η εφαρμογή δουλεύει σε «ώρα τοίχου» Αθήνας γραμμένη σε πεδία UTC.
 *    Αποθηκεύοντας το αυτούσιο, μια αποχώρηση στις 06:31 καταγραφόταν ως
 *    03:31 — και η στάθμευση έβγαινε τρεις ώρες μικρότερη.
 *
 * 2. Η ΑΠΟΓΡΑΦΗ ΔΕΝ ΕΝΗΜΕΡΩΝΟΤΑΝ. Δημιουργούνταν μόνο το συμβάν. Το όχημα
 *    έμενε «μέσα» για πάντα, δεν γραφόταν στάση, δεν χρεωνόταν, και
 *    εμφανιζόταν στην αντιπαραβολή ως ανοιχτό. Δύο οχήματα βρέθηκαν έτσι
 *    κολλημένα από την προηγούμενη ημέρα.
 *
 * 3. Η ΠΙΝΑΚΙΔΑ ΔΕΝ ΚΑΝΟΝΙΚΟΠΟΙΟΥΝΤΑΝ. Σκέτο `toUpperCase()` αφήνει τους
 *    ελληνικούς χαρακτήρες αμετάγραπτους, οπότε η πινακίδα δεν ταίριαζε με
 *    καμία σύμβαση ούτε με την απογραφή.
 *
 * Η ενέργεια καταγράφεται ως ανωμαλία: μια χειροκίνητη έξοδος σημαίνει ότι η
 * κάμερα έχασε ένα πέρασμα, και αυτό πρέπει να φαίνεται στη βραδινή αναφορά
 * αντί να διορθώνεται σιωπηλά.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const raw = typeof body.licensePlate === "string" ? body.licensePlate.trim() : "";
    if (!raw || raw.length < 2) {
      return NextResponse.json(
        { success: false, error: "Απαιτείται έγκυρη πινακίδα." },
        { status: 400 }
      );
    }

    const plate = normalizePlate(raw);

    // Το εισερχόμενο είναι ΣΤΙΓΜΗ (ISO με Z). Μετατρέπεται σε ώρα τοίχου,
    // που είναι η σύμβαση όλης της εφαρμογής.
    const instant = body.recognitionTime ? new Date(body.recognitionTime) : new Date();
    if (isNaN(instant.getTime())) {
      return NextResponse.json({ success: false, error: "Άκυρη ώρα." }, { status: 400 });
    }
    const recognitionTime = wallClockNow(instant);

    const created = await prisma.lprRecognitionEvent.create({
      data: {
        licensePlate: plate,
        recognitionTime,
        direction: "OUT",
        plateType: null,
        vehicleColor: null,
        vehicleBrand: null,
        vehicleType: null,
        plateColor: null,
      },
      include: { camera: { select: { name: true } } },
    });

    // Κλείνει τη στάθμευση και γράφει τη χρέωση, όπως ακριβώς θα έκανε η
    // κάμερα. Χωρίς αυτό, το συμβάν είναι διακοσμητικό.
    const applied = await applyCameraPass(plate, "OUT", recognitionTime);

    try {
      await prisma.parkingAnomaly.create({
        data: {
          plate,
          kind: "MANUAL_EXIT",
          at: recognitionTime,
          detail:
            `Χειροκίνητη καταγραφή αποχώρησης από ${session.user.email ?? "χρήστη"} — ` +
            `η κάμερα δεν κατέγραψε το πέρασμα (${applied.action}${applied.reason ? `: ${applied.reason}` : ""}).`,
        },
      });
    } catch (error) {
      // Η καταγραφή ανωμαλίας δεν εμποδίζει την αποχώρηση.
      console.error("[MANUAL-OUT] Η ανωμαλία δεν καταγράφηκε:", error);
    }

    return NextResponse.json({
      success: true,
      inventory: applied,
      event: { ...created, images: [] },
    });
  } catch (error) {
    console.error("[MANUAL-OUT] Απέτυχε:", error);
    return NextResponse.json(
      { success: false, error: "Η καταγραφή απέτυχε." },
      { status: 500 }
    );
  }
}
