/**
 * Μεταφέρει τα αποθηκευμένα μυστικά σε ΝΕΟ κλειδί κρυπτογράφησης.
 *
 *   npm run encryption:rotate -- --new <κλειδί>            # προεπισκόπηση
 *   npm run encryption:rotate -- --new <κλειδί> --apply
 *
 * ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ
 * Τα μυστικά (κωδικοί SoftOne) κρυπτογραφήθηκαν με το κλειδί ανάπτυξης, επειδή
 * το `ENCRYPTION_KEY` δεν είχε οριστεί ποτέ. Ορίζοντάς το εκ των υστέρων, η
 * εφαρμογή προσπαθεί να τα διαβάσει με ΑΛΛΟ κλειδί και αποτυγχάνει — η σελίδα
 * αντιπαραβολής έπεφτε με «Invalid key length».
 *
 * Το σωστό βήμα δεν είναι να αλλάξει το κλειδί, αλλά να ξαναγραφούν τα
 * δεδομένα ΜΕ το νέο κλειδί. Αυτό κάνει αυτό το script.
 *
 * ΣΕΙΡΑ ΕΝΕΡΓΕΙΩΝ
 *   1. Τρέξε το με `--apply` ΧΩΡΙΣ να έχεις ορίσει ENCRYPTION_KEY στο περιβάλλον.
 *   2. Βάλε το ίδιο κλειδί ως ENCRYPTION_KEY στην παραγωγή.
 *   3. Redeploy.
 *
 * Αν τα κάνεις ανάποδα, η εφαρμογή δεν θα μπορεί να διαβάσει τίποτα.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { decrypt, encrypt, deriveKey } from "../src/lib/encryption";

const prisma = new PrismaClient({ log: ["warn", "error"] });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const newSecret = arg("--new");

  if (!newSecret) {
    console.log("Λείπει το --new <κλειδί>.\n");
    console.log("Πρότεινε ένα κλειδί 64 δεκαεξαδικών χαρακτήρων:");
    console.log("  " + crypto.randomBytes(32).toString("hex"));
    return;
  }

  const newKey = deriveKey(newSecret);
  const connections = await prisma.softOneConnection.findMany({
    select: { id: true, name: true, username: true, passwordEnc: true },
  });

  console.log("── ΜΕΤΑΦΟΡΑ ΚΛΕΙΔΙΟΥ ──────────────────────");
  console.log(" συνδέσεις SoftOne :", connections.length);
  console.log(" τρέχον κλειδί     :", process.env.ENCRYPTION_KEY?.trim() ? "ENCRYPTION_KEY" : "προεπιλεγμένο (ανάπτυξης)");
  console.log("");

  const migrations: { id: string; name: string; value: string }[] = [];
  for (const c of connections) {
    try {
      // Διαβάζεται με το ΤΡΕΧΟΝ κλειδί (όποιο κι αν είναι αυτό)…
      const plain = decrypt(c.passwordEnc);
      // …και ξαναγράφεται με το ΝΕΟ.
      migrations.push({ id: c.id, name: c.name, value: encrypt(plain, newKey) });
      console.log(` ✓ ${c.name} (${c.username})`);
    } catch (error) {
      console.log(` ✗ ${c.name}: ${error instanceof Error ? error.message : "απέτυχε"}`);
    }
  }

  if (migrations.length !== connections.length) {
    console.log("\nΔΕΝ διαβάστηκαν όλες οι συνδέσεις — δεν γράφω τίποτα.");
    console.log("Βεβαιώσου ότι τρέχεις ΧΩΡΙΣ ορισμένο ENCRYPTION_KEY στο περιβάλλον.");
    return;
  }

  if (!apply) {
    console.log("\n(προεπισκόπηση — τίποτα δεν γράφτηκε· ξανατρέξε με --apply)");
    return;
  }

  for (const m of migrations) {
    await prisma.softOneConnection.update({
      where: { id: m.id },
      data: { passwordEnc: m.value },
    });
  }

  console.log(`\nΞΑΝΑΓΡΑΦΤΗΚΑΝ ${migrations.length} συνδέσεις με το νέο κλειδί.`);
  console.log("\nΤΩΡΑ όρισε στην παραγωγή:");
  console.log(`  ENCRYPTION_KEY=${newSecret.trim()}`);
  console.log("και κάνε redeploy. Χωρίς αυτό, η εφαρμογή δεν θα τα διαβάζει πια.");
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
