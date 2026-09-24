/**
 * Δεδομένα του portal πελατών.
 *
 * ΚΑΝΟΝΑΣ ΑΠΟΜΟΝΩΣΗΣ: κάθε συνάρτηση εδώ ξεκινά από το `userId` της συνεδρίας
 * και καταλήγει στον ΕΝΑ πελάτη που του έχει εγκριθεί. Καμία δεν δέχεται TRDR
 * από το αίτημα — αλλιώς αρκεί μια αλλαγή στο URL για να δει κάποιος τη
 * σύμβαση άλλης εταιρίας.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { authenticateSoftOneAPI, getSoftOneTableData } from "@/lib/softone-api";
import { activeContractWhere, isContractActive } from "@/lib/contract-active";

export type PortalCustomer = {
  trdr: string;
  name: string;
  afm: string | null;
  emails: string[];
};

/** Ο πελάτης που αντιστοιχεί στον συνδεδεμένο χρήστη, ή null αν δεν έχει εγκριθεί. */
export async function getPortalCustomer(userId: string): Promise<PortalCustomer | null> {
  const access = await prisma.customerPortalAccess.findUnique({
    where: { userId },
    select: { trdr: true, status: true, afm: true, matchedName: true },
  });
  if (!access || access.status !== "APPROVED" || !access.trdr) return null;

  const [customer, emails] = await Promise.all([
    prisma.cUSTORMER.findFirst({
      where: { TRDR: access.trdr },
      select: { NAME: true, AFM: true },
    }),
    prisma.customerEmail.findMany({
      where: { trdr: access.trdr },
      orderBy: { isPrimary: "desc" },
      select: { email: true },
    }),
  ]);

  return {
    trdr: access.trdr,
    name: customer?.NAME ?? access.matchedName ?? "—",
    afm: customer?.AFM ?? access.afm,
    emails: emails.map((e) => e.email),
  };
}

export type PortalContract = {
  inst: number;
  name: string | null;
  slots: number | null;
  startsOn: Date | null;
  endsOn: Date | null;
  isActive: boolean;
  /** Πόσες ημέρες μένουν· αρνητικό σημαίνει ληγμένη. */
  daysLeft: number | null;
  plates: string[];
  carsInside: number;
};

/** Οι συμβάσεις του πελάτη, ενεργές πρώτα. */
export async function getPortalContracts(trdr: string): Promise<PortalContract[]> {
  const [contracts, items, contractCars] = await Promise.all([
    prisma.iNST.findMany({
      where: { TRDR: trdr },
      orderBy: { WDATETO: "desc" },
      select: {
        INST: true,
        NAME: true,
        NUM01: true,
        WDATEFROM: true,
        WDATETO: true,
        lines: { select: { MTRL: true } },
      },
    }),
    prisma.iTEMS.findMany({ where: { CODE: { not: null } }, select: { MTRL: true, CODE: true } }),
    prisma.contractCar.findMany({ select: { inst: true, carsIn: true } }),
  ]);

  const plateByMtrl = new Map<string, string>();
  for (const item of items) {
    if (!item.CODE || !item.MTRL) continue;
    const plate = item.CODE.trim().toUpperCase();
    const raw = String(item.MTRL).trim();
    plateByMtrl.set(raw, plate);
    plateByMtrl.set(raw.replace(/^0+/, "") || raw, plate);
  }
  const carsIn = new Map(contractCars.map((c) => [c.inst, c.carsIn]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return contracts.map((c) => {
    const plates = c.lines
      .map((l) => {
        const raw = String(l.MTRL ?? "").trim();
        return plateByMtrl.get(raw) ?? plateByMtrl.get(raw.replace(/^0+/, "") || raw) ?? null;
      })
      .filter((p): p is string => p !== null)
      .sort();

    const daysLeft = c.WDATETO
      ? Math.round((c.WDATETO.getTime() - today.getTime()) / 86_400_000)
      : null;

    return {
      inst: c.INST,
      name: c.NAME,
      slots: c.NUM01 != null ? Number(c.NUM01) : null,
      startsOn: c.WDATEFROM,
      endsOn: c.WDATETO,
      isActive: isContractActive({ WDATETO: c.WDATETO }),
      daysLeft,
      plates: [...new Set(plates)],
      carsInside: carsIn.get(c.INST) ?? 0,
    };
  });
}

export type PortalInvoice = {
  findoc: number;
  code: string;
  date: Date | null;
  amount: number;
  /** Σύνδεσμος του παρόχου ηλεκτρονικής τιμολόγησης — εκεί βρίσκεται το παραστατικό. */
  url: string | null;
};

/** ΤΥΠΟΣ παραστατικού «Τιμολόγιο Παροχής Υπηρεσιών» στην εταιρία του parking. */
const SERVICE_INVOICE_FPRMS = 7167;

/**
 * Τα τιμολόγια του πελάτη για τους τελευταίους μήνες.
 *
 * Ο σύνδεσμος του παραστατικού ζει στον πίνακα `MTRDOC` (`SOSIGNQR`) και όχι
 * στην κεφαλίδα, γι' αυτό γίνονται δύο κλήσεις — όχι μία ανά τιμολόγιο.
 */
export async function getPortalInvoices(trdr: string, months = 12): Promise<PortalInvoice[]> {
  const company = Number(process.env.PARKING_COMPANY ?? 1002);
  const connection = await prisma.softOneConnection.findFirst({ where: { company } });
  if (!connection) throw new Error(`Δεν υπάρχει σύνδεση SoftOne για την εταιρία ${company}.`);

  const auth = await authenticateSoftOneAPI(
    connection.username,
    decrypt(connection.passwordEnc),
    String(connection.appId),
    String(connection.company),
    String(connection.branch),
    String(connection.module),
    String(connection.refid),
    undefined,
    connection.registeredName
  );
  if (!auth.success || !auth.clientID) throw new Error(auth.error || "Αποτυχία ταυτοποίησης SoftOne.");

  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const fromIso = from.toISOString().slice(0, 10);

  const headerFields = "FINDOC,FINCODE,TRNDATE,SUMAMNT";
  const headers = await getSoftOneTableData(
    "FINDOC",
    headerFields,
    auth.clientID,
    connection.appId,
    `COMPANY=${company} AND FPRMS=${SERVICE_INVOICE_FPRMS} AND TRDR=${Number(trdr)} AND TRNDATE>='${fromIso}'`
  );
  if (!headers.success || !headers.data) return [];

  const hCols = headerFields.split(",");
  const invoices = headers.data.map((row: unknown[]) => {
    const r = Object.fromEntries(hCols.map((c, i) => [c, row[i]])) as Record<string, string>;
    return {
      findoc: Number(r.FINDOC) || 0,
      code: r.FINCODE ?? "",
      date: r.TRNDATE ? new Date(r.TRNDATE.replace(" ", "T")) : null,
      amount: Number(r.SUMAMNT) || 0,
      url: null as string | null,
    };
  });
  if (invoices.length === 0) return [];

  // Οι σύνδεσμοι, μαζικά.
  const ids = invoices.map((i) => i.findoc).filter(Boolean);
  const links = await getSoftOneTableData(
    "MTRDOC",
    "FINDOC,SOSIGNQR",
    auth.clientID,
    connection.appId,
    `COMPANY=${company} AND FINDOC IN (${ids.join(",")})`
  );
  if (links.success && links.data) {
    const byDoc = new Map<number, string>();
    for (const row of links.data as unknown[][]) {
      const id = Number(row[0]);
      const url = String(row[1] ?? "");
      if (id && url.startsWith("http")) byDoc.set(id, url);
    }
    for (const inv of invoices) inv.url = byDoc.get(inv.findoc) ?? null;
  }

  return invoices.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
}

/** Συμβάσεις που λήγουν μέσα στις επόμενες Ν ημέρες — για τις ειδοποιήσεις. */
export async function getExpiringContracts(daysAhead: number) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + daysAhead);
  to.setHours(23, 59, 59, 999);

  return prisma.iNST.findMany({
    where: { ...activeContractWhere(), WDATETO: { lte: to }, lines: { some: {} } },
    select: { INST: true, NAME: true, TRDR: true, WDATETO: true, NUM01: true },
    orderBy: { WDATETO: "asc" },
  });
}
