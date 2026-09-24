/**
 * Δημιουργεί ΠΡΟΣΧΕΔΙΟ εκστρατείας για την πύλη πελατών.
 *
 *   npm run campaign:portal -- --hero <url εικόνας>
 *
 * ΔΕΝ ΣΤΕΛΝΕΙ ΤΙΠΟΤΑ. Η αποστολή γίνεται από το κουμπί «Αποστολή σε όλους»
 * στη σελίδα της εκστρατείας, από τον χρήστη, όποτε εκείνος κρίνει.
 *
 * Το κείμενο χωρίζεται με <hr>: κάθε κομμάτι πριν τον τελευταίο διαχωριστή
 * γίνεται μια αριθμημένη λειτουργία, και ό,τι μένει μετά γίνεται η κόκκινη
 * ταινία «τι ακολουθεί».
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const NAME = "Πύλη πελατών — παρουσίαση";
const SUBJECT = "Η σύμβασή σας, online";
const PREHEADER =
  "Πινακίδες, κινήσεις και τιμολόγια σε μία σελίδα. Σύντομα θα λάβετε τα στοιχεία πρόσβασης.";

/**
 * Το κείμενο.
 *
 * Η πρώτη παράγραφος είναι η εισαγωγή (μπαίνει στη γκρι ζώνη). Ακολουθούν
 * τέσσερις λειτουργίες χωρισμένες με <hr>, καθεμία με τίτλο και μία πρόταση.
 * Το τελευταίο κομμάτι είναι η ανακοίνωση.
 *
 * Καμία υπόσχεση για ημερομηνία: δεν υπάρχει ακόμα, και μια ημερομηνία που
 * δεν τηρείται κοστίζει περισσότερο από όσο κερδίζει μια αόριστη διατύπωση.
 */
const CONTENT_HTML = `
<p>Ως τώρα, για να μάθετε τι ισχύει στη σύμβασή σας έπρεπε να μας πάρετε τηλέφωνο.
Φτιάξαμε μια σελίδα όπου τα βλέπετε μόνοι σας, όποτε θέλετε.</p>

<hr />

<h3>Η σύμβασή σας</h3>
<p>Περίοδος, θέσεις και πόσες ημέρες απομένουν ως τη λήξη. Με ειδοποίηση μία
εβδομάδα πριν, ώστε να μη διακοπεί η πρόσβαση των οχημάτων σας.</p>

<hr />

<h3>Οι πινακίδες σας</h3>
<p>Δείτε ποιες είναι δηλωμένες και ζητήστε προσθήκη ή αφαίρεση. Μπορείτε να
σημειώσετε και ποιος οδηγεί κάθε αυτοκίνητο — χρήσιμο όταν η σύμβαση έχει
πολλά.</p>

<hr />

<h3>Οι κινήσεις σας</h3>
<p>Ποια οχήματά σας βρίσκονται αυτή τη στιγμή στον χώρο και από πότε, και οι
σταθμεύσεις του τελευταίου μήνα.</p>

<hr />

<h3>Τα τιμολόγιά σας</h3>
<p>Κάθε παραστατικό του τελευταίου δωδεκαμήνου σε PDF, έτοιμο για εκτύπωση ή
για το λογιστήριό σας. Χωρίς σύνδεση σε άλλη σελίδα.</p>

<hr />

<p><strong>Σύντομα θα λάβετε από εμάς τα στοιχεία πρόσβασης</strong>, μαζί με
σύντομες οδηγίες. Δεν χρειάζεται να κάνετε τίποτα από τώρα — η πρόσβαση
δίνεται ονομαστικά, αφού επιβεβαιώσουμε τα στοιχεία της εταιρείας σας.</p>
`.trim();

async function main() {
  const heroIndex = process.argv.indexOf("--hero");
  const heroImageUrl = heroIndex > -1 ? process.argv[heroIndex + 1] : undefined;

  const content = {
    html: CONTENT_HTML,
    // Κανένα κουμπί: η πύλη δεν είναι ακόμα ανοιχτή για αυτούς, και ένα CTA
    // που οδηγεί σε οθόνη σύνδεσης χωρίς κωδικό είναι απογοήτευση.
    ...(heroImageUrl ? { heroImageUrl } : {}),
  };

  const existing = await prisma.newsletterCampaign.findFirst({
    where: { name: NAME },
    select: { id: true, status: true },
  });

  if (existing && existing.status !== "DRAFT") {
    console.log(`Η εκστρατεία «${NAME}» έχει κατάσταση ${existing.status} — δεν την πειράζω.`);
    return;
  }

  const data = {
    name: NAME,
    subject: SUBJECT,
    preheader: PREHEADER,
    template: "spotlight",
    contentJson: content,
    status: "DRAFT" as const,
    locale: "el",
  };

  const campaign = existing
    ? await prisma.newsletterCampaign.update({ where: { id: existing.id }, data })
    : await prisma.newsletterCampaign.create({ data });

  const ready = await prisma.newsletterSubscriber.count({ where: { status: "SUBSCRIBED" } });

  console.log("── ΠΡΟΣΧΕΔΙΟ ΕΚΣΤΡΑΤΕΙΑΣ ──────────────────");
  console.log(" όνομα      :", campaign.name);
  console.log(" θέμα       :", campaign.subject);
  console.log(" πρότυπο    :", campaign.template);
  console.log(" εικόνα     :", heroImageUrl ?? "—");
  console.log(" κατάσταση  :", campaign.status);
  console.log(" παραλήπτες :", ready, "εγγεγραμμένοι");
  console.log(" σύνδεσμος  :", `/newsletter/${campaign.id}`);
  console.log("\nΔΕΝ στάλθηκε τίποτα. Η αποστολή γίνεται από το κουμπί της σελίδας.");
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
