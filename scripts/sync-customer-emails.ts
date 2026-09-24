/**
 * Εξάγει όλες τις διευθύνσεις email από τις καρτέλες πελατών και τις
 * καταχωρεί μία-μία στον πίνακα `customer_emails`.
 *
 *   npm run emails:sync
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { extractEmails } from "../src/lib/customer-emails";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function main() {
  const customers = await prisma.cUSTORMER.findMany({
    select: { TRDR: true, NAME: true, EMAIL: true, EMAILACC: true },
  });

  const rows: { trdr: string; email: string; source: string; isPrimary: boolean }[] = [];
  let multi = 0;

  for (const c of customers) {
    if (!c.TRDR) continue;
    const fromMain = extractEmails(c.EMAIL);
    const fromAcc = extractEmails(c.EMAILACC).filter((e) => !fromMain.includes(e));
    if (fromMain.length + fromAcc.length > 1) multi++;

    fromMain.forEach((email, i) =>
      rows.push({ trdr: c.TRDR!, email, source: "EMAIL", isPrimary: i === 0 })
    );
    fromAcc.forEach((email) =>
      rows.push({ trdr: c.TRDR!, email, source: "EMAILACC", isPrimary: fromMain.length === 0 && email === fromAcc[0] })
    );
  }

  await prisma.customerEmail.deleteMany({});
  for (let i = 0; i < rows.length; i += 200) {
    await prisma.customerEmail.createMany({ data: rows.slice(i, i + 200), skipDuplicates: true });
  }

  const distinctCustomers = new Set(rows.map((r) => r.trdr)).size;
  console.log("── EMAIL ΠΕΛΑΤΩΝ ──────────────────────────");
  console.log(" καρτέλες που ελέγχθηκαν :", customers.length);
  console.log(" διευθύνσεις που βρέθηκαν:", rows.length);
  console.log(" πελάτες με email        :", distinctCustomers);
  console.log(" πελάτες με >1 διεύθυνση :", multi);
  console.log(" από πεδίο EMAILACC      :", rows.filter((r) => r.source === "EMAILACC").length);
}

main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
