/**
 * Αναφορά συμβάσεων χωρίς έγκυρο ΑΦΜ.
 *
 *   npm run report:vat            # εμφάνιση
 *   npm run report:vat -- --send  # και αποστολή στη διοίκηση
 */
import "dotenv/config";
import { buildVatReport, type VatGapRow } from "../src/lib/dcl/vat-report";
import { sendVatReport } from "../src/lib/dcl/vat-report-mail";

const line = (r: VatGapRow) =>
  `  #${String(r.inst).padEnd(6)} ${r.afm.padEnd(12)} ${r.customer.slice(0, 44).padEnd(46)} ` +
  `${(r.phone ?? "—").padEnd(13)} ${r.plates.join(", ") || "—"}`;

async function main() {
  const rep = await buildVatReport();
  console.log("── ΣΥΜΒΑΣΕΙΣ ΧΩΡΙΣ ΕΓΚΥΡΟ ΑΦΜ ───────────────────");
  console.log(" ενεργές συμβάσεις :", rep.totalContracts);
  console.log(" με έγκυρο ΑΦΜ     :", rep.withValidVat);
  console.log(" ΕΤΑΙΡΕΙΕΣ χωρίς   :", rep.companies.length, "← αξίζει τηλέφωνο");
  console.log(" ιδιώτες χωρίς     :", rep.individuals.length, "← αναμενόμενο");

  if (rep.companies.length) {
    console.log("\nΕΤΑΙΡΕΙΕΣ:");
    rep.companies.forEach((r) => console.log(line(r)));
  }
  if (rep.individuals.length) {
    console.log("\nΙΔΙΩΤΕΣ:");
    rep.individuals.forEach((r) => console.log(line(r)));
  }

  if (process.argv.includes("--send")) {
    const r = await sendVatReport(rep);
    console.log(r.success ? `\nΣΤΑΛΘΗΚΕ: ${r.id}` : `\nΑΠΕΤΥΧΕ: ${r.error}`);
  } else {
    console.log("\n(δεν στάλθηκε — τρέξε με --send)");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
