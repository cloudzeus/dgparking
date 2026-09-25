/**
 * Ζωντανή ενημέρωση του Ψηφιακού Πελατολογίου, τη στιγμή του περάσματος.
 *
 * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΕ ΠΕΡΙΟΔΙΚΟ ΠΕΡΑΣΜΑ
 * Με χειροκίνητο ή περιοδικό συγχρονισμό, ανάμεσα στην έξοδο του οχήματος
 * και το κλείσιμο της εγγραφής υπάρχει πάντα παράθυρο. Στο δοκιμαστικό δεν
 * πειράζει· σε παραγωγικό, μια στάθμευση που μένει ανοιχτή όλη τη νύχτα
 * είναι ανοιχτή φορολογική εγγραφή. Ο σωστός χρόνος είναι η στιγμή που
 * κλείνει η στάθμευση.
 *
 * ΔΥΟ ΚΑΝΟΝΕΣ ΠΟΥ ΔΕΝ ΠΑΡΑΒΙΑΖΟΝΤΑΙ
 *
 * 1. ΠΟΤΕ ΔΕΝ ΡΙΧΝΕΙ. Η μπάρα δεν περιμένει την ΑΑΔΕ. Κάθε σφάλμα πιάνεται
 *    και καταγράφεται ως `FAILED`· το πέρασμα έχει ήδη γραφτεί στη βάση και
 *    δεν ακυρώνεται επειδή απάντησε αργά ένας τρίτος.
 *
 * 2. ΣΥΝΤΟΜΟ ΟΡΙΟ ΧΡΟΝΟΥ. Ο κανονικός client περιμένει 30 δευτερόλεπτα, που
 *    είναι λογικό για μαζικό συγχρονισμό αλλά απαράδεκτο μέσα σε webhook
 *    κάμερας: οι κάμερες στέλνουν κατά ριπές και μια αργή απάντηση θα
 *    κρατούσε τη σύνδεση ανοιχτή για όλο το μπλοκ. Εδώ η αποτυχία είναι
 *    φθηνή — η εγγραφή μένει `FAILED` και ο επόμενος συγχρονισμός τη μαζεύει.
 */

import { prisma } from "@/lib/prisma";
import { wallClockNow } from "@/lib/parking-time";
import { isExempt } from "@/lib/exempt-plates";
import { loadDclConfig, sendClient, updateClient, isSubmitEnabled } from "./client";
import { buildSendClient, buildUpdateClient, type CustomerKind, type StayForDcl } from "./policy";
import { isValidGreekVat } from "./vat";

const stayKey = (plate: string, entry: Date) => `${plate}|${entry.toISOString()}`;

/** Πόσο περιμένουμε την ΑΑΔΕ μέσα στη ροή των καμερών. */
const LIVE_TIMEOUT_MS = 8000;

/**
 * Εγκαταλείπει μετά από λίγο.
 *
 * Το αποτέλεσμα ΔΕΝ ακυρώνεται — αν η ΑΑΔΕ απαντήσει αργότερα, η εγγραφή
 * έχει δημιουργηθεί εκεί αλλά εμείς τη θεωρούμε αποτυχημένη. Γι' αυτό ο
 * επόμενος συγχρονισμός δεν ξαναστέλνει στα τυφλά: ελέγχει πρώτα με
 * `RequestClients` τι υπάρχει όντως.
 */
async function withTimeout<T>(p: Promise<T>, label: string): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[DCL-LIVE] ${label}: η ΑΑΔΕ δεν απάντησε σε ${LIVE_TIMEOUT_MS}ms`);
          resolve(null);
        }, LIVE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Το ΑΦΜ του πελάτη μιας σύμβασης — μόνο αν είναι έγκυρο. */
async function contractVat(inst: number | null): Promise<string | null> {
  if (inst == null) return null;
  const contract = await prisma.iNST.findUnique({
    where: { INST: inst },
    select: { TRDR: true },
  });
  if (!contract?.TRDR) return null;
  const customer = await prisma.cUSTORMER.findFirst({
    where: { TRDR: contract.TRDR },
    select: { AFM: true },
  });
  const afm = (customer?.AFM ?? "").trim();
  return isValidGreekVat(afm) ? afm : null;
}

async function describe(
  plate: string,
  at: Date,
  contractInst: number | null,
  amount: number,
  entry: Date,
  exit: Date | null
): Promise<StayForDcl> {
  const exempt = await isExempt(plate, at);
  const kind: CustomerKind = exempt ? "EXEMPT" : contractInst != null ? "CONTRACT" : "WALK_IN";
  const category = exempt
    ? (
        await prisma.exemptPlate.findUnique({
          where: { plate },
          select: { category: true },
        })
      )?.category ?? "Άλλο"
    : null;

  return {
    plate,
    entry,
    exit,
    amount,
    kind,
    contractInst,
    customerVatNumber: kind === "CONTRACT" ? await contractVat(contractInst) : null,
    exemptCategory: category,
  };
}

/** Είναι ενεργή η ζωντανή ενημέρωση; */
function live(): boolean {
  return isSubmitEnabled() && loadDclConfig() != null;
}

/**
 * Είσοδος οχήματος → άνοιγμα εγγραφής.
 *
 * Καλείται ΑΦΟΥ έχει γραφτεί η απογραφή, ώστε μια αποτυχία εδώ να μην
 * εμποδίζει το όχημα να καταγραφεί ως «μέσα».
 */
export async function notifyDclEntry(
  plate: string,
  enteredAt: Date,
  contractInst: number | null
): Promise<void> {
  if (!live()) return;
  const config = loadDclConfig()!;
  const key = stayKey(plate, enteredAt);

  try {
    const existing = await prisma.dclRecord.findUnique({ where: { stayKey: key } });
    if (existing) return; // ήδη σταλμένη — η ΑΑΔΕ δεν έχει idempotency

    const stay = await describe(plate, enteredAt, contractInst, 0, enteredAt, null);
    const payload = buildSendClient(stay, Number(process.env.AADE_BRANCH ?? 0), wallClockNow());

    const record = await prisma.dclRecord.create({
      data: {
        stayKey: key,
        plate,
        enteredAt,
        kind: stay.kind,
        amount: 0,
        contractInst,
        status: "DRAFT",
        sentPayload: payload as unknown as object,
      },
    });

    const res = await withTimeout(sendClient(config, payload), `άνοιγμα ${plate}`);
    await prisma.dclRecord.update({
      where: { id: record.id },
      data:
        res?.ok === true
          ? { status: "SENT", idDcl: BigInt(res.id), error: null }
          : {
              status: "FAILED",
              error: res ? `${res.code}: ${res.message}` : "λήξη χρόνου αναμονής",
            },
    });
  } catch (error) {
    console.error(`[DCL-LIVE] Το άνοιγμα για ${plate} απέτυχε:`, error);
  }
}

/**
 * Έξοδος οχήματος → κλείσιμο εγγραφής.
 *
 * Αν δεν υπάρχει άνοιγμα (π.χ. το όχημα μπήκε πριν ενεργοποιηθεί η ζωντανή
 * ενημέρωση), ανοίγει και κλείνει μέσα στην ίδια κλήση.
 */
export async function notifyDclExit(
  plate: string,
  enteredAt: Date,
  exitedAt: Date,
  amount: number,
  contractInst: number | null
): Promise<void> {
  if (!live()) return;
  const config = loadDclConfig()!;
  const key = stayKey(plate, enteredAt);

  try {
    const stay = await describe(plate, exitedAt, contractInst, amount, enteredAt, exitedAt);
    let record = await prisma.dclRecord.findUnique({ where: { stayKey: key } });

    if (!record || record.status === "FAILED" || record.idDcl == null) {
      const payload = buildSendClient(stay, Number(process.env.AADE_BRANCH ?? 0), wallClockNow());
      const open = await withTimeout(sendClient(config, payload), `άνοιγμα ${plate}`);
      if (!open?.ok) {
        await prisma.dclRecord.upsert({
          where: { stayKey: key },
          create: {
            stayKey: key, plate, enteredAt, exitedAt, kind: stay.kind,
            amount, contractInst, status: "FAILED",
            error: open ? `${open.code}: ${open.message}` : "λήξη χρόνου αναμονής",
            sentPayload: payload as unknown as object,
          },
          update: {
            status: "FAILED",
            error: open ? `${open.code}: ${open.message}` : "λήξη χρόνου αναμονής",
          },
        });
        return;
      }
      record = await prisma.dclRecord.upsert({
        where: { stayKey: key },
        create: {
          stayKey: key, plate, enteredAt, exitedAt, kind: stay.kind,
          amount, contractInst, status: "SENT", idDcl: BigInt(open.id),
          sentPayload: payload as unknown as object,
        },
        update: { status: "SENT", idDcl: BigInt(open.id), error: null },
      });
    }

    if (record.status === "COMPLETED") return; // η ΑΑΔΕ απορρίπτει διπλό κλείσιμο

    const res = await withTimeout(
      updateClient(config, buildUpdateClient(stay, Number(record.idDcl))),
      `κλείσιμο ${plate}`
    );
    await prisma.dclRecord.update({
      where: { id: record.id },
      data: res?.ok === true
        ? {
            status: "COMPLETED",
            updateId: BigInt(res.id),
            exitedAt,
            amount,
            error: null,
          }
        : {
            exitedAt,
            amount,
            error: res ? `${res.code}: ${res.message}` : "λήξη χρόνου αναμονής",
          },
    });
  } catch (error) {
    console.error(`[DCL-LIVE] Το κλείσιμο για ${plate} απέτυχε:`, error);
  }
}
