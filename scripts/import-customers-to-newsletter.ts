/**
 * Περνά τις διευθύνσεις των πελατών από το `customer_emails` στους συνδρομητές
 * του ενημερωτικού δελτίου.
 *
 *   npm run newsletter:import           # προεπισκόπηση, δεν γράφει τίποτα
 *   npm run newsletter:import -- --apply
 *
 * ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ
 * Οι διευθύνσεις μαζεύτηκαν από τις καρτέλες του ERP, αλλά έμειναν εκεί: η
 * αποστολή δελτίου διαβάζει ΜΟΝΟ τον πίνακα συνδρομητών και μόνο όσους έχουν
 * κατάσταση `SUBSCRIBED`. Χωρίς αυτό το βήμα η λίστα αποστολής είναι άδεια.
 *
 * ΣΥΝΑΙΝΕΣΗ
 * Μπαίνουν ως `SUBSCRIBED` χωρίς διπλή επιβεβαίωση, γιατί δεν πρόκειται για
 * εγγραφή αγνώστου από φόρμα αλλά για υπάρχοντες πελάτες με σύμβαση, προς
 * τους οποίους στέλνονται ενημερώσεις σχετικές με την υπηρεσία που ήδη
 * χρησιμοποιούν. Κάθε εγγραφή παίρνει `source: "erp-customers"` ώστε να
 * ξεχωρίζει και να μπορεί να αναιρεθεί μαζικά, και δικό της token απεγγραφής.
 *
 * ΤΙ ΔΕΝ ΑΓΓΙΖΕΙ ΠΟΤΕ
 * Όποιον έχει ήδη απεγγραφεί, κάνει καταγγελία ή του σκάει το email
 * (UNSUBSCRIBED / COMPLAINED / BOUNCED). Μια επανεισαγωγή που «ανασταίνει»
 * τέτοια διεύθυνση είναι ακριβώς αυτό που δεν επιτρέπεται να γίνει.
 *
 * ΔΕΝ ΣΤΕΛΝΕΙ ΤΙΠΟΤΑ. Μόνο γεμίζει τη λίστα.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import "dotenv/config";

const prisma = new PrismaClient({ log: ["warn", "error"] });

/** Καταστάσεις που εκφράζουν άρνηση ή αποτυχία — δεν ξαναγράφονται ποτέ. */
const PROTECTED = new Set(["UNSUBSCRIBED", "COMPLAINED", "BOUNCED"]);

async function main() {
  const apply = process.argv.includes("--apply");

  const [emails, existing] = await Promise.all([
    prisma.customerEmail.findMany({
      select: { email: true, trdr: true, isPrimary: true },
    }),
    prisma.newsletterSubscriber.findMany({
      select: { email: true, status: true, source: true },
    }),
  ]);

  // Τα ονόματα έρχονται χωριστά: το `customer_emails` κρατά μόνο το TRDR.
  const customers = await prisma.cUSTORMER.findMany({ select: { TRDR: true, NAME: true } });
  const nameByTrdr = new Map(customers.map((c) => [c.TRDR, (c.NAME ?? "").trim()]));

  const known = new Map(existing.map((e) => [e.email.toLowerCase(), e]));

  const toCreate: { email: string; firstName: string | null; token: string }[] = [];
  const toResubscribe: string[] = [];
  let already = 0;
  const skipped: { email: string; status: string }[] = [];
  const seen = new Set<string>();

  for (const row of emails) {
    const email = row.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const name = nameByTrdr.get(row.trdr) || null;
    const prior = known.get(email);

    if (!prior) {
      toCreate.push({
        email,
        firstName: name ? name.slice(0, 100) : null,
        token: randomBytes(24).toString("hex"),
      });
    } else if (PROTECTED.has(prior.status)) {
      skipped.push({ email, status: prior.status });
    } else if (prior.status === "SUBSCRIBED") {
      already++;
    } else {
      // PENDING: υπάρχει ήδη ως εγγραφή που δεν επιβεβαιώθηκε. Ως πελάτης
      // δικαιούται να λαμβάνει, οπότε ενεργοποιείται.
      toResubscribe.push(email);
    }
  }

  console.log("── ΕΙΣΑΓΩΓΗ ΠΕΛΑΤΩΝ ΣΤΟΥΣ ΣΥΝΔΡΟΜΗΤΕΣ ──────────────");
  console.log(" διευθύνσεις πελατών        :", emails.length, `(${seen.size} μοναδικές)`);
  console.log(" υπάρχοντες συνδρομητές     :", existing.length);
  console.log(" ΝΕΕΣ εγγραφές              :", toCreate.length);
  console.log(" εκκρεμείς → εγγεγραμμένοι  :", toResubscribe.length);
  console.log(" ήδη εγγεγραμμένοι          :", already);
  console.log(" ΠΡΟΣΤΑΤΕΥΜΕΝΟΙ (αγνοούνται):", skipped.length);
  for (const s of skipped.slice(0, 20)) console.log(`   ${s.status.padEnd(12)} ${s.email}`);
  if (skipped.length > 20) console.log(`   … και άλλοι ${skipped.length - 20}`);

  if (!apply) {
    console.log("\n(προεπισκόπηση — τίποτα δεν γράφτηκε· τρέξε ξανά με --apply)");
    return;
  }

  let created = 0;
  for (let i = 0; i < toCreate.length; i += 200) {
    const batch = toCreate.slice(i, i + 200);
    const r = await prisma.newsletterSubscriber.createMany({
      data: batch.map((b) => ({
        email: b.email,
        firstName: b.firstName,
        status: "SUBSCRIBED" as const,
        token: b.token,
        source: "erp-customers",
        confirmedAt: new Date(),
      })),
      skipDuplicates: true,
    });
    created += r.count;
  }

  let revived = 0;
  for (let i = 0; i < toResubscribe.length; i += 200) {
    const r = await prisma.newsletterSubscriber.updateMany({
      where: { email: { in: toResubscribe.slice(i, i + 200) }, status: "PENDING" },
      data: { status: "SUBSCRIBED", confirmedAt: new Date(), source: "erp-customers" },
    });
    revived += r.count;
  }

  const total = await prisma.newsletterSubscriber.count({ where: { status: "SUBSCRIBED" } });
  console.log(`\nΓΡΑΦΤΗΚΑΝ: ${created} νέες, ${revived} ενεργοποιήθηκαν.`);
  console.log(`Σύνολο εγγεγραμμένων που θα λάβουν δελτίο: ${total}`);
  console.log("Κανένα email ΔΕΝ στάλθηκε.");
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
