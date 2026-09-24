/**
 * Καθαρισμός παλιών δεδομένων LPR.
 *
 * Σβήνει ό,τι είναι παλαιότερο από Ν ημέρες (προεπιλογή 60):
 *   - τα αρχεία εικόνων από το BunnyCDN Storage
 *   - τις εγγραφές `lpr_images`
 *   - τα συμβάντα `lpr_recognition_events`, `lpr_list_events`,
 *     `lpr_attributes_events`, `lpr_vehicle_counting_events`,
 *     `lpr_violation_events`
 *   - το ιστορικό `cron_job_logs`
 *
 * ΔΕΝ αγγίζει πελάτες, συμβόλαια, είδη, χρήστες, κάμερες ή ρυθμίσεις.
 *
 * Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ ΔΟΚΙΜΗ. Χωρίς `--execute` δεν σβήνει τίποτα· γράφει
 * μόνο αναφορά και CSV με τα URL που θα έσβηνε.
 *
 *   npx tsx scripts/purge-old-lpr-data.ts                 # δοκιμή, 60 ημέρες
 *   npx tsx scripts/purge-old-lpr-data.ts --days=90       # δοκιμή, 90 ημέρες
 *   npx tsx scripts/purge-old-lpr-data.ts --execute       # ΠΡΑΓΜΑΤΙΚΗ διαγραφή
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import "dotenv/config";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const DAYS = Number(args.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 60);
/** Τα ημερολόγια cron δεν είναι δεδομένα καμερών — με αυτό μένουν ανέπαφα. */
const SKIP_CRON_LOGS = args.includes("--skip-cron-logs");
const BATCH = 500;
const CONCURRENCY = 25;

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";

/**
 * Από το δημόσιο URL στο μονοπάτι του Storage.
 * `https://kolleris.b-cdn.net/parking/full-images/123_full_x.jpg` → `parking/full-images/123_full_x.jpg`
 */
function storagePathFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, "");
    return path || null;
  } catch {
    return null;
  }
}

async function deleteFromBunny(path: string): Promise<"deleted" | "missing" | "failed"> {
  const res = await fetch(`https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`, {
    method: "DELETE",
    headers: { AccessKey: BUNNY_ACCESS_KEY! },
  });
  if (res.ok) return "deleted";
  // 404: το αρχείο έχει ήδη φύγει — δεν είναι σφάλμα για τον καθαρισμό.
  if (res.status === 404) return "missing";
  return "failed";
}

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const mode = EXECUTE ? "ΠΡΑΓΜΑΤΙΚΗ ΔΙΑΓΡΑΦΗ" : "ΔΟΚΙΜΗ (δεν σβήνει τίποτα)";

  console.log("=".repeat(70));
  console.log(`Καθαρισμός δεδομένων LPR — ${mode}`);
  console.log(`Όριο: παλαιότερα από ${cutoff.toLocaleString("el-GR", { timeZone: "Europe/Athens" })} (${DAYS} ημέρες)`);
  console.log("=".repeat(70), "\n");

  if (EXECUTE && (!BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY)) {
    console.error("❌ Λείπουν BUNNY_STORAGE_ZONE / BUNNY_ACCESS_KEY — δεν μπορώ να σβήσω αρχεία.");
    process.exit(1);
  }

  // ---------- 1. Εικόνες ----------
  const imageCount = await prisma.lprImage.count({ where: { createdAt: { lt: cutoff } } });
  const sizeAgg = await prisma.lprImage.aggregate({
    _sum: { fileSize: true },
    where: { createdAt: { lt: cutoff } },
  });
  const gb = (sizeAgg._sum.fileSize ?? 0) / 1024 ** 3;

  console.log(`Εικόνες προς διαγραφή: ${imageCount.toLocaleString("el-GR")} (${gb.toFixed(1)} GB)\n`);

  const stats = { deleted: 0, missing: 0, failed: 0, rowsDeleted: 0 };
  const failures: string[] = [];

  if (!EXECUTE) {
    // Δοκιμή: κρατάμε τα URL σε CSV για έλεγχο, χωρίς καμία αλλαγή.
    const rows: string[] = ["url,fileName,fileSize,createdAt"];
    let cursor: string | undefined;
    let seen = 0;

    for (;;) {
      const batch = await prisma.lprImage.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true, url: true, fileName: true, fileSize: true, createdAt: true },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      for (const img of batch) {
        rows.push(
          [img.url, img.fileName ?? "", img.fileSize ?? "", img.createdAt.toISOString()]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        );
      }
      seen += batch.length;
      cursor = batch[batch.length - 1].id;
      if (seen % 10000 === 0) console.log(`  …καταγράφηκαν ${seen.toLocaleString("el-GR")}`);
    }

    mkdirSync(join(process.cwd(), "logs"), { recursive: true });
    const out = join(process.cwd(), "logs", `purge-dry-run-${Date.now()}.csv`);
    writeFileSync(out, rows.join("\n"));
    console.log(`\n📄 Αναλυτική λίστα: ${out}`);
  } else {
    // Πραγματική διαγραφή, σε παρτίδες: πρώτα το αρχείο, μετά η εγγραφή.
    for (;;) {
      const batch = await prisma.lprImage.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true, url: true },
        take: BATCH,
      });
      if (batch.length === 0) break;

      const removable: string[] = [];

      // Παράλληλα, με όριο — σειριακά θα έπαιρνε ώρες για 250.000+ αρχεία.
      const queue = [...batch];
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          for (;;) {
            const img = queue.shift();
            if (!img) return;

            const path = storagePathFromUrl(img.url);
            if (!path) {
              // Χωρίς έγκυρο URL δεν υπάρχει αρχείο να σβήσουμε — η εγγραφή φεύγει.
              removable.push(img.id);
              continue;
            }

            let result: Awaited<ReturnType<typeof deleteFromBunny>>;
            try {
              result = await deleteFromBunny(path);
            } catch {
              result = "failed";
            }

            stats[result]++;
            if (result === "failed") {
              failures.push(img.url);
            } else {
              removable.push(img.id);
            }
          }
        })
      );

      if (removable.length > 0) {
        const { count } = await prisma.lprImage.deleteMany({ where: { id: { in: removable } } });
        stats.rowsDeleted += count;
      }

      console.log(
        `  αρχεία: ${stats.deleted.toLocaleString("el-GR")} σβήστηκαν, ` +
          `${stats.missing.toLocaleString("el-GR")} έλειπαν, ${stats.failed} απέτυχαν · ` +
          `εγγραφές: ${stats.rowsDeleted.toLocaleString("el-GR")}`
      );

      // Αν όλη η παρτίδα απέτυχε, σταματάμε αντί να χτυπάμε το CDN στο κενό.
      if (removable.length === 0) {
        console.error("❌ Καμία διαγραφή σε ολόκληρη παρτίδα — διακοπή.");
        break;
      }
    }
  }

  // ---------- 2. Συμβάντα και ιστορικό ----------
  const targets = [
    ["lpr_recognition_events", () => prisma.lprRecognitionEvent.count({ where: { createdAt: { lt: cutoff } } }), () => prisma.lprRecognitionEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })],
    ["lpr_list_events", () => prisma.lprListEvent.count({ where: { createdAt: { lt: cutoff } } }), () => prisma.lprListEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })],
    ["lpr_attributes_events", () => prisma.lprAttributesEvent.count({ where: { createdAt: { lt: cutoff } } }), () => prisma.lprAttributesEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })],
    ["lpr_vehicle_counting_events", () => prisma.lprVehicleCountingEvent.count({ where: { createdAt: { lt: cutoff } } }), () => prisma.lprVehicleCountingEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })],
    ["lpr_violation_events", () => prisma.lprViolationEvent.count({ where: { createdAt: { lt: cutoff } } }), () => prisma.lprViolationEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })],
    ...(SKIP_CRON_LOGS
      ? []
      : [["cron_job_logs", () => prisma.cronJobLog.count({ where: { createdAt: { lt: cutoff } } }), () => prisma.cronJobLog.deleteMany({ where: { createdAt: { lt: cutoff } } })] as const]),
  ] as const;

  console.log("\nΕγγραφές:");
  for (const [name, count, remove] of targets) {
    const n = await count();
    if (!EXECUTE) {
      console.log(`  ${name.padEnd(30)} θα σβήνονταν: ${n.toLocaleString("el-GR")}`);
    } else {
      const { count: deleted } = await remove();
      console.log(`  ${name.padEnd(30)} σβήστηκαν: ${deleted.toLocaleString("el-GR")}`);
    }
  }

  if (failures.length > 0) {
    mkdirSync(join(process.cwd(), "logs"), { recursive: true });
    const out = join(process.cwd(), "logs", `purge-failures-${Date.now()}.txt`);
    writeFileSync(out, failures.join("\n"));
    console.log(`\n⚠️  ${failures.length} αρχεία δεν σβήστηκαν — οι εγγραφές τους έμειναν: ${out}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log(EXECUTE ? "✅ Ο καθαρισμός ολοκληρώθηκε." : "ℹ️  Δοκιμή — δεν άλλαξε τίποτα. Με --execute γίνεται πραγματικά.");
  console.log("=".repeat(70));
}

main()
  .catch((error) => {
    console.error("❌ Σφάλμα:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
