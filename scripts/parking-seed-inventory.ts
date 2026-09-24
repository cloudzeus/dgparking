/**
 * Απογραφή από την αρχή, με βάση το ψηφιακό πελατολόγιο.
 *
 * Αδειάζει την απογραφή και τη γεμίζει με τις ανοιχτές εγγραφές του ERP.
 * Από εκεί και πέρα την ενημερώνουν τα περάσματα των καμερών.
 *
 *   npm run parking:inventory
 */
import { seedFromErp, getInventoryStats } from "../src/lib/parking-inventory";

async function main() {
  const r = await seedFromErp();
  const s = await getInventoryStats();
  console.log("── ΑΠΟΓΡΑΦΗ ────────────────────────────────");
  console.log(" καταχωρήθηκαν     :", r.seeded);
  console.log(" αφαιρέθηκαν παλιά :", r.removed);
  if (r.duplicatesCollapsed > 0)
    console.log(" διπλές ανοιχτές   :", r.duplicatesCollapsed, "(κρατήθηκε η πιο πρόσφατη)");
  console.log(" ── σύνθεση ──");
  console.log(" με σύμβαση        :", s.withContract);
  console.log(" επισκέπτες        :", s.visitors);
  console.log(" παλαιότερη είσοδος:", s.oldestEntry?.toISOString().replace("T", " ").slice(0, 16) ?? "—");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message ?? e); process.exit(1); });
