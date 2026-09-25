/**
 * Εικόνα εσόδων: τι συμβαίνει τώρα, τι αναμένεται, τι εισπράχθηκε.
 *
 * ΔΥΟ ΝΟΥΜΕΡΑ ΠΟΥ ΔΕΝ ΑΘΡΟΙΖΟΝΤΑΙ
 * Οι συμβάσεις είναι ΜΗΝΙΑΙΑ υποχρέωση· το ταμείο είναι ΗΜΕΡΗΣΙΑ είσπραξη.
 * Προστιθέμενα βγάζουν νούμερο που δεν αντιστοιχεί σε τίποτα πραγματικό —
 * ούτε σε τζίρο ημέρας, ούτε σε τζίρο μήνα. Μένουν χωριστά.
 *
 * ΓΙΑΤΙ ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ «ΠΡΟΣΔΟΚΩΜΕΝΟ» ΑΠΟ ΤΙΣ ΣΥΜΒΑΣΕΙΣ
 * Οι γραμμές των συμβάσεων στο ERP ΔΕΝ έχουν τιμή — ελέγχθηκε, και οι 57
 * ενεργές έχουν μηδενική αξία γραμμών. Άρα το μόνο πραγματικό νούμερο είναι
 * τα παραστατικά που κόπηκαν. Ό,τι άλλο θα ήταν εικασία παρουσιασμένη ως
 * δεδομένο.
 *
 * ΠΩΣ ΚΑΛΥΠΤΕΤΑΙ ΜΙΑ ΣΥΜΒΑΣΗ
 * Δεν τιμολογούνται όλες με ΤΠΥ. Οι εταιρείες παίρνουν ΤΠΥ, οι ιδιώτες
 * συνήθως ΑΛΠ με χειρόγραφη απόδειξη είσπραξης. Και οι δύο είναι έγκυρη
 * κάλυψη· το πρόβλημα είναι μόνο η σύμβαση ΧΩΡΙΣ κανένα παραστατικό.
 */

import { prisma } from "@/lib/prisma";
import { findStayPhotos } from "@/lib/pass-photo";
import { activeContractWhere } from "@/lib/contract-active";
import { wallClockNow } from "@/lib/parking-time";
import { getExemptPlates } from "@/lib/exempt-plates";
import { authenticateSoftOneAPI, getSoftOneTableData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";

/** Οι σειρές παραστατικών που μας αφορούν. Βλ. `daily-revenue.ts`. */
const SERIES = { TPY: "7067", ALP: "7071", XAE: "3820", EM: "3801" } as const;

export type Coverage = "ΤΠΥ" | "ΑΛΠ" | "ΜΙΚΤΟ" | "ΚΑΝΕΝΑ";

export type RevenueOverview = {
  /** Τώρα στον χώρο. */
  inside: { total: number; contract: number; walkIn: number; exempt: number };
  /**
   * Πόσα οχήματα συμβάσεων αναμένονται ακόμα.
   *
   * Μετριέται σε ΘΕΣΕΙΣ, όχι σε πινακίδες: κάθε θέση δέχεται έως τρεις
   * δηλωμένες πινακίδες αλλά μόνο ένα αυτοκίνητο τη φορά. Μετρώντας
   * πινακίδες, το νούμερο βγαίνει τριπλάσιο από τα οχήματα που μπορούν να
   * έρθουν, και δεν σημαίνει τίποτα.
   */
  expected: { slots: number; occupied: number; free: number };
  /** Ταμείο ημέρας — μόνο ό,τι εισπράττεται στην έξοδο. */
  today: {
    ourCharges: number;
    walkInStays: number;
    alp: { count: number; total: number };
    collections: number;
    /** Η ανάλυση της διαφοράς — ποια στάση και ποιο παραστατικό την κάνουν. */
    breakdown: {
      stays: TillStay[];
      docs: TillDoc[];
    };
  };
  /** Συμβάσεις μήνα — μηνιαία υποχρέωση, ξεχωριστά από το ταμείο. */
  month: {
    label: string;
    activeContracts: number;
    tpy: { count: number; total: number };
    byCoverage: Record<Coverage, number>;
    /** Συμβάσεις χωρίς κανένα παραστατικό — το μόνο πραγματικό εύρημα. */
    uncovered: { inst: number; name: string }[];
  };
  error?: string;
};

type Doc = { series: string; amount: number; trdr: string; code?: string };

/** Μια στάση απλού πελάτη που έκλεισε σήμερα, με ό,τι χρειάζεται για έλεγχο. */
export type TillStay = {
  plate: string;
  enteredAt: Date;
  exitedAt: Date;
  minutes: number;
  amount: number;
  /** Ο κωδικός του παραστατικού που ταίριαξε, αν βρέθηκε. */
  matched: string | null;
  photoIn: string | null;
  photoOut: string | null;
};

/** Ένα ΑΛΠ της ημέρας. */
export type TillDoc = {
  code: string;
  amount: number;
  /** Η πινακίδα της στάσης που ταίριαξε, αν βρέθηκε. */
  matched: string | null;
};

async function fetchMonthDocs(from: Date): Promise<Doc[]> {
  const company = Number(process.env.PARKING_COMPANY ?? 1002);
  const connection = await prisma.softOneConnection.findFirst({ where: { company } });
  if (!connection) throw new Error(`Δεν υπάρχει σύνδεση SoftOne για την εταιρία ${company}.`);

  const auth = await authenticateSoftOneAPI(
    connection.username,
    decrypt(connection.passwordEnc),
    String(connection.appId),
    String(connection.company),
    String(connection.branch),
    String(connection.module),
    String(connection.refid),
    undefined,
    connection.registeredName
  );
  if (!auth.success || !auth.clientID) throw new Error(auth.error || "Αποτυχία ταυτοποίησης SoftOne.");

  const iso = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const fields = "FINDOC,TRNDATE,SUMAMNT,SERIES,TRDR,FINCODE";
  const res = await getSoftOneTableData(
    "FINDOC",
    fields,
    auth.clientID,
    connection.appId,
    `COMPANY=${company} AND TRNDATE>='${iso}'`
  );
  if (!res.success || !res.data) throw new Error(res.error || "Δεν διαβάστηκαν παραστατικά.");

  const cols = fields.split(",");
  return (res.data as unknown[][])
    .map((row) => Object.fromEntries(cols.map((k, i) => [k, row[i]])) as Record<string, unknown>)
    .map((o) => ({
      series: String(o.SERIES),
      amount: Number(o.SUMAMNT) || 0,
      trdr: String(o.TRDR ?? ""),
      date: String(o.TRNDATE ?? ""),
      code: String(o.FINCODE ?? ""),
    }))
    .filter((d) => d.amount > 0) as Doc[];
}

const MONTHS = [
  "Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος",
  "Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος",
];

export async function buildRevenueOverview(): Promise<RevenueOverview> {
  const now = wallClockNow();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [inventory, stays, exempt, contracts] = await Promise.all([
    prisma.parkingInventory.findMany(),
    prisma.parkingStay.findMany({ where: { exitedAt: { gte: dayStart } } }),
    getExemptPlates(now),
    prisma.iNST.findMany({
      where: { ...activeContractWhere(), lines: { some: {} } },
      select: { INST: true, NAME: true, TRDR: true, NUM01: true },
    }),
  ]);

  // ── Τώρα στον χώρο ──────────────────────────────────────────────────────
  const inside = { total: inventory.length, contract: 0, walkIn: 0, exempt: 0 };
  for (const i of inventory) {
    if (exempt.has(i.plate)) inside.exempt++;
    else if (i.contractInst != null) inside.contract++;
    else inside.walkIn++;
  }

  // ── Αναμένονται ────────────────────────────────────────────────────────
  const totalSlots = contracts.reduce(
    (sum, c) => sum + (c.NUM01 != null ? Number(c.NUM01) : 1),
    0
  );
  const free = Math.max(0, totalSlots - inside.contract);

  // ── Ταμείο ημέρας ──────────────────────────────────────────────────────
  // ΜΟΝΟ οι απλοί πελάτες: οι συμβασιούχοι δεν πληρώνουν στην έξοδο, και οι
  // απαλλαγές δεν πληρώνουν καθόλου. Αθροίζοντάς τους, το «ταμείο» θα
  // περιλάμβανε χρήματα που δεν εισπράχθηκαν ποτέ.
  const walkInStays = stays.filter(
    (s) => s.contractInst == null && !exempt.has(s.plate)
  );
  const ourCharges = walkInStays.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  const out: RevenueOverview = {
    inside,
    expected: { slots: totalSlots, occupied: inside.contract, free },
    today: {
      ourCharges,
      walkInStays: walkInStays.length,
      alp: { count: 0, total: 0 },
      collections: 0,
      breakdown: { stays: [], docs: [] },
    },
    month: {
      label: `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
      activeContracts: contracts.length,
      tpy: { count: 0, total: 0 },
      byCoverage: { ΤΠΥ: 0, ΑΛΠ: 0, ΜΙΚΤΟ: 0, ΚΑΝΕΝΑ: 0 },
      uncovered: [],
    },
  };

  let docs: (Doc & { date?: string })[];
  try {
    docs = await fetchMonthDocs(monthStart);
  } catch (e) {
    out.error = e instanceof Error ? e.message : "Τα παραστατικά δεν διαβάστηκαν.";
    return out;
  }

  const todayIso = `${dayStart.getUTCFullYear()}-${String(dayStart.getUTCMonth() + 1).padStart(2, "0")}-${String(dayStart.getUTCDate()).padStart(2, "0")}`;
  for (const d of docs) {
    const isToday = String(d.date ?? "").startsWith(todayIso);
    if (d.series === SERIES.ALP) {
      if (isToday) {
        out.today.alp.count++;
        out.today.alp.total += d.amount;
      }
    } else if (d.series === SERIES.TPY) {
      out.month.tpy.count++;
      out.month.tpy.total += d.amount;
    }
    if (isToday && (d.series === SERIES.EM || d.series === SERIES.XAE)) {
      out.today.collections += d.amount;
    }
  }

  // ── Η ανάλυση της διαφοράς ─────────────────────────────────────────────
  //
  // Το σύνολο δεν εξηγεί τίποτα: «λείπουν 7,50 €» μπορεί να είναι μια στάση
  // που δεν τιμολογήθηκε ή μια που τιμολογήθηκε με άλλο ποσό. Ταιριάζουμε
  // στάσεις με παραστατικά ΣΤΟ ΠΟΣΟ — τα ΑΛΠ πάνε όλα στον ίδιο γενικό
  // πελάτη, οπότε δεν υπάρχει πινακίδα να συγκρίνουμε. Ό,τι μείνει
  // αταίριαστο στις δύο στήλες είναι ακριβώς η διαφορά.
  const todayDocs = docs.filter(
    (d) => d.series === SERIES.ALP && String(d.date ?? "").startsWith(todayIso)
  );
  const docsLeft = todayDocs.map((d, i) => ({
    key: i,
    code: d.code || `ΑΛΠ #${i + 1}`,
    amount: d.amount,
    matched: null as string | null,
  }));

  const tillStays: TillStay[] = [];
  for (const s of walkInStays) {
    if (!s.exitedAt) continue;
    const amount = s.amount ?? 0;
    const hit = docsLeft.find((d) => d.matched === null && Math.abs(d.amount - amount) < 0.01);
    if (hit) hit.matched = s.plate;

    const photos = await findStayPhotos(s.plate, s.enteredAt, s.exitedAt);
    tillStays.push({
      plate: s.plate,
      enteredAt: s.enteredAt,
      exitedAt: s.exitedAt,
      minutes: Math.round((s.exitedAt.getTime() - s.enteredAt.getTime()) / 60_000),
      amount,
      matched: hit?.code ?? null,
      photoIn: photos.in?.url ?? null,
      photoOut: photos.out?.url ?? null,
    });
  }

  out.today.breakdown = {
    stays: tillStays.sort((a, b) => b.exitedAt.getTime() - a.exitedAt.getTime()),
    docs: docsLeft.map((d) => ({ code: d.code, amount: d.amount, matched: d.matched })),
  };

  // ── Κάλυψη ανά σύμβαση ─────────────────────────────────────────────────
  const seriesByTrdr = new Map<string, Set<string>>();
  for (const d of docs) {
    if (!d.trdr) continue;
    if (!seriesByTrdr.has(d.trdr)) seriesByTrdr.set(d.trdr, new Set());
    seriesByTrdr.get(d.trdr)!.add(d.series);
  }

  for (const c of contracts) {
    const s = c.TRDR ? seriesByTrdr.get(String(c.TRDR)) : undefined;
    const hasTpy = s?.has(SERIES.TPY) ?? false;
    const hasAlp = s?.has(SERIES.ALP) ?? false;
    const coverage: Coverage =
      hasTpy && hasAlp ? "ΜΙΚΤΟ" : hasTpy ? "ΤΠΥ" : hasAlp ? "ΑΛΠ" : "ΚΑΝΕΝΑ";
    out.month.byCoverage[coverage]++;
    if (coverage === "ΚΑΝΕΝΑ") {
      out.month.uncovered.push({ inst: c.INST, name: (c.NAME ?? "—").trim() });
    }
  }

  return out;
}
