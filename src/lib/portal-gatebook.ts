/**
 * Το βιβλίο πόρτας όπως το βλέπει ο πελάτης — μόνο τα δικά του οχήματα.
 *
 * ΓΙΑΤΙ ΔΙΑΒΑΖΕΙ ΤΟΥΣ ΔΙΚΟΥΣ ΜΑΣ ΠΙΝΑΚΕΣ ΚΑΙ ΟΧΙ ΤΟ ERP
 * Η απογραφή και οι ολοκληρωμένες στάσεις είναι ήδη συμφωνημένες με το
 * ψηφιακό πελατολόγιο και κρατούν την πραγματική ώρα εισόδου. Το ERP από την
 * άλλη κλείνει τις γραμμές με καθυστέρηση — ένας πελάτης που μόλις έφυγε θα
 * έβλεπε το αυτοκίνητό του «ακόμα μέσα» για ώρα. Επιπλέον, μια κλήση στο ERP
 * ανά φόρτωση σελίδας πελάτη δεν κλιμακώνει.
 *
 * ΤΙ ΔΕΝ ΔΕΙΧΝΟΥΜΕ
 * Καμία χρέωση. Τα οχήματα υπό σύμβαση δεν χρεώνονται ανά στάθμευση, και ένα
 * ποσό δίπλα σε κάθε κίνηση θα διαβαζόταν ως οφειλή. Τα χρήματα ζουν στην
 * καρτέλα «Τιμολόγια», όπου αντιστοιχούν σε πραγματικά παραστατικά.
 */

import { prisma } from "@/lib/prisma";
import { normalizePlate } from "@/lib/plate";
import { wallClockNow } from "@/lib/parking-time";

export type PortalMovement = {
  plate: string;
  /** Ώρα εισόδου σε τοπική ώρα, ήδη μορφοποιημένη. */
  entry: string;
  /** Κενό όσο το όχημα βρίσκεται μέσα. */
  exit: string | null;
  /** Διάρκεια παραμονής· για όσα είναι μέσα, μέχρι τώρα. */
  duration: string;
  inside: boolean;
};

export type PortalGateBook = {
  inside: PortalMovement[];
  history: PortalMovement[];
  /** Πόσα από τα οχήματα του πελάτη βρίσκονται αυτή τη στιγμή μέσα. */
  insideCount: number;
};

const two = (n: number) => String(n).padStart(2, "0");

/** Ώρα τοίχου: τα πεδία είναι ήδη τοπική ώρα Αθήνας αποθηκευμένη ως UTC. */
function stamp(d: Date, withDate = true): string {
  const time = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  if (!withDate) return time;
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)} ${time}`;
}

function spanLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} λεπτά`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m === 0 ? `${h} ώρες` : `${h}ω ${m}′`;
  const d = Math.floor(h / 24);
  return `${d} ημέρες ${h % 24}ω`;
}

/**
 * Οι κινήσεις των πινακίδων μιας σύμβασης.
 *
 * Οι πινακίδες κανονικοποιούνται με τον κανόνα του SoftOne, αλλιώς μια
 * πινακίδα γραμμένη με ελληνικούς χαρακτήρες στη σύμβαση δεν θα ταίριαζε
 * ποτέ με την ίδια πινακίδα όπως την έγραψε η κάμερα.
 */
export async function getPortalGateBook(
  plates: string[],
  days = 30
): Promise<PortalGateBook> {
  const keys = [...new Set(plates.map(normalizePlate).filter(Boolean))];
  if (keys.length === 0) return { inside: [], history: [], insideCount: 0 };

  const now = wallClockNow();
  const since = new Date(now.getTime() - days * 24 * 3600_000);

  const [open, closed] = await Promise.all([
    prisma.parkingInventory.findMany({
      where: { plate: { in: keys } },
      orderBy: { enteredAt: "desc" },
      select: { plate: true, enteredAt: true },
    }),
    prisma.parkingStay.findMany({
      where: { plate: { in: keys }, exitedAt: { gte: since } },
      orderBy: { exitedAt: "desc" },
      take: 200,
      select: { plate: true, enteredAt: true, exitedAt: true, minutes: true },
    }),
  ]);

  const inside: PortalMovement[] = open.map((r) => ({
    plate: r.plate,
    entry: stamp(r.enteredAt),
    exit: null,
    duration: spanLabel(Math.max(0, Math.round((now.getTime() - r.enteredAt.getTime()) / 60000))),
    inside: true,
  }));

  const history: PortalMovement[] = closed.map((r) => ({
    plate: r.plate,
    entry: stamp(r.enteredAt),
    exit: stamp(r.exitedAt, false),
    duration: spanLabel(r.minutes),
    inside: false,
  }));

  return { inside, history, insideCount: inside.length };
}
