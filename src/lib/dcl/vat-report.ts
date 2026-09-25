/**
 * Αναφορά συμβάσεων χωρίς έγκυρο ΑΦΜ.
 *
 * ΤΙ ΔΕΝ ΕΙΝΑΙ
 * ΔΕΝ είναι λίστα πελατών που «δεν μπορούν να μπουν». Το `customerVatNumber`
 * είναι προαιρετικό στο σχήμα της ΑΑΔΕ (`minOccurs="0"`) και η στάθμευση
 * καταχωρείται κανονικά χωρίς αυτό — επαληθεύτηκε στο δοκιμαστικό. Κανένας
 * δεν μένει έξω από το πάρκινγκ.
 *
 * ΤΙ ΕΙΝΑΙ
 * Λίστα ποιότητας δεδομένων. Με έγκυρο ΑΦΜ, η στάθμευση δηλώνεται ως
 * «επαναλαμβανόμενη υπηρεσία» και συνδέεται με τον πελάτη στο πελατολόγιο
 * της ΑΑΔΕ. Χωρίς αυτό, καταγράφεται ως μεμονωμένη — σωστή, αλλά φτωχότερη.
 *
 * ΓΙΑΤΙ ΧΩΡΙΖΟΝΤΑΙ ΣΕ ΔΥΟ ΟΜΑΔΕΣ
 * Οι μισές «ελλείψεις» είναι ιδιώτες, όπου το ERP βάζει 999999999 επειδή δεν
 * υπάρχει ΑΦΜ να μπει. Το να ζητηθεί ΑΦΜ από έναν ιδιώτη είναι άσκοπο. Οι
 * εταιρείες όμως ΕΧΟΥΝ ΑΦΜ, και η απουσία του είναι πραγματικό κενό
 * καταχώρησης που αξίζει τηλέφωνο.
 */

import { prisma } from "@/lib/prisma";
import { activeContractWhere } from "@/lib/contract-active";
import { isValidGreekVat, vatProblem } from "./vat";

export type VatGapRow = {
  inst: number;
  customer: string;
  afm: string;
  problem: string;
  phone: string | null;
  email: string | null;
  plates: string[];
  /** Ιδιώτης κατά πάσα πιθανότητα — η επωνυμία λέει «πελάτης λιανικής». */
  likelyIndividual: boolean;
};

export type VatReport = {
  totalContracts: number;
  withValidVat: number;
  companies: VatGapRow[];
  individuals: VatGapRow[];
};

/** Η επωνυμία δείχνει ιδιώτη και όχι εταιρεία. */
function looksIndividual(name: string): boolean {
  return /ΠΕΛΑΤ(ΗΣ|Η|ΕΣ)\s*ΛΙΑΝΙΚΗΣ|ΙΔΙΩΤΗΣ/i.test(name);
}

export async function buildVatReport(): Promise<VatReport> {
  const contracts = await prisma.iNST.findMany({
    where: { ...activeContractWhere(), lines: { some: {} } },
    select: { INST: true, NAME: true, TRDR: true, lines: { select: { MTRL: true } } },
  });

  const trdrs = [...new Set(contracts.map((c) => c.TRDR).filter(Boolean))] as string[];
  const [customers, items] = await Promise.all([
    trdrs.length
      ? prisma.cUSTORMER.findMany({
          where: { TRDR: { in: trdrs } },
          select: { TRDR: true, NAME: true, AFM: true, PHONE01: true, EMAIL: true },
        })
      : Promise.resolve([]),
    prisma.iTEMS.findMany({ where: { CODE: { not: null } }, select: { MTRL: true, CODE: true } }),
  ]);

  const byTrdr = new Map(customers.map((c) => [c.TRDR, c]));
  const plateByMtrl = new Map(
    items
      .filter((i) => i.MTRL)
      .map((i) => [String(i.MTRL).trim(), (i.CODE ?? "").trim().toUpperCase()])
  );

  const companies: VatGapRow[] = [];
  const individuals: VatGapRow[] = [];
  let withValidVat = 0;

  for (const c of contracts) {
    const cust = c.TRDR ? byTrdr.get(c.TRDR) : null;
    const afm = (cust?.AFM ?? "").trim();
    if (isValidGreekVat(afm)) {
      withValidVat++;
      continue;
    }

    const name = (cust?.NAME ?? c.NAME ?? "—").trim();
    const plates = [
      ...new Set(
        c.lines
          .map((l) => (l.MTRL ? plateByMtrl.get(String(l.MTRL).trim()) : undefined))
          .filter((p): p is string => !!p)
      ),
    ];

    const row: VatGapRow = {
      inst: c.INST,
      customer: name,
      afm: afm || "(κενό)",
      problem: vatProblem(afm) ?? "άγνωστο",
      phone: cust?.PHONE01?.trim() || null,
      email: cust?.EMAIL?.trim() || null,
      plates,
      likelyIndividual: looksIndividual(name),
    };
    (row.likelyIndividual ? individuals : companies).push(row);
  }

  const byName = (a: VatGapRow, b: VatGapRow) => a.customer.localeCompare(b.customer, "el");
  return {
    totalContracts: contracts.length,
    withValidVat,
    companies: companies.sort(byName),
    individuals: individuals.sort(byName),
  };
}
