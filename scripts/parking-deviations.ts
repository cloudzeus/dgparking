/**
 * Ανίχνευση αποκλίσεων από το τελευταίο baseline και καταγραφή τους.
 *   npm run parking:deviations
 */
import { detectDeviations } from "../src/lib/parking-monitor";

async function main() {
  const r = await detectDeviations();
  console.log("── ΑΠΟΚΛΙΣΕΙΣ ──────────────────────────────");
  console.log(" baseline      :", r.since.toLocaleString("el-GR"));
  console.log(" εγγραφές που εξετάστηκαν:", r.examined);
  console.log(" νέες αποκλίσεις:", r.created.length);
  for (const d of r.created.slice(0, 20)) {
    console.log(`   ${d.plate.padEnd(9)} ${d.kind.padEnd(19)} ${d.explanation.slice(0, 110)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
