/**
 * Αντιπαραβολή: τι έχει ΟΝΤΩΣ η ΑΑΔΕ έναντι του τι είδαν οι κάμερες.
 *
 * ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Ο ΔΙΚΟΣ ΜΑΣ ΠΙΝΑΚΑΣ
 * Το `dcl_records` λέει τι ΝΟΜΙΖΟΥΜΕ ότι στείλαμε. Αν μια κλήση πέτυχε αλλά
 * η απάντηση χάθηκε, ή αν κάποιος έστειλε κάτι από αλλού, ο πίνακας δεν το
 * ξέρει. Η μόνη αλήθεια είναι το `RequestClients` — τραβάμε πίσω ό,τι κρατά
 * η ΑΑΔΕ και το συγκρίνουμε με τις κάμερες.
 *
 * ΩΡΕΣ
 * Η ΑΑΔΕ επιστρέφει ημερομηνίες σε ώρα Ελλάδας (το λέει ρητά η τεκμηρίωση),
 * που ταυτίζεται με τη δική μας σύμβαση «ώρας τοίχου». Άρα συγκρίνονται
 * απευθείας — σε αντίθεση με την αποστολή, όπου στέλνουμε UTC.
 */

import { prisma } from "@/lib/prisma";
import { wallClockNow } from "@/lib/parking-time";
import { loadDclConfig, requestClients } from "./client";

export type AadeRecord = {
  idDcl: string;
  plate: string;
  createdAt: Date | null;
  completed: boolean;
  amount: number | null;
};

export type VerifyStatus =
  | "MATCH"
  | "ONLY_IN_AADE"
  | "ONLY_IN_CAMERAS"
  | "OPEN_IN_AADE"
  | "TIME_DIFF";

export type VerifyRow = {
  plate: string;
  idDcl: string | null;
  aadeEntry: Date | null;
  cameraEntry: Date | null;
  driftMinutes: number | null;
  aadeCompleted: boolean;
  cameraExited: boolean;
  status: VerifyStatus;
  note: string;
};

export type VerifyResult = {
  aadeTotal: number;
  cameraTotal: number;
  rows: VerifyRow[];
  counts: Record<VerifyStatus, number>;
  error?: string;
};

/** Απλή εξαγωγή — τα σχήματα της ΑΑΔΕ είναι ρηχά και σταθερά. */
function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}

/** Ώρα Ελλάδας από την ΑΑΔΕ → ρολόι τοίχου (ίδια σύμβαση, χωρίς μετατροπή). */
function parseAthens(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(`${value.replace(" ", "T").replace(/Z$/, "")}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function parseAadeRecords(xml: string): AadeRecord[] {
  const blocks = xml.split("<DigitalClient>").slice(1);
  const completedIds = new Set(
    [...xml.matchAll(/<initialDclId>(\d+)<\/initialDclId>/g)].map((m) => m[1])
  );

  return blocks.map((b) => {
    const idDcl = tag(b, "idDcl") ?? "";
    return {
      idDcl,
      plate: (tag(b, "vehicleRegistrationNumber") ?? "").trim().toUpperCase(),
      createdAt: parseAthens(tag(b, "creationDateTime")),
      completed: completedIds.has(idDcl) || b.includes("<entryCompletion>"),
      amount: tag(b, "amount") ? Number(tag(b, "amount")) : null,
    };
  });
}

/** Πόση διαφορά ώρας ανεχόμαστε πριν τη θεωρήσουμε απόκλιση. */
const DRIFT_TOLERANCE_MIN = 5;

export async function verifyAgainstAade(days = 2): Promise<VerifyResult> {
  const empty: VerifyResult = {
    aadeTotal: 0,
    cameraTotal: 0,
    rows: [],
    counts: { MATCH: 0, ONLY_IN_AADE: 0, ONLY_IN_CAMERAS: 0, OPEN_IN_AADE: 0, TIME_DIFF: 0 },
  };

  const config = loadDclConfig();
  if (!config) return { ...empty, error: "Λείπουν τα διαπιστευτήρια ΑΑΔΕ." };

  let aade: AadeRecord[];
  try {
    const res = await requestClients(config, 0);
    if (!res.ok) return { ...empty, error: "Η ΑΑΔΕ δεν απάντησε." };
    aade = parseAadeRecords(res.raw);
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "Η ανάκτηση απέτυχε." };
  }

  const now = wallClockNow();
  const from = new Date(now.getTime() - days * 24 * 3600_000);

  const [inside, stays] = await Promise.all([
    prisma.parkingInventory.findMany({ where: { enteredAt: { gte: from } } }),
    prisma.parkingStay.findMany({ where: { enteredAt: { gte: from } } }),
  ]);

  // Η κάμερα ως πηγή: πινακίδα + ώρα εισόδου, με σημάδι αν έχει βγει.
  type Cam = { plate: string; entry: Date; exited: boolean };
  const cameras: Cam[] = [
    ...inside.map((i) => ({ plate: i.plate, entry: i.enteredAt, exited: false })),
    ...stays.map((s) => ({ plate: s.plate, entry: s.enteredAt, exited: true })),
  ];

  const rows: VerifyRow[] = [];
  const usedCam = new Set<number>();

  // Οι δοκιμαστικές εγγραφές των πρώτων κλήσεων δεν είναι αποκλίσεις —
  // είναι σκουπίδια δικά μας, και πρέπει να φαίνονται ως τέτοια.
  const isProbe = (p: string) => /^(TEST|NOVAT|TESTNS)/.test(p);

  for (const a of aade) {
    if (!a.createdAt) continue;
    const within = a.createdAt >= from;
    if (!within && !isProbe(a.plate)) continue;

    let bestIdx = -1;
    let bestDrift = Infinity;
    cameras.forEach((c, i) => {
      if (usedCam.has(i) || c.plate !== a.plate) return;
      const drift = Math.abs(c.entry.getTime() - a.createdAt!.getTime()) / 60000;
      if (drift < bestDrift) {
        bestDrift = drift;
        bestIdx = i;
      }
    });

    const cam = bestIdx >= 0 ? cameras[bestIdx] : null;
    if (cam) usedCam.add(bestIdx);

    let status: VerifyStatus;
    let note: string;
    if (!cam) {
      status = "ONLY_IN_AADE";
      note = isProbe(a.plate)
        ? "Δοκιμαστική εγγραφή από τις πρώτες κλήσεις — δεν αντιστοιχεί σε όχημα."
        : "Υπάρχει στην ΑΑΔΕ αλλά καμία κάμερα δεν την είδε.";
    } else if (bestDrift > DRIFT_TOLERANCE_MIN) {
      status = "TIME_DIFF";
      note = `Η ώρα εισόδου διαφέρει κατά ${Math.round(bestDrift)}′.`;
    } else if (cam.exited && !a.completed) {
      status = "OPEN_IN_AADE";
      note = "Το όχημα έφυγε, αλλά η εγγραφή παραμένει ανοιχτή στην ΑΑΔΕ.";
    } else {
      status = "MATCH";
      note = a.completed ? "Ολοκληρωμένη και στις δύο πλευρές." : "Ανοιχτή και στις δύο.";
    }

    rows.push({
      plate: a.plate,
      idDcl: a.idDcl,
      aadeEntry: a.createdAt,
      cameraEntry: cam?.entry ?? null,
      driftMinutes: cam ? Math.round(bestDrift) : null,
      aadeCompleted: a.completed,
      cameraExited: cam?.exited ?? false,
      status,
      note,
    });
  }

  // Ό,τι είδαν οι κάμερες και δεν έφτασε ποτέ στην ΑΑΔΕ.
  cameras.forEach((c, i) => {
    if (usedCam.has(i)) return;
    rows.push({
      plate: c.plate,
      idDcl: null,
      aadeEntry: null,
      cameraEntry: c.entry,
      driftMinutes: null,
      aadeCompleted: false,
      cameraExited: c.exited,
      status: "ONLY_IN_CAMERAS",
      note: "Την είδαν οι κάμερες αλλά δεν έχει σταλεί στην ΑΑΔΕ.",
    });
  });

  const counts = { MATCH: 0, ONLY_IN_AADE: 0, ONLY_IN_CAMERAS: 0, OPEN_IN_AADE: 0, TIME_DIFF: 0 };
  for (const r of rows) counts[r.status]++;

  rows.sort((a, b) => {
    const rank = (s: VerifyStatus) => (s === "MATCH" ? 1 : 0);
    return (
      rank(a.status) - rank(b.status) ||
      (b.cameraEntry ?? b.aadeEntry ?? new Date(0)).getTime() -
        (a.cameraEntry ?? a.aadeEntry ?? new Date(0)).getTime()
    );
  });

  return { aadeTotal: aade.length, cameraTotal: cameras.length, rows, counts };
}
