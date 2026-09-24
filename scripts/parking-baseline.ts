/**
 * Συντονισμός με το ψηφιακό πελατολόγιο: παίρνει φωτογραφία της τρέχουσας
 * στιγμής, ώστε η παρακολούθηση αποκλίσεων να ξεκινήσει καθαρή από εδώ.
 *
 *   npm run parking:baseline -- "προαιρετική σημείωση"
 */
import { takeBaseline } from "../src/lib/parking-monitor";

async function main() {
  const note = process.argv.slice(2).join(" ") || undefined;
  const r = await takeBaseline(note);
  console.log("── BASELINE ────────────────────────────────");
  console.log(" id            :", r.baseline.id);
  console.log(" στιγμή        :", r.baseline.takenAt.toLocaleString("el-GR"));
  console.log(" ανοιχτές ERP  :", r.erpOpen);
  console.log(" μέσα (κάμερες):", r.cameraIn);
  console.log(" συμφωνούν     :", r.matched);
  console.log(" μόνο στο ERP  :", r.onlyErp);
  console.log(" μόνο κάμερες  :", r.onlyCameras);
  console.log(" εγγραφές      :", r.baseline._count.entries);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
