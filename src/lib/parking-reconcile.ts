/**
 * Αντιπαραβολή δικού μας ψηφιακού πελατολογίου με το SoftOne — ΜΟΝΟ ΑΝΑΓΝΩΣΗ.
 *
 * Το ERP κρατά κάθε στάθμευση ως εγγραφή `SOACTION` με τα πεδία του ψηφιακού
 * πελατολογίου της ΑΑΔΕ (`cccDC*`). Εμείς φτιάχνουμε την ίδια εικόνα από τις
 * κάμερες. Εδώ ζευγαρώνονται οι δύο εικόνες ανά πινακίδα και αναδεικνύονται οι
 * διαφορές: ώρες, ποσά, και εγγραφές που λείπουν από τη μία πλευρά.
 *
 * Δεν καλείται ποτέ `setData`. Η εφαρμογή δεν γράφει στο ERP.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { authenticateSoftOneAPI, getSoftOneTableData } from "@/lib/softone-api";
import { getParkingSessions, type ParkingSession } from "@/lib/parking-sessions";
import { FREE_MINUTES } from "@/lib/parking-tariff";
import { formatWallClock, isReadablePlate, parseErpWallClock, wallClockNow } from "@/lib/parking-time";

/** Μια εγγραφή του ψηφιακού πελατολογίου, όπως τη δίνει το ERP. */
export type ErpStay = {
  soaction: number;
  plate: string;
  entry: Date | null;
  exit: Date | null;
  inst: number | null;
  amount: number;
  /** Το FINDOC της ΑΠΥ που εκδόθηκε, 0 αν δεν εκδόθηκε. */
  invoiceFindoc: number;
};

export type MatchStatus =
  | "MATCH"
  | "AMOUNT_DIFF"
  | "TIME_DIFF"
  /** Η μία πλευρά έχει καταγράψει έξοδο και η άλλη όχι. */
  | "EXIT_DIFF"
  | "MISSING_IN_ERP"
  | "MISSING_IN_CAMERAS";

export type ReconRow = {
  plate: string;
  ours: ParkingSession | null;
  erp: ErpStay | null;
  status: MatchStatus;
  /** Διαφορά εισόδου/εξόδου σε λεπτά (εμείς − ERP). */
  entryDriftMinutes: number | null;
  exitDriftMinutes: number | null;
  /**
   * Πόση ώρα εκκρεμεί η ασυμφωνία. `null` όταν δεν πρόκειται για εκκρεμότητα
   * (π.χ. διαφορά ποσού σε κλεισμένη και από τις δύο πλευρές στάθμευση).
   */
  pendingMinutes: number | null;
  /** Εκκρεμεί λιγότερο από το όριο ανοχής — πιθανή καθυστέρηση, όχι πρόβλημα. */
  isRecent: boolean;
  ourAmount: number | null;
  erpAmount: number | null;
  /** Γιατί χαρακτηρίστηκε έτσι — μπαίνει αυτούσιο στο email απόκλισης. */
  explanation: string;
};

/** Πόσα λεπτά διαφορά ανεχόμαστε πριν το θεωρήσουμε απόκλιση ώρας. */
const TIME_TOLERANCE_MIN = 10;
/**
 * Πόση ώρα επιτρέπεται να εκκρεμεί μια ασυμφωνία πριν μετρήσει ως απόκλιση.
 *
 * Ο υπάλληλος στην μπάρα δεν καταχωρεί την ίδια στιγμή που περνά το όχημα·
 * ένα καθυστερημένο κλείσιμο δεκαπέντε λεπτών είναι φυσιολογική ροή εργασίας.
 * Μετά από αυτό, η εγγραφή μάλλον ξεχάστηκε. Χωρίς αυτό το όριο η παρακολούθηση
 * θα γέμιζε με ασυμφωνίες που λύνονται μόνες τους σε λίγα λεπτά.
 */
export const PENDING_TOLERANCE_MIN = 15;
/** Παράθυρο για να θεωρηθεί ότι δύο εγγραφές αφορούν την ίδια στάθμευση. */
const PAIRING_WINDOW_MIN = 180;

const SOACTION_FIELDS =
  "SOACTION,FROMDATE,FINALDATE,INST,GVAL,NUM01,cccDCVehicleRegNum";



/** Διαβάζει το ψηφιακό πελατολόγιο του ERP για μια περίοδο. */
export async function fetchErpStays(from: Date, to: Date): Promise<ErpStay[]> {
  // Το parking είναι η εταιρία 1002 (ΑΦΟΙ Ι ΚΟΛΛΕΡΗ ΕΚΜΕΤΑΛΛΕΥΣΗ ΧΩΡΟΥ
  // ΣΤΑΘΜΕΥΣΗΣ ΕΠΕ). Η 1001 είναι άλλη εταιρία του ομίλου και ΔΕΝ έχει το
  // ψηφιακό πελατολόγιο — αν πέσουμε σε αυτήν, η αντιπαραβολή βγαίνει κενή.
  const company = Number(process.env.PARKING_COMPANY ?? 1002);
  const connection =
    (await prisma.softOneConnection.findFirst({ where: { company } })) ??
    (await prisma.softOneConnection.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!connection) throw new Error("Δεν υπάρχει αποθηκευμένη σύνδεση SoftOne.");
  if (connection.company !== company) {
    throw new Error(
      `Δεν βρέθηκε σύνδεση SoftOne για την εταιρία ${company} του parking (βρέθηκε μόνο ${connection.company}).`
    );
  }

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
  if (!auth.success || !auth.clientID) {
    throw new Error(auth.error || "Αποτυχία ταυτοποίησης με το SoftOne.");
  }

  const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  const result = await getSoftOneTableData(
    "SOACTION",
    SOACTION_FIELDS,
    auth.clientID,
    connection.appId,
    `COMPANY=${connection.company} AND FROMDATE>='${iso(from)}' AND FROMDATE<='${iso(to)}'`
  );
  if (!result.success || !result.data) {
    throw new Error(result.error || "Αποτυχία ανάγνωσης SOACTION.");
  }

  const cols = SOACTION_FIELDS.split(",");
  return result.data
    .map((row: unknown[]) => {
      const r = Object.fromEntries(cols.map((c, i) => [c, row[i]])) as Record<string, string>;
      return {
        soaction: Number(r.SOACTION) || 0,
        plate: (r.cccDCVehicleRegNum || "").trim().toUpperCase(),
        entry: parseErpWallClock(r.FROMDATE),
        exit: parseErpWallClock(r.FINALDATE),
        inst: Number(r.INST) > 0 ? Number(r.INST) : null,
        amount: Number(r.GVAL) || 0,
        invoiceFindoc: Number(r.NUM01) || 0,
      };
    })
    .filter((s) => isReadablePlate(s.plate));
}

/**
 * Οι ΑΝΟΙΧΤΕΣ εγγραφές του ψηφιακού πελατολογίου, ανεξάρτητα από την περίοδο
 * που κοιτάει ο χρήστης.
 *
 * Το βιβλίο πόρτας ΔΕΝ πρέπει να περιορίζεται από το φίλτρο ημερών: ένα όχημα
 * μπορεί να είναι μέσα από πριν δύο εβδομάδες, και με παράθυρο τριών ημερών θα
 * φαινόταν ψευδώς ότι «λείπει από το ERP».
 */
export async function fetchOpenErpStays(lookbackDays = 30): Promise<ErpStay[]> {
  const now = wallClockNow();
  const from = new Date(now.getTime() - lookbackDays * 24 * 3600 * 1000);
  const stays = await fetchErpStays(from, now);
  return stays.filter((s) => s.exit === null && s.entry !== null);
}

const driftMin = (a: Date | null, b: Date | null) =>
  a && b ? Math.round((a.getTime() - b.getTime()) / 60000) : null;

/**
 * Ζευγαρώνει τις δύο εικόνες ανά πινακίδα, επιλέγοντας για κάθε δική μας στάση
 * την πλησιέστερη χρονικά εγγραφή του ERP μέσα στο παράθυρο ζευγαρώματος.
 */
export function reconcile(
  ours: ParkingSession[],
  erp: ErpStay[],
  now: Date = wallClockNow()
): ReconRow[] {
  const erpByPlate = new Map<string, ErpStay[]>();
  for (const s of erp) {
    if (!erpByPlate.has(s.plate)) erpByPlate.set(s.plate, []);
    erpByPlate.get(s.plate)!.push(s);
  }

  const usedErp = new Set<number>();
  const rows: ReconRow[] = [];

  for (const session of ours) {
    // Τα περάσματα δεν υπάρχουν στο ψηφιακό πελατολόγιο — δεν είναι αποκλίσεις.
    if (session.passThrough) continue;
    const candidates = (erpByPlate.get(session.plate) ?? []).filter(
      (c) => !usedErp.has(c.soaction) && c.entry
    );
    let best: ErpStay | null = null;
    let bestDrift = Infinity;
    for (const c of candidates) {
      const drift = Math.abs((c.entry!.getTime() - session.entry.getTime()) / 60000);
      if (drift < bestDrift && drift <= PAIRING_WINDOW_MIN) {
        best = c;
        bestDrift = drift;
      }
    }
    if (best) usedErp.add(best.soaction);
    rows.push(classify(session, best, now));
  }

  for (const stay of erp) {
    if (usedErp.has(stay.soaction)) continue;
    rows.push(classify(null, stay, now));
  }

  const rank: Record<MatchStatus, number> = {
    AMOUNT_DIFF: 0,
    EXIT_DIFF: 1,
    MISSING_IN_ERP: 2,
    MISSING_IN_CAMERAS: 3,
    TIME_DIFF: 4,
    MATCH: 5,
  };
  rows.sort((a, b) => {
    const r = rank[a.status] - rank[b.status];
    if (r !== 0) return r;
    const ta = a.ours?.entry ?? a.erp?.entry ?? new Date(0);
    const tb = b.ours?.entry ?? b.erp?.entry ?? new Date(0);
    return tb.getTime() - ta.getTime();
  });
  return rows;
}

function classify(
  ours: ParkingSession | null,
  erp: ErpStay | null,
  now: Date
): ReconRow {
  const plate = ours?.plate ?? erp?.plate ?? "";
  const ourAmount = ours?.charge ? ours.charge.amount : null;
  const erpAmount = erp ? erp.amount : null;
  const entryDrift = ours && erp ? driftMin(ours.entry, erp.entry) : null;
  const exitDrift = ours && erp ? driftMin(ours.exit, erp.exit) : null;

  // Από πότε εκκρεμεί η ασυμφωνία: από τη στιγμή που η μία πλευρά κατέγραψε
  // κάτι που η άλλη δεν έχει ακόμα.
  const pendingSince =
    ours && erp
      ? ours.exit && !erp.exit
        ? ours.exit // εμείς είδαμε έξοδο, το ERP δεν έκλεισε
        : !ours.exit && erp.exit
          ? erp.exit
          : null
      : ours
        ? (ours.exit ?? ours.entry) // δεν υπάρχει καθόλου στο ERP
        : (erp!.exit ?? erp!.entry); // δεν το είδαν οι κάμερες
  const pendingMinutes = pendingSince
    ? Math.max(0, Math.round((now.getTime() - pendingSince.getTime()) / 60000))
    : null;
  const isRecent = pendingMinutes !== null && pendingMinutes < PENDING_TOLERANCE_MIN;

  const base = {
    plate,
    ours,
    erp,
    entryDriftMinutes: entryDrift,
    exitDriftMinutes: exitDrift,
    ourAmount,
    erpAmount,
    pendingMinutes,
    isRecent,
  };

  if (!erp) {
    // ΣΥΝΤΟΜΗ ΣΤΑΣΗ ΕΝΤΟΣ ΔΩΡΕΑΝ ΧΡΟΝΟΥ.
    //
    // Δεν χρεώνεται, και στην πράξη δεν καταγράφεται ούτε στο ψηφιακό
    // πελατολόγιο. Η απουσία της από το ERP είναι το αναμενόμενο, όχι
    // απόκλιση — αλλιώς κάθε σύντομη στάση θα εμφανιζόταν ως διαφυγών τζίρος.
    if (
      ours!.exit &&
      ours!.durationMinutes !== null &&
      ours!.durationMinutes <= FREE_MINUTES
    ) {
      return {
        ...base,
        status: "MATCH",
        explanation: `Σύντομη στάση ${ours!.durationMinutes}′ — εντός δωρεάν χρόνου ${FREE_MINUTES}′, δεν χρεώνεται ούτε καταγράφεται.`,
      };
    }

    // ΑΠΑΛΛΑΓΜΕΝΗ ΠΙΝΑΚΙΔΑ. Δεν χρεώνεται, και στην πράξη δεν καταγράφεται
    // στο ψηφιακό πελατολόγιο. Η απουσία της είναι το αναμενόμενο.
    if (ours!.isExempt) {
      return {
        ...base,
        status: "MATCH",
        explanation: "Απαλλαγμένη πινακίδα — δεν χρεώνεται ούτε καταγράφεται στο ψηφιακό πελατολόγιο.",
      };
    }

    return {
      ...base,
      status: "MISSING_IN_ERP",
      explanation: ours!.orphanExit
        ? `Η κάμερα κατέγραψε ΕΞΟΔΟ στις ${fmt(ours!.entry)} χωρίς προηγούμενη είσοδο — ούτε το ψηφιακό πελατολόγιο έχει εγγραφή.`
        : ours!.missingExit
          ? `Η κάμερα είδε νέα είσοδο στις ${fmt(ours!.entry)} ενώ η προηγούμενη στάθμευση δεν είχε κλείσει — χάθηκε έξοδος.`
          : ours!.exit
            ? `Η κάμερα κατέγραψε στάθμευση ${fmt(ours!.entry)} → ${fmt(ours!.exit)} αλλά δεν υπάρχει αντίστοιχη εγγραφή στο ψηφιακό πελατολόγιο.`
            : `Η κάμερα δείχνει το όχημα μέσα από ${fmt(ours!.entry)} χωρίς εγγραφή στο ψηφιακό πελατολόγιο.`,
    };
  }
  if (!ours) {
    return {
      ...base,
      status: "MISSING_IN_CAMERAS",
      explanation: `Το ψηφιακό πελατολόγιο έχει εγγραφή #${erp.soaction} (${fmt(erp.entry)} → ${erp.exit ? fmt(erp.exit) : "ανοιχτή"}) που δεν εντοπίστηκε από τις κάμερες.`,
    };
  }

  if (ourAmount != null && erpAmount != null && Math.abs(ourAmount - erpAmount) >= 0.005) {
    // Απαλλαγμένη που χρεώθηκε: η απόκλιση είναι στο ERP, όχι σε εμάς.
    if (ours.isExempt && erpAmount > 0) {
      return {
        ...base,
        status: "AMOUNT_DIFF",
        explanation:
          `Η ${plate} είναι καταχωρημένη ως απαλλαγμένη αλλά χρεώθηκε ${erpAmount} € ` +
          `στην εγγραφή #${erp.soaction}. Πιθανή λανθασμένη χρέωση.`,
      };
    }

    return {
      ...base,
      status: "AMOUNT_DIFF",
      explanation:
        `Διαφορά ποσού: εμείς ${ourAmount} € έναντι ${erpAmount} € στο ERP. ` +
        `Δική μας διάρκεια ${ours.durationMinutes} λεπτά (${fmt(ours.entry)} → ${ours.exit ? fmt(ours.exit) : "—"}), ` +
        `ERP ${fmt(erp.entry)} → ${erp.exit ? fmt(erp.exit) : "—"}` +
        (erp.inst ? ` · καλύπτεται από τη σύμβαση ${erp.inst} στο ERP` : "") +
        (ours.contractInst ? ` · καλύπτεται από την ενεργή σύμβαση ${ours.contractInst} σε εμάς` : ""),
    };
  }

  // ΕΞΟΔΟΙ — ελέγχονται ΠΡΙΝ τις ώρες.
  //
  // Το `exitDrift` είναι null όταν λείπει η έξοδος από τη ΜΙΑ πλευρά, οπότε ο
  // έλεγχος ώρας δεν έπιανε τίποτα: όχημα που οι κάμερες το είδαν να φεύγει
  // ενώ το ERP το είχε ακόμα ανοιχτό εμφανιζόταν ως «ταυτίζεται». Αυτή είναι
  // από τις σημαντικότερες αποκλίσεις — σημαίνει στάθμευση που δεν έκλεισε
  // ποτέ στο βιβλίο, άρα και τιμολόγηση που δεν έγινε.
  const weHaveExit = ours.exit != null;
  const erpHasExit = erp.exit != null;
  if (weHaveExit !== erpHasExit) {
    return {
      ...base,
      status: "EXIT_DIFF",
      explanation: weHaveExit
        ? `Η κάμερα κατέγραψε έξοδο στις ${fmt(ours.exit)} αλλά η εγγραφή #${erp.soaction} παραμένει ΑΝΟΙΧΤΗ στο ψηφιακό πελατολόγιο` +
          (ourAmount ? ` · μη τιμολογημένη χρέωση ${ourAmount} €` : " · χωρίς χρέωση (σύμβαση)") +
          "."
        : `Το ψηφιακό πελατολόγιο έκλεισε τη στάθμευση στις ${fmt(erp.exit)} αλλά οι κάμερες δεν είδαν ποτέ το όχημα να φεύγει.`,
    };
  }

  const drifted =
    (entryDrift != null && Math.abs(entryDrift) > TIME_TOLERANCE_MIN) ||
    (exitDrift != null && Math.abs(exitDrift) > TIME_TOLERANCE_MIN);
  if (drifted) {
    return {
      ...base,
      status: "TIME_DIFF",
      explanation:
        `Ίδιο ποσό αλλά διαφορετικές ώρες: είσοδος ${signed(entryDrift)}, έξοδος ${signed(exitDrift)} σε σχέση με το ERP.`,
    };
  }

  return { ...base, status: "MATCH", explanation: "Ταυτίζεται με το ψηφιακό πελατολόγιο." };
}

const fmt = formatWallClock;

const signed = (m: number | null) =>
  m == null ? "άγνωστη" : m === 0 ? "ίδια" : `${m > 0 ? "+" : ""}${m} λεπτά`;

export type ReconSummary = {
  total: number;
  match: number;
  amountDiff: number;
  timeDiff: number;
  exitDiff: number;
  missingInErp: number;
  missingInCameras: number;
  /** Ασυμφωνίες κάτω από το όριο ανοχής — δεν μετρούν ως αποκλίσεις. */
  recent: number;
  /** Συνολική διαφορά τζίρου (δικά μας ποσά − ποσά ERP). */
  amountDelta: number;
};

export function summarize(rows: ReconRow[]): ReconSummary {
  const s: ReconSummary = {
    total: rows.length,
    match: 0,
    amountDiff: 0,
    timeDiff: 0,
    exitDiff: 0,
    missingInErp: 0,
    missingInCameras: 0,
    recent: 0,
    amountDelta: 0,
  };
  for (const r of rows) {
    if (r.status !== "MATCH" && r.isRecent) s.recent++;
    if (r.status === "MATCH") s.match++;
    else if (r.status === "AMOUNT_DIFF") s.amountDiff++;
    else if (r.status === "TIME_DIFF") s.timeDiff++;
    else if (r.status === "EXIT_DIFF") s.exitDiff++;
    else if (r.status === "MISSING_IN_ERP") s.missingInErp++;
    else s.missingInCameras++;
    s.amountDelta += (r.ourAmount ?? 0) - (r.erpAmount ?? 0);
  }
  s.amountDelta = Math.round(s.amountDelta * 100) / 100;
  return s;
}

/** Το πλήρες αποτέλεσμα για μια περίοδο — μία κλήση για σελίδα, dashboard, email. */
export async function reconcilePeriod(from: Date, to: Date) {
  const [ours, erp] = await Promise.all([
    getParkingSessions(from, to),
    fetchErpStays(from, to),
  ]);
  const rows = reconcile(ours, erp);
  return { rows, summary: summarize(rows), from, to };
}
