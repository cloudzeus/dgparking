/**
 * Αναφορά ανείσπρακτων σταθμεύσεων σε Excel.
 *
 * Συγκρίνει κάθε κλεισμένη εγγραφή του ψηφιακού πελατολογίου με το ποσό που
 * ΘΑ ΕΠΡΕΠΕ να χρεωθεί σύμφωνα με τον τιμοκατάλογο και το δωρεάν 15λεπτο, και
 * βγάζει όσες χρεώθηκαν λιγότερο.
 *
 * Το ERP διαβάζεται ΑΝΑ ΜΗΝΑ: ένα ερώτημα δώδεκα μηνών επιστρέφει δεκάδες
 * χιλιάδες γραμμές σε μία απάντηση και είναι εύθραυστο.
 *
 *   npx tsx scripts/report-unbilled.ts [μήνες]
 */
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import "dotenv/config";
import { fetchErpStays, type ErpStay } from "../src/lib/parking-reconcile";
import { wallClockNow } from "../src/lib/parking-time";
import { calculateCharge, FREE_MINUTES } from "../src/lib/parking-tariff";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const MONTHS = Number(process.argv[2] ?? 12);

const fmt = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()} ` +
  `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

type Row = {
  plate: string;
  soaction: number;
  entry: Date;
  exit: Date;
  minutes: number;
  due: number;
  charged: number;
  gap: number;
  contract: string;
  pattern: string;
  month: string;
};

async function fetchAllStays(): Promise<ErpStay[]> {
  const now = wallClockNow();
  const all: ErpStay[] = [];
  for (let i = 0; i < MONTHS; i++) {
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    process.stdout.write(`  ${monthKey(from)} … `);
    try {
      const batch = await fetchErpStays(from, to > now ? now : to);
      all.push(...batch);
      console.log(`${batch.length} εγγραφές`);
    } catch (e) {
      console.log(`ΣΦΑΛΜΑ: ${e instanceof Error ? e.message : e}`);
    }
  }
  return all;
}

async function main() {
  console.log(`Ανάγνωση ψηφιακού πελατολογίου, ${MONTHS} μήνες:`);
  const stays = (await fetchAllStays()).filter((s) => s.entry && s.exit);

  // Διπλές εγγραφές ανάμεσα σε μήνες — κλειδί το SOACTION.
  const unique = [...new Map(stays.map((s) => [s.soaction, s])).values()];
  console.log(`\nσύνολο κλεισμένων εγγραφών: ${unique.length}`);

  const withDue = unique.map((s) => {
    const minutes = Math.round((s.exit!.getTime() - s.entry!.getTime()) / 60000);
    const due = calculateCharge({ entry: s.entry!, exit: s.exit!, hasContract: s.inst != null }).amount;
    return { ...s, minutes, due };
  });

  // Μοτίβο ανά πινακίδα: χρεώνεται ποτέ ή ποτέ;
  const byPlateAll = new Map<string, { free: number; paid: number }>();
  withDue
    .filter((s) => s.inst == null)
    .forEach((s) => {
      const b = byPlateAll.get(s.plate) ?? { free: 0, paid: 0 };
      s.amount > 0 ? b.paid++ : b.free++;
      byPlateAll.set(s.plate, b);
    });

  const unbilled = withDue.filter((s) => s.due > s.amount + 0.005);
  const plates = [...new Set(unbilled.map((s) => s.plate))];
  const items = await prisma.iTEMS.findMany({
    where: { CODE: { in: plates } },
    select: { MTRL: true, CODE: true },
  });
  const lines = await prisma.iNSTLINES.findMany({
    where: { MTRL: { in: items.map((i) => String(i.MTRL)) } },
    select: { MTRL: true },
  });
  const contracted = new Set(lines.map((l) => String(l.MTRL)));
  const platesInContract = new Set(
    items.filter((i) => contracted.has(String(i.MTRL))).map((i) => i.CODE!)
  );

  const rows: Row[] = unbilled
    .map((s) => {
      const b = byPlateAll.get(s.plate) ?? { free: 0, paid: 0 };
      return {
        plate: s.plate,
        soaction: s.soaction,
        entry: s.entry!,
        exit: s.exit!,
        minutes: s.minutes,
        due: s.due,
        charged: s.amount,
        gap: Math.round((s.due - s.amount) * 100) / 100,
        contract: s.inst ? `ναι (${s.inst})` : platesInContract.has(s.plate) ? "πινακίδα σε σύμβαση" : "όχι",
        pattern: b.paid === 0 ? "πάντα δωρεάν" : `ασυνεπής (${b.paid} χρεώσεις)`,
        month: monthKey(s.entry!),
      };
    })
    .sort((a, b) => b.gap - a.gap);

  const total = rows.reduce((s, r) => s + r.gap, 0);
  console.log(`ανείσπρακτες: ${rows.length} στάσεις · ${new Set(rows.map((r) => r.plate)).size} πινακίδες · ${total.toFixed(2)} €`);

  /* ── Excel ─────────────────────────────────────────────────────────────── */
  const wb = new ExcelJS.Workbook();
  wb.creator = "MEGA Parking";
  wb.created = new Date();

  const money = '#,##0.00 "€"';
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E2A5A" },
  };

  const styleHeader = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = headerFill;
    r.alignment = { vertical: "middle" };
    r.height = 22;
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };

  /* Φύλλο 1 — Σύνοψη */
  const sum = wb.addWorksheet("Σύνοψη");
  sum.columns = [{ width: 42 }, { width: 18 }, { width: 18 }];
  const alwaysFree = rows.filter((r) => r.pattern === "πάντα δωρεάν");
  const inconsistent = rows.filter((r) => r.pattern !== "πάντα δωρεάν");
  const contractRows = rows.filter((r) => r.contract.startsWith("ναι"));

  sum.addRow(["ΑΝΕΙΣΠΡΑΚΤΕΣ ΣΤΑΘΜΕΥΣΕΙΣ"]).font = { bold: true, size: 14 };
  sum.addRow([`Περίοδος: τελευταίοι ${MONTHS} μήνες`]);
  sum.addRow([`Δωρεάν χρόνος που εξαιρείται: ${FREE_MINUTES} λεπτά`]);
  sum.addRow([`Δημιουργήθηκε: ${fmt(new Date())}`]);
  sum.addRow([]);
  sum.addRow(["Κατηγορία", "Στάσεις", "Ποσό"]).font = { bold: true };
  const addSum = (label: string, list: Row[]) => {
    const r = sum.addRow([label, list.length, list.reduce((s, x) => s + x.gap, 0)]);
    r.getCell(3).numFmt = money;
    return r;
  };
  addSum("Πάντα δωρεάν (πιθανή συμφωνία)", alwaysFree);
  addSum("Ασυνεπείς (πιθανή απώλεια)", inconsistent);
  addSum("Με ενεργή σύμβαση", contractRows);
  const totalRow = addSum("ΣΥΝΟΛΟ", rows);
  totalRow.font = { bold: true };
  sum.addRow([]);
  sum.addRow(["Σημείωση: το ποσό υπολογίζεται με τον τιμοκατάλογο και το δωρεάν 15λεπτο."]);
  sum.addRow(["Δεν αποτελεί βεβαιωμένη οφειλή — πινακίδες με συμφωνία πρέπει να εξαιρεθούν."]);

  /* Φύλλο 2 — Αναλυτικά */
  const det = wb.addWorksheet("Αναλυτικά");
  det.columns = [
    { header: "Πινακίδα", key: "plate", width: 13 },
    { header: "Εγγραφή ERP", key: "soaction", width: 13 },
    { header: "Είσοδος", key: "entry", width: 18 },
    { header: "Έξοδος", key: "exit", width: 18 },
    { header: "Λεπτά", key: "minutes", width: 9 },
    { header: "Οφειλόμενο", key: "due", width: 13 },
    { header: "Χρεώθηκε", key: "charged", width: 12 },
    { header: "Διαφορά", key: "gap", width: 12 },
    { header: "Σύμβαση", key: "contract", width: 22 },
    { header: "Μοτίβο", key: "pattern", width: 24 },
    { header: "Μήνας", key: "month", width: 10 },
  ];
  rows.forEach((r) =>
    det.addRow({ ...r, entry: fmt(r.entry), exit: fmt(r.exit) })
  );
  ["due", "charged", "gap"].forEach((k) => {
    det.getColumn(k).numFmt = money;
  });
  styleHeader(det);

  /* Φύλλο 3 — Ανά πινακίδα */
  const perPlate = wb.addWorksheet("Ανά πινακίδα");
  perPlate.columns = [
    { header: "Πινακίδα", key: "plate", width: 13 },
    { header: "Στάσεις", key: "n", width: 10 },
    { header: "Σύνολο", key: "sum", width: 14 },
    { header: "Μοτίβο", key: "pattern", width: 24 },
    { header: "Σύμβαση", key: "contract", width: 22 },
  ];
  const grouped = new Map<string, { n: number; sum: number; pattern: string; contract: string }>();
  rows.forEach((r) => {
    const g = grouped.get(r.plate) ?? { n: 0, sum: 0, pattern: r.pattern, contract: r.contract };
    g.n++;
    g.sum += r.gap;
    grouped.set(r.plate, g);
  });
  [...grouped.entries()]
    .sort((a, b) => b[1].sum - a[1].sum)
    .forEach(([plate, g]) => perPlate.addRow({ plate, ...g }));
  perPlate.getColumn("sum").numFmt = money;
  styleHeader(perPlate);

  /* Φύλλο 4 — Ανά μήνα */
  const perMonth = wb.addWorksheet("Ανά μήνα");
  perMonth.columns = [
    { header: "Μήνας", key: "month", width: 12 },
    { header: "Στάσεις", key: "n", width: 10 },
    { header: "Ποσό", key: "sum", width: 14 },
  ];
  const months = new Map<string, { n: number; sum: number }>();
  rows.forEach((r) => {
    const m = months.get(r.month) ?? { n: 0, sum: 0 };
    m.n++;
    m.sum += r.gap;
    months.set(r.month, m);
  });
  [...months.entries()].sort().forEach(([month, m]) => perMonth.addRow({ month, ...m }));
  perMonth.getColumn("sum").numFmt = money;
  styleHeader(perMonth);

  const path = "logs/anispraktes-stathmefseis.xlsx";
  await wb.xlsx.writeFile(path);
  console.log(`\nExcel: ${path}`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
