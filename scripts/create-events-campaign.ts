/**
 * Δημιουργεί ΠΡΟΣΧΕΔΙΟ εκστρατείας για την υπηρεσία εκδηλώσεων.
 *
 *   npm run campaign:events -- --hero <url εικόνας>
 *
 * ΔΕΝ ΣΤΕΛΝΕΙ ΤΙΠΟΤΑ. Γράφει μια εκστρατεία σε κατάσταση `DRAFT`, με το
 * κείμενο και την εικόνα αποθηκευμένα μαζί στο `contentJson`, ώστε να
 * ανοίξει στο `/newsletter` για έλεγχο και έγκριση. Η αποστολή γίνεται
 * χειροκίνητα από τη σελίδα, από άνθρωπο.
 *
 * Ξανατρέχοντας, ενημερώνει το ίδιο προσχέδιο αντί να φτιάχνει δεύτερο.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const NAME = "Στάθμευση για εκδηλώσεις — ανακοίνωση υπηρεσίας";
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://megaparking.gr";

const SUBJECT = "Νέα υπηρεσία: κλείστε θέσεις για την εκδήλωσή σας";
const PREHEADER =
  "Δεσμεύουμε τον ακριβή αριθμό θέσεων που χρειάζεστε, για τις ώρες που τις χρειάζεστε.";

/**
 * Το κείμενο του δελτίου.
 *
 * Γραμμένο για ανθρώπους που ήδη μας ξέρουν: χωρίς εισαγωγή στο «ποιοι
 * είμαστε», κατευθείαν στο τι είναι καινούργιο και σε ποιον χρησιμεύει.
 * Σύντομες παράγραφοι, ένα κάλεσμα, κανένας υπερθετικός.
 */
const CONTENT_HTML = `
<p>Μας ρωτούσατε συχνά αν μπορούμε να κρατήσουμε θέσεις για μια συγκεκριμένη ημέρα.
Πλέον μπορούμε — και το κάναμε κανονική υπηρεσία.</p>

<p><strong>Δεσμεύουμε τον ακριβή αριθμό θέσεων που χρειάζεστε, για τις ώρες που τις
χρειάζεστε.</strong> Οι θέσεις αποκλείονται από την κανονική κίνηση και σας περιμένουν.
Δεν είναι υπόσχεση ότι «μάλλον θα υπάρχει χώρος».</p>

<h3>Τι περιλαμβάνει</h3>
<ul>
  <li><strong>Αποκλειστικές θέσεις.</strong> Ο αριθμός που συμφωνήσαμε δεσμεύεται και
      σημαίνεται πριν φτάσει ο πρώτος καλεσμένος.</li>
  <li><strong>Μία τιμή, γνωστή από πριν.</strong> Το συνολικό κόστος συμφωνείται στην
      προσφορά. Οι καλεσμένοι δεν πληρώνουν τίποτα στην έξοδο.</li>
  <li><strong>Γρήγορη είσοδος.</strong> Αναγνώριση πινακίδας στην μπάρα — χωρίς
      εισιτήρια και χωρίς ουρά στο μηχάνημα.</li>
  <li><strong>Ένα παραστατικό.</strong> Ένα τιμολόγιο στο τέλος, στην επωνυμία σας.</li>
</ul>

<h3>Σε ποιον χρησιμεύει</h3>
<p>Γάμοι και βαφτίσεις, εταιρικές εκδηλώσεις και συνέδρια, αφίξεις κρουαζιέρας,
συναυλίες, γυρίσματα, προσωρινή στάθμευση στόλου. Κάθε άφιξη που δεν αντέχει
καθυστέρηση.</p>

<p>Στείλτε μας ημερομηνία, ώρες και αριθμό θέσεων από τη φόρμα της σελίδας.
Απαντάμε με διαθεσιμότητα και τιμή <strong>εντός μίας εργάσιμης ημέρας</strong>.
Το αίτημα δεν σας δεσμεύει σε τίποτα.</p>
`.trim();

async function main() {
  const heroIndex = process.argv.indexOf("--hero");
  const heroImageUrl = heroIndex > -1 ? process.argv[heroIndex + 1] : undefined;

  const content = {
    html: CONTENT_HTML,
    ctaLabel: "Ζητήστε προσφορά",
    ctaUrl: `${SITE}/el/events`,
    ...(heroImageUrl ? { heroImageUrl } : {}),
  };

  const existing = await prisma.newsletterCampaign.findFirst({
    where: { name: NAME },
    select: { id: true, status: true },
  });

  if (existing && existing.status !== "DRAFT") {
    console.log(
      `Η εκστρατεία «${NAME}» υπάρχει ήδη με κατάσταση ${existing.status} — ` +
        "δεν την πειράζω. Δημιούργησε νέα από τη σελίδα αν χρειάζεται."
    );
    return;
  }

  const data = {
    name: NAME,
    subject: SUBJECT,
    preheader: PREHEADER,
    // «Hero με φωτογραφία»: εικόνα από άκρη σε άκρη και ο τίτλος από κάτω.
    template: "hero",
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
  console.log(" εικόνα     :", heroImageUrl ?? "— (χωρίς hero)");
  console.log(" κατάσταση  :", campaign.status);
  console.log(" παραλήπτες :", ready, "εγγεγραμμένοι (ΔΕΝ στάλθηκε τίποτα)");
  console.log(" σύνδεσμος  :", `/newsletter/${campaign.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
