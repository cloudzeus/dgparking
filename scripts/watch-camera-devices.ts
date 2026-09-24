/**
 * Παρακολούθηση: εμφανίστηκε νέο όνομα συσκευής κάμερας;
 *
 * Τυπώνει μία γραμμή ΜΟΝΟ όταν δει `device_name` που δεν είχε ξαναδεί, ώστε να
 * εντοπιστεί η κάμερα εξόδου μόλις στείλει το πρώτο της συμβάν. Τυπώνει επίσης
 * τα σφάλματα — σιωπή δεν πρέπει να σημαίνει «όλα καλά αλλά έσκασε το script».
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient({ log: [] });
const seen = new Set<string>();
const POLL_MS = 60_000;

async function tick() {
  const groups = await prisma.lprRecognitionEvent.groupBy({
    by: ["deviceName"],
    where: { deviceName: { not: null } },
    _count: { _all: true },
  });
  for (const g of groups) {
    const name = g.deviceName!;
    if (seen.has(name)) continue;
    seen.add(name);
    const sample = await prisma.lprRecognitionEvent.findFirst({
      where: { deviceName: name },
      orderBy: { recognitionTime: "desc" },
      select: { licensePlate: true, direction: true, recognitionTime: true, sourceIp: true },
    });
    console.log(
      `ΝΕΑ ΚΑΜΕΡΑ: "${name}" (${g._count._all} συμβάντα) · τελευταίο: ` +
        `${sample?.licensePlate} ${sample?.direction} ${sample?.recognitionTime.toISOString().slice(11, 19)} ip=${sample?.sourceIp ?? "—"}`
    );
  }
}

async function main() {
  // Πρώτο πέρασμα: μαθαίνουμε τι ήδη υπάρχει, χωρίς να το αναφέρουμε ως νέο.
  const existing = await prisma.lprRecognitionEvent.groupBy({
    by: ["deviceName"],
    where: { deviceName: { not: null } },
  });
  existing.forEach((g) => seen.add(g.deviceName!));
  console.log(`γνωστές συσκευές στην εκκίνηση: ${[...seen].join(", ") || "καμία"}`);

  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.log(`ΣΦΑΛΜΑ παρακολούθησης: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
