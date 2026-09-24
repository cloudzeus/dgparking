/**
 * Τα παραστατικά και οι εισπράξεις της ημέρας, από το ERP.
 *
 * ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΝΑ ΑΘΡΟΙΣΟΥΜΕ Ο,ΤΙ ΕΧΕΙ ΠΟΣΟ
 * Ο πίνακας `FINDOC` κρατά ΟΛΑ τα παραστατικά μαζί — πωλήσεις, εισπράξεις,
 * ακόμα και εμβάσματα προς προμηθευτές. Ένα αφελές άθροισμα όσων έχουν
 * `SUMAMNT > 0` θα έβγαζε δύο λάθη ταυτόχρονα:
 *
 * 1. ΔΙΠΛΟΜΕΤΡΗΣΗ. Κάθε ΑΛΠ γεννά αυτόματα και μια «Είσπραξη Μετρητών (από
 *    Τιμολόγηση)» με ΤΟ ΙΔΙΟ ποσό και τον ίδιο κωδικό. Είναι η είσπραξη του
 *    ίδιου παραστατικού, όχι δεύτερο έσοδο.
 * 2. ΑΝΤΙΣΤΡΟΦΗ ΦΟΡΑ. Το «Έμβασμα σε προμηθευτή» είναι χρήματα που ΦΕΥΓΟΥΝ.
 *    Στα δεδομένα μιας τυχαίας ημέρας ήταν 1.500 € — θα εμφανιζόταν ως η
 *    μεγαλύτερη «είσπραξη» της ημέρας.
 *
 * Γι' αυτό οι σειρές αναγνωρίζονται ΡΗΤΑ, με τον κωδικό τους στο ERP.
 */

import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI, getSoftOneTableData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";

/**
 * Οι σειρές που μας αφορούν, με το όνομα που έχουν στο SoftOne.
 *
 * `income`  = παραστατικό εσόδου (τι τιμολογήθηκε)
 * `credit`  = πιστωτικό — ΑΦΑΙΡΕΙΤΑΙ από τα έσοδα
 * `collect` = είσπραξη (τι μπήκε στο ταμείο)
 *
 * Το ΤΠΥ είναι η σειρά 7067. Ο αριθμός 7167 που κυκλοφορεί αλλού στον κώδικα
 * είναι FPRMS και ΟΧΙ σειρά — τα δύο πεδία έχουν ανεξάρτητη αρίθμηση στο
 * `FINDOC`, και η σύγχυσή τους έκρυβε ολόκληρα τα τιμολόγια συμβάσεων
 * (43 παραστατικά, 18.642 € μέσα σε έναν μήνα).
 *
 * Μια ΑΛΠ είναι έσοδο· η «ΕΜ» που τη συνοδεύει είναι η είσπραξή της. Τα δύο
 * μετριούνται χωριστά και ΔΕΝ προστίθενται μεταξύ τους.
 */
const SERIES = {
  7067: { code: "ΤΠΥ", label: "Τιμολόγιο Παροχής Υπηρεσιών", kind: "income" },
  7267: { code: "ΤΚΟΙΝ", label: "Τιμολόγιο Παροχής Υπηρεσιών — κοινόχρηστα", kind: "income" },
  7071: { code: "ΑΛΠ", label: "Απόδειξη Παροχής Υπηρεσιών", kind: "income" },
  7163: { code: "ΠΙΣ", label: "Πιστωτικό Τιμολόγιο Παροχής Υπηρεσιών", kind: "credit" },
  7072: { code: "ΕΛΠ", label: "Απόδειξη Επιστροφής Λιανικών", kind: "credit" },
  3801: { code: "ΕΜ", label: "Είσπραξη Μετρητών (από τιμολόγηση)", kind: "collect" },
  3820: { code: "ΧΑΕ", label: "Απόδειξη Είσπραξης χειρόγραφη", kind: "collect" },
} as const satisfies Record<
  number,
  { code: string; label: string; kind: "income" | "credit" | "collect" }
>;

export type DocGroup = {
  code: string;
  label: string;
  count: number;
  total: number;
  /** Οι κωδικοί των παραστατικών, για τον έλεγχο. */
  samples: string[];
};

export type DailyRevenue = {
  income: DocGroup[];
  credits: DocGroup[];
  collections: DocGroup[];
  incomeTotal: number;
  creditsTotal: number;
  collectionsTotal: number;
  /** Παραστατικά με ποσό που δεν ανήκουν σε γνωστή σειρά — για να μη χαθούν σιωπηλά. */
  unclassified: { code: string; series: string; total: number }[];
  error?: string;
};

const EMPTY: DailyRevenue = {
  income: [],
  credits: [],
  collections: [],
  incomeTotal: 0,
  creditsTotal: 0,
  collectionsTotal: 0,
  unclassified: [],
};

/**
 * Τα παραστατικά μιας ημέρας.
 *
 * Το `TRNDATE` του ERP είναι ημερομηνία χωρίς ώρα, οπότε το εύρος είναι η
 * ημέρα ολόκληρη — που ταιριάζει με την αναφορά, αφού εκείνη τρέχει στις
 * 23:00 και καλύπτει κι αυτή ολόκληρη τη μέρα.
 */
export async function fetchDailyRevenue(day: Date): Promise<DailyRevenue> {
  const company = Number(process.env.PARKING_COMPANY ?? 1002);
  const connection = await prisma.softOneConnection.findFirst({ where: { company } });
  if (!connection) return { ...EMPTY, error: `Δεν υπάρχει σύνδεση SoftOne για την εταιρία ${company}.` };

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
    return { ...EMPTY, error: auth.error || "Αποτυχία ταυτοποίησης SoftOne." };
  }

  const iso = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
  const fields = "FINDOC,FINCODE,TRNDATE,SUMAMNT,SERIES";
  const res = await getSoftOneTableData(
    "FINDOC",
    fields,
    auth.clientID,
    connection.appId,
    `COMPANY=${company} AND TRNDATE='${iso}'`
  );
  if (!res.success || !res.data) return { ...EMPTY, error: res.error || "Δεν διαβάστηκαν παραστατικά." };

  const cols = fields.split(",");
  const groups = new Map<string, DocGroup>();
  const unknown = new Map<string, { code: string; series: string; total: number }>();

  for (const row of res.data as unknown[][]) {
    const o = Object.fromEntries(cols.map((k, i) => [k, row[i]])) as Record<string, unknown>;
    const amount = Number(o.SUMAMNT) || 0;
    if (amount === 0) continue; // ΕΙΣ/ΕΞ: κινήσεις αποθήκης, χωρίς αξία

    const series = Number(o.SERIES);
    const known = SERIES[series as keyof typeof SERIES];
    const code = String(o.FINCODE ?? "").trim();

    if (!known) {
      // Δεν το αθροίζουμε πουθενά, αλλά το ΑΝΑΦΕΡΟΥΜΕ: ένα παραστατικό που
      // αγνοείται σιωπηλά είναι χειρότερο από ένα που μετριέται λάθος.
      const key = `${series}|${code}`;
      const prev = unknown.get(key);
      unknown.set(key, { code, series: String(series), total: (prev?.total ?? 0) + amount });
      continue;
    }

    const g = groups.get(known.code) ?? {
      code: known.code,
      label: known.label,
      count: 0,
      total: 0,
      samples: [],
    };
    g.count++;
    g.total += amount;
    if (g.samples.length < 6 && code) g.samples.push(code);
    groups.set(known.code, g);
  }

  const kindOf = (code: string) =>
    Object.values(SERIES).find((s) => s.code === code)?.kind ?? "income";

  const income = [...groups.values()].filter((g) => kindOf(g.code) === "income");
  const credits = [...groups.values()].filter((g) => kindOf(g.code) === "credit");
  const collections = [...groups.values()].filter((g) => kindOf(g.code) === "collect");
  const creditsTotal = credits.reduce((s, g) => s + g.total, 0);

  return {
    income,
    credits,
    collections,
    // Τα πιστωτικά αφαιρούνται: είναι ακύρωση εσόδου, όχι έσοδο.
    incomeTotal: income.reduce((s, g) => s + g.total, 0) - creditsTotal,
    creditsTotal,
    collectionsTotal: collections.reduce((s, g) => s + g.total, 0),
    unclassified: [...unknown.values()].sort((a, b) => b.total - a.total).slice(0, 8),
  };
}
