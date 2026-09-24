/**
 * Μηδενισμός και επανασυντονισμός.
 *
 * Σβήνει ΟΛΑ τα δεδομένα που αφορούν αυτοκίνητα και καταμέτρηση, και αμέσως
 * μετά ξαναχτίζει την αρχική εικόνα από το ψηφιακό πελατολόγιο. Το «μηδέν» της
 * παρακολούθησης γίνεται η στιγμή αυτού του συντονισμού.
 *
 * ΣΒΗΝΕΙ
 *   lpr_images (και τα αρχεία στο BunnyCDN), lpr_recognition_events,
 *   lpr_list_events, lpr_attributes_events, lpr_vehicle_counting_events,
 *   lpr_violation_events, contract_cars, parking_inventory, parking_stays,
 *   parking_deviations, parking_baselines (+entries)
 *
 * ΔΕΝ ΑΓΓΙΖΕΙ
 *   items / inst / instlines / custormers — ο καθρέφτης του ERP, χωρίς τον
 *   οποίο δεν αντιστοιχίζονται πινακίδες σε συμβάσεις
 *   users / softone_connections / mailgun_settings — χωρίς αυτά κλειδώνεσαι έξω
 *   cron_job_logs — δεν είναι δεδομένα αυτοκινήτων
 *
 *   npx tsx scripts/parking-reset.ts            # δοκιμή
 *   npx tsx scripts/parking-reset.ts --execute  # ΠΡΑΓΜΑΤΙΚΗ εκτέλεση
 */

import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { takeBaseline } from "../src/lib/parking-monitor";
import { seedFromErp, getInventoryStats } from "../src/lib/parking-inventory";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const EXECUTE = process.argv.includes("--execute");

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const BUNNY_HOST = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";

async function deleteCdnFile(url: string): Promise<boolean> {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, "");
    if (!path || !BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY) return false;
    const res = await fetch(`https://${BUNNY_HOST}/${BUNNY_STORAGE_ZONE}/${path}`, {
      method: "DELETE",
      headers: { AccessKey: BUNNY_ACCESS_KEY },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function main() {
  console.log(EXECUTE ? "⚠️  ΠΡΑΓΜΑΤΙΚΗ ΕΚΤΕΛΕΣΗ\n" : "ℹ️  Δοκιμή — δεν σβήνεται τίποτα\n");

  const images = await prisma.lprImage.findMany({ select: { id: true, url: true } });
  const counts = {
    lpr_images: images.length,
    lpr_recognition_events: await prisma.lprRecognitionEvent.count(),
    lpr_list_events: await prisma.lprListEvent.count(),
    lpr_attributes_events: await prisma.lprAttributesEvent.count(),
    lpr_vehicle_counting_events: await prisma.lprVehicleCountingEvent.count(),
    lpr_violation_events: await prisma.lprViolationEvent.count(),
    contract_cars: await prisma.contractCar.count(),
    parking_inventory: await prisma.parkingInventory.count(),
    parking_stays: await prisma.parkingStay.count(),
    parking_deviations: await prisma.parkingDeviation.count(),
    parking_baseline_entries: await prisma.parkingBaselineEntry.count(),
    parking_baselines: await prisma.parkingBaseline.count(),
  };

  console.log("Προς διαγραφή:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${String(v).padStart(7)}  ${k}`);

  const keep = {
    items: await prisma.iTEMS.count(),
    inst: await prisma.iNST.count(),
    instlines: await prisma.iNSTLINES.count(),
    custormers: await prisma.cUSTORMER.count(),
    users: await prisma.user.count(),
    cron_job_logs: await prisma.cronJobLog.count(),
  };
  console.log("\nΔιατηρούνται:");
  for (const [k, v] of Object.entries(keep)) console.log(`  ${String(v).padStart(7)}  ${k}`);

  if (!EXECUTE) {
    console.log("\nΜε --execute γίνεται πραγματικά.");
    return;
  }

  // Τα αρχεία του CDN πρώτα — αν σβηστεί η γραμμή πρώτη, χάνεται το URL και το
  // αρχείο μένει ορφανό για πάντα.
  let cdnOk = 0;
  for (const img of images) {
    if (await deleteCdnFile(img.url)) cdnOk++;
  }
  console.log(`\nCDN: ${cdnOk}/${images.length} αρχεία σβήστηκαν`);

  await prisma.lprImage.deleteMany({});
  await prisma.lprRecognitionEvent.deleteMany({});
  await prisma.lprListEvent.deleteMany({});
  await prisma.lprAttributesEvent.deleteMany({});
  await prisma.lprVehicleCountingEvent.deleteMany({});
  await prisma.lprViolationEvent.deleteMany({});
  await prisma.contractCar.deleteMany({});
  await prisma.parkingStay.deleteMany({});
  await prisma.parkingDeviation.deleteMany({});
  await prisma.parkingInventory.deleteMany({});
  await prisma.parkingBaselineEntry.deleteMany({});
  await prisma.parkingBaseline.deleteMany({});
  console.log("Βάση: όλοι οι πίνακες αυτοκινήτων και καταμέτρησης άδειασαν.");

  // Επανασυντονισμός — αυτή η στιγμή γίνεται το νέο μηδέν.
  const seed = await seedFromErp();
  const base = await takeBaseline("μηδενισμός και επανασυντονισμός");
  const stats = await getInventoryStats();

  console.log("\n── ΝΕΟ ΜΗΔΕΝ ──────────────────────────────");
  console.log(" στιγμή            :", base.baseline.takenAt.toLocaleString("el-GR"));
  console.log(" απογραφή          :", seed.seeded, "οχήματα");
  console.log("   με σύμβαση      :", stats.withContract);
  console.log("   επισκέπτες      :", stats.visitors);
  console.log(" ανοιχτές στο ERP  :", base.erpOpen);
  console.log(" baseline entries  :", base.baseline._count.entries);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
