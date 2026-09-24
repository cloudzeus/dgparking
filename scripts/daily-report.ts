/**
 * Παράγει την ημερήσια αναφορά σε PDF.
 *
 *   npm run report:daily                 # σημερινή, αποθήκευση σε αρχείο
 *   npm run report:daily -- --send       # και αποστολή με email
 */
import "dotenv/config";
import fs from "node:fs";
import { buildDailyReport } from "../src/lib/daily-report";
import { sendDailyReport } from "../src/lib/daily-report-mail";

async function main() {
  const send = process.argv.includes("--send");
  const dayArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const day = dayArg ? new Date(`${dayArg}T12:00:00Z`) : undefined;

  const { pdf, stats } = await buildDailyReport(day);
  const out = `anafora-${stats.date.split("/").reverse().join("-")}.pdf`;
  fs.writeFileSync(out, pdf);

  console.log("── ΗΜΕΡΗΣΙΑ ΑΝΑΦΟΡΑ ────────────────────────");
  console.log(" ημερομηνία   :", stats.date);
  console.log(" στάσεις      :", stats.total);
  console.log(" συμφωνούν    :", stats.matched);
  console.log(" αποκλίσεις   :", stats.problems);
  console.log(" εκκρεμούν<15′:", stats.pending);
  console.log(" φωτογραφίες  :", stats.photos);
  console.log(" δικό μας     :", stats.ourTotal.toFixed(2), "€");
  console.log(" ψηφ. πελατολ.:", stats.erpTotal.toFixed(2), "€");
  console.log(" αρχείο       :", out, `(${(pdf.length / 1024).toFixed(0)} KB)`);

  if (send) {
    const r = await sendDailyReport(pdf, stats);
    console.log(r.success ? `ΣΤΑΛΘΗΚΕ: ${r.id}` : `ΑΠΕΤΥΧΕ: ${r.error}`);
  } else {
    console.log("\n(δεν στάλθηκε τίποτα — τρέξε με --send)");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
