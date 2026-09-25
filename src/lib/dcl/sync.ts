/**
 * Συγχρονισμός των δικών μας σταθμεύσεων με το Ψηφιακό Πελατολόγιο ΑΑΔΕ.
 *
 * ΤΡΕΧΕΙ ΠΑΡΑΛΛΗΛΑ, ΔΕΝ ΑΝΤΙΚΑΘΙΣΤΑ
 * Το SoftOne υποβάλλει ήδη στο ΠΑΡΑΓΩΓΙΚΟ. Εδώ μιλάμε στο ΔΟΚΙΜΑΣΤΙΚΟ, που
 * είναι δεμένο σε άλλο ΑΦΜ — οπότε δεν υπάρχει κίνδυνος διπλών εγγραφών στην
 * πραγματική εταιρία. Αν κάποτε στραφεί στο παραγωγικό, ο κίνδυνος γίνεται
 * υπαρκτός και γι' αυτό υπάρχει ο διακόπτης `AADE_DCL_SUBMIT_ENABLED`.
 *
 * ΓΙΑΤΙ ΤΟΠΙΚΟΣ ΠΙΝΑΚΑΣ ΠΡΙΝ ΤΗΝ ΚΛΗΣΗ
 * Η ΑΑΔΕ δεν έχει idempotency: δύο `SendClient` για την ίδια είσοδο
 * δημιουργούν δύο εγγραφές, και δεν υπάρχει τρόπος να ενωθούν μετά. Κάθε
 * στάθμευση παίρνει κλειδί (`πινακίδα|ώρα εισόδου`) και γράφεται ΠΡΩΤΑ
 * τοπικά. Αν η κλήση αποτύχει στη μέση, η επόμενη εκτέλεση βρίσκει τη γραμμή
 * και συνεχίζει από εκεί που έμεινε, αντί να ξαναρχίσει.
 */

import { prisma } from "@/lib/prisma";
import { wallClockNow, formatWallClock } from "@/lib/parking-time";
import { getExemptPlates } from "@/lib/exempt-plates";
import {
  loadDclConfig,
  sendClient,
  updateClient,
  isSubmitEnabled,
} from "./client";
import { isValidGreekVat } from "./vat";
import {
  buildSendClient,
  buildUpdateClient,
  type CustomerKind,
  type StayForDcl,
} from "./policy";

export type SyncOutcome = {
  opened: number;
  completed: number;
  skipped: number;
  failed: number;
  submitDisabled: boolean;
  messages: string[];
};

const key = (plate: string, entry: Date) => `${plate}|${entry.toISOString()}`;

/** Οι κατηγορίες των απαλλαγμένων πινακίδων, για τη χαρτογράφηση στην ΑΑΔΕ. */
async function exemptCategories(): Promise<Map<string, string>> {
  const rows = await prisma.exemptPlate.findMany({
    where: { isActive: true },
    select: { plate: true, category: true },
  });
  return new Map(rows.map((r) => [r.plate, r.category]));
}

/**
 * Τα ΑΦΜ των πελατών ανά σύμβαση.
 *
 * Χωρίς ΑΦΜ δεν μπορεί να δηλωθεί επαναλαμβανόμενη υπηρεσία (σφάλμα 203).
 * Η εγγραφή στέλνεται ούτως ή άλλως — απλώς χωρίς το `recurringService`.
 */
async function vatByInst(insts: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(insts)];
  if (unique.length === 0) return new Map();

  const contracts = await prisma.iNST.findMany({
    where: { INST: { in: unique } },
    select: { INST: true, TRDR: true },
  });
  const trdrs = [...new Set(contracts.map((c) => c.TRDR).filter(Boolean))] as string[];
  const customers = trdrs.length
    ? await prisma.cUSTORMER.findMany({
        where: { TRDR: { in: trdrs } },
        select: { TRDR: true, AFM: true },
      })
    : [];
  const afmByTrdr = new Map(customers.map((c) => [c.TRDR, (c.AFM ?? "").trim()]));

  const out = new Map<number, string>();
  for (const c of contracts) {
    const afm = c.TRDR ? afmByTrdr.get(c.TRDR) : "";
    // ΜΟΝΟ έγκυρα ΑΦΜ. Το ERP κρατά «999999999» για ιδιώτες, και η ΑΑΔΕ
    // απορρίπτει ΟΛΟΚΛΗΡΗ την εγγραφή με σφάλμα 202 — για ένα πεδίο που
    // είναι προαιρετικό. Η στάθμευση στέλνεται κανονικά, απλώς χωρίς
    // δήλωση επαναλαμβανόμενης υπηρεσίας.
    if (afm && isValidGreekVat(afm)) out.set(c.INST, afm);
  }
  return out;
}

function classify(
  plate: string,
  contractInst: number | null,
  exempt: Set<string>
): CustomerKind {
  // Η απαλλαγή προηγείται: ένα όχημα προσωπικού μπορεί να ανήκει και σε
  // σύμβαση, αλλά δεν χρεώνεται — και η ΑΑΔΕ θέλει τον λόγο μη χρέωσης.
  if (exempt.has(plate)) return "EXEMPT";
  return contractInst != null ? "CONTRACT" : "WALK_IN";
}

/**
 * Συγχρονίζει ό,τι έχει αλλάξει.
 *
 * Δύο πηγές: η απογραφή (οχήματα ΜΕΣΑ → άνοιγμα) και οι ολοκληρωμένες
 * σταθμεύσεις της ημέρας (→ κλείσιμο, και άνοιγμα πρώτα αν δεν προλάβαμε).
 */
export async function syncDcl(limit = 25): Promise<SyncOutcome> {
  const out: SyncOutcome = {
    opened: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    submitDisabled: !isSubmitEnabled(),
    messages: [],
  };

  const config = loadDclConfig();
  if (!config) {
    out.messages.push("Λείπουν τα διαπιστευτήρια ΑΑΔΕ (AADE_USER_ID / AADE_SUBSCRIPTION_KEY).");
    return out;
  }
  if (out.submitDisabled) {
    out.messages.push("Η αποστολή είναι κλειστή — όρισε AADE_DCL_SUBMIT_ENABLED=true.");
    return out;
  }

  const branch = Number(process.env.AADE_BRANCH ?? 0);
  const now = wallClockNow();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [inside, stays, exempt, exCat] = await Promise.all([
    prisma.parkingInventory.findMany({ orderBy: { enteredAt: "asc" } }),
    prisma.parkingStay.findMany({
      where: { exitedAt: { gte: dayStart } },
      orderBy: { exitedAt: "asc" },
    }),
    getExemptPlates(now),
    exemptCategories(),
  ]);

  const vats = await vatByInst([
    ...inside.map((i) => i.contractInst).filter((n): n is number => n != null),
    ...stays.map((s) => s.contractInst).filter((n): n is number => n != null),
  ]);

  const toStay = (
    plate: string,
    entry: Date,
    exit: Date | null,
    amount: number,
    contractInst: number | null
  ): StayForDcl => {
    const kind = classify(plate, contractInst, exempt);
    return {
      plate,
      entry,
      exit,
      amount,
      kind,
      contractInst,
      customerVatNumber: contractInst != null ? (vats.get(contractInst) ?? null) : null,
      exemptCategory: kind === "EXEMPT" ? (exCat.get(plate) ?? "Άλλο") : null,
    };
  };

  // ── 1. Οχήματα που βρίσκονται μέσα → άνοιγμα ────────────────────────────
  for (const row of inside) {
    if (out.opened + out.completed >= limit) break;
    const k = key(row.plate, row.enteredAt);
    const existing = await prisma.dclRecord.findUnique({ where: { stayKey: k } });
    if (existing) {
      out.skipped++;
      continue;
    }

    const stay = toStay(row.plate, row.enteredAt, null, 0, row.contractInst);
    const payload = buildSendClient(stay, branch, now);

    // Η γραμμή γράφεται ΠΡΙΝ την κλήση: αν το δίκτυο πέσει μετά το POST αλλά
    // πριν την απάντηση, η επόμενη εκτέλεση δεν θα ξαναστείλει στα τυφλά.
    const record = await prisma.dclRecord.create({
      data: {
        stayKey: k,
        plate: stay.plate,
        enteredAt: stay.entry,
        kind: stay.kind,
        amount: 0,
        contractInst: stay.contractInst,
        status: "DRAFT",
        sentPayload: payload as unknown as object,
      },
    });

    const res = await sendClient(config, payload);
    if (res.ok) {
      await prisma.dclRecord.update({
        where: { id: record.id },
        data: { status: "SENT", idDcl: BigInt(res.id), error: null },
      });
      out.opened++;
    } else {
      await prisma.dclRecord.update({
        where: { id: record.id },
        data: { status: "FAILED", error: `${res.code}: ${res.message}` },
      });
      out.failed++;
      out.messages.push(`${stay.plate}: ${res.code} — ${res.message}`);
    }
  }

  // ── 2. Ολοκληρωμένες σταθμεύσεις → κλείσιμο ─────────────────────────────
  for (const s of stays) {
    if (out.opened + out.completed >= limit) break;
    const k = key(s.plate, s.enteredAt);
    let record = await prisma.dclRecord.findUnique({ where: { stayKey: k } });
    const stay = toStay(s.plate, s.enteredAt, s.exitedAt, s.amount ?? 0, s.contractInst);

    // Βγήκε πριν προλάβουμε να ανοίξουμε: άνοιγμα και κλείσιμο μαζί.
    if (!record) {
      const payload = buildSendClient(stay, branch, now);
      record = await prisma.dclRecord.create({
        data: {
          stayKey: k,
          plate: stay.plate,
          enteredAt: stay.entry,
          exitedAt: stay.exit,
          kind: stay.kind,
          amount: stay.amount,
          contractInst: stay.contractInst,
          status: "DRAFT",
          sentPayload: payload as unknown as object,
        },
      });
      const res = await sendClient(config, payload);
      if (!res.ok) {
        await prisma.dclRecord.update({
          where: { id: record.id },
          data: { status: "FAILED", error: `${res.code}: ${res.message}` },
        });
        out.failed++;
        out.messages.push(`${stay.plate}: ${res.code} — ${res.message}`);
        continue;
      }
      await prisma.dclRecord.update({
        where: { id: record.id },
        data: { status: "SENT", idDcl: BigInt(res.id) },
      });
      record = await prisma.dclRecord.findUnique({ where: { id: record.id } });
    }

    if (!record || record.status !== "SENT" || record.idDcl == null) {
      out.skipped++;
      continue;
    }

    const close = buildUpdateClient(stay, Number(record.idDcl));
    const res = await updateClient(config, close);
    if (res.ok) {
      await prisma.dclRecord.update({
        where: { id: record.id },
        data: {
          status: "COMPLETED",
          updateId: BigInt(res.id),
          exitedAt: stay.exit,
          amount: stay.amount,
          error: null,
        },
      });
      out.completed++;
    } else {
      await prisma.dclRecord.update({
        where: { id: record.id },
        data: { error: `${res.code}: ${res.message}` },
      });
      out.failed++;
      out.messages.push(
        `${stay.plate} (${formatWallClock(stay.entry)}): ${res.code} — ${res.message}`
      );
    }
  }

  return out;
}
