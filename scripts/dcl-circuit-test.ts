/**
 * Δοκιμή ΟΛΟΥ του κυκλώματος, δοκιμαστικά.
 *
 *   npm run dcl:circuit
 *
 * Περνά ένα εικονικό όχημα από κάθε στάδιο και επαληθεύει καθένα ΞΕΧΩΡΙΣΤΑ:
 * κάμερα → απογραφή → άνοιγμα ΑΑΔΕ → έξοδος → στάση και χρέωση → κλείσιμο
 * ΑΑΔΕ → επιβεβαίωση από την ίδια την ΑΑΔΕ.
 *
 * Χρησιμοποιεί τον ΠΡΑΓΜΑΤΙΚΟ κώδικα παραγωγής, όχι αντίγραφο — αλλιώς η
 * δοκιμή θα επιβεβαίωνε τον εαυτό της. Στο τέλος καθαρίζει ό,τι έγραψε
 * τοπικά· οι εγγραφές στο δοκιμαστικό της ΑΑΔΕ μένουν, όπως κάθε δοκιμή.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { applyCameraPass } from "@/lib/parking-inventory";
import { notifyDclEntry, notifyDclExit } from "@/lib/dcl/live";
import { loadDclConfig, requestClients } from "@/lib/dcl/client";
import { wallClockNow, formatWallClock } from "@/lib/parking-time";
import { buildRevenueOverview } from "@/lib/revenue-overview";
import { fetchErpStays, reconcile } from "@/lib/parking-reconcile";
import { getParkingSessions } from "@/lib/parking-sessions";

const PLATE = "ZZT9001";
let step = 0;
const ok = (label: string, pass: boolean, detail = "") =>
  console.log(`${pass ? "✓" : "✗"} ${String(++step).padStart(2)}. ${label.padEnd(44)} ${detail}`);

async function main() {
  const cfg = loadDclConfig();
  console.log("── ΔΟΚΙΜΗ ΚΥΚΛΩΜΑΤΟΣ ──────────────────────");
  console.log(` περιβάλλον: ${cfg?.baseUrl ?? "—"}`);
  console.log(` αποστολή  : ${process.env.AADE_DCL_SUBMIT_ENABLED === "true" ? "ΕΝΕΡΓΗ" : "κλειστή"}`);
  console.log("");

  const now = wallClockNow();
  const entry = new Date(now.getTime() - 130 * 60000); // πριν 2ω10′
  const key = `${PLATE}|${entry.toISOString()}`;

  // Καθαρό σημείο εκκίνησης.
  await prisma.parkingInventory.deleteMany({ where: { plate: PLATE } });
  await prisma.parkingStay.deleteMany({ where: { plate: PLATE } });
  await prisma.dclRecord.deleteMany({ where: { plate: PLATE } });

  // ── 1. Είσοδος από κάμερα ────────────────────────────────────────────
  const inRes = await applyCameraPass(PLATE, "IN", entry);
  ok("Κάμερα: είσοδος", inRes.action === "added", inRes.action);

  const inv = await prisma.parkingInventory.findUnique({ where: { plate: PLATE } });
  ok("Απογραφή: το όχημα είναι μέσα", inv != null, inv ? formatWallClock(inv.enteredAt) : "—");

  // ── 2. Άνοιγμα στην ΑΑΔΕ ─────────────────────────────────────────────
  await notifyDclEntry(PLATE, entry, null);
  const opened = await prisma.dclRecord.findUnique({ where: { stayKey: key } });
  ok("ΑΑΔΕ: άνοιγμα εγγραφής", opened?.status === "SENT",
     opened ? `${opened.status} idDcl=${opened.idDcl ?? "—"}${opened.error ? " " + opened.error : ""}` : "καμία εγγραφή");

  // Διπλό άνοιγμα δεν επιτρέπεται — η ΑΑΔΕ δεν έχει idempotency.
  await notifyDclEntry(PLATE, entry, null);
  const dupes = await prisma.dclRecord.count({ where: { plate: PLATE } });
  ok("Προστασία από διπλή αποστολή", dupes === 1, `${dupes} εγγραφή/ές`);

  // ── 3. Έξοδος από κάμερα ─────────────────────────────────────────────
  const outRes = await applyCameraPass(PLATE, "OUT", now);
  ok("Κάμερα: έξοδος", outRes.action === "removed", outRes.reason ?? "");

  const stay = await prisma.parkingStay.findFirst({ where: { plate: PLATE } });
  ok("Στάση γράφτηκε με χρέωση", stay != null && stay.minutes > 0,
     stay ? `${stay.minutes}′ · ${stay.amount ?? 0} €` : "καμία");

  const gone = await prisma.parkingInventory.findUnique({ where: { plate: PLATE } });
  ok("Απογραφή: βγήκε", gone == null);

  // ── 4. Κλείσιμο στην ΑΑΔΕ ────────────────────────────────────────────
  if (stay) await notifyDclExit(PLATE, stay.enteredAt, stay.exitedAt, stay.amount ?? 0, stay.contractInst);
  const closed = await prisma.dclRecord.findUnique({ where: { stayKey: key } });
  ok("ΑΑΔΕ: κλείσιμο εγγραφής", closed?.status === "COMPLETED",
     closed ? `${closed.status} updateId=${closed.updateId ?? "—"}${closed.error ? " " + closed.error : ""}` : "—");

  // ── 5. Επιβεβαίωση από την ίδια την ΑΑΔΕ ─────────────────────────────
  if (cfg && closed?.idDcl) {
    const back = await requestClients(cfg, 0);
    const has = back.raw.includes(String(closed.idDcl));
    const completed = back.raw.includes(`<initialDclId>${closed.idDcl}</initialDclId>`);
    ok("Η ΑΑΔΕ επιβεβαιώνει το άνοιγμα", has, `idDcl=${closed.idDcl}`);
    ok("Η ΑΑΔΕ επιβεβαιώνει την ολοκλήρωση", completed);
  }

  // ── 6. ΤΑΜΕΙΟ ───────────────────────────────────────────────────────
  // Η χρέωση δεν αρκεί να γραφτεί· πρέπει να φτάσει στα έσοδα της ημέρας
  // και να φανεί ως ανείσπρακτη όσο δεν έχει κοπεί παραστατικό.
  const rev = await buildRevenueOverview();
  const inTill = rev.today.ourCharges >= (stay?.amount ?? 0);
  ok("Ταμείο: η χρέωση μπήκε στα έσοδα ημέρας", inTill,
     `ταμείο ${rev.today.ourCharges.toFixed(2)} € · ΑΛΠ ${rev.today.alp.total.toFixed(2)} € (${rev.today.alp.count})`);

  ok("Ταμείο: μετράει ως απλός πελάτης", rev.today.walkInStays > 0,
     `${rev.today.walkInStays} στάσεις απλών`);

  // Η αντιπαραβολή πρέπει να το δει ως στάθμευση ΧΩΡΙΣ εγγραφή στο ERP —
  // αυτό ακριβώς πιάνει μια είσπραξη που δεν τιμολογήθηκε.
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  try {
    const [sessions, erp] = await Promise.all([
      getParkingSessions(dayStart, now),
      fetchErpStays(dayStart, now),
    ]);
    const row = reconcile(sessions, erp).find((x) => x.plate === PLATE);
    ok("Αντιπαραβολή: εντοπίζει στάση χωρίς παραστατικό",
       row?.status === "MISSING_IN_ERP",
       row ? `${row.status} · δικό μας ${row.ourAmount?.toFixed(2) ?? "—"} € · ERP ${row.erpAmount?.toFixed(2) ?? "—"} €` : "δεν βρέθηκε");
  } catch (e) {
    ok("Αντιπαραβολή", false, e instanceof Error ? e.message : "απέτυχε");
  }

  // ── Καθαρισμός τοπικών δεδομένων ─────────────────────────────────────
  await prisma.parkingStay.deleteMany({ where: { plate: PLATE } });
  await prisma.dclRecord.deleteMany({ where: { plate: PLATE } });
  await prisma.parkingInventory.deleteMany({ where: { plate: PLATE } });
  console.log("\nΤοπικά δεδομένα δοκιμής καθαρίστηκαν.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
