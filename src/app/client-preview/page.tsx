import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPortalGateBook } from "@/lib/portal-gatebook";
import { activeContractWhere } from "@/lib/contract-active";
import { nextContractPeriod, proposedContractName, formatPeriod } from "@/lib/contract-period";
import { ClientPortal, type ContractDTO, type InvoiceDTO, type RequestDTO } from "@/components/portal/client-portal";
import { PortalShell } from "@/components/portal/portal-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye } from "lucide-react";

/**
 * Προεπισκόπηση του portal πελατών, για το προσωπικό.
 *
 * Υπάρχει για να εγκριθεί η διεπαφή ΠΡΙΝ δοθεί πρόσβαση σε πελάτη και πριν
 * γίνει οποιαδήποτε δοκιμή σε ζωντανή σύμβαση. Δείχνει πραγματικά δεδομένα
 * μιας ενεργής σύμβασης, αλλά ΚΑΝΕΝΑ κουμπί δεν εκτελεί ενέργεια.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const isEmpty = (m: string | null) => {
  const v = String(m ?? "").trim();
  return v === "" || v === "0";
};

export default async function ClientPreviewPage() {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  // Μια πραγματική ενεργή σύμβαση με πινακίδες, ώστε η εικόνα να είναι αληθινή.
  const contract = await prisma.iNST.findFirst({
    where: { ...activeContractWhere(), lines: { some: {} } },
    orderBy: { INST: "desc" },
    select: {
      INST: true,
      NAME: true,
      NUM01: true,
      TRDR: true,
      WDATEFROM: true,
      WDATETO: true,
      lines: { select: { MTRL: true } },
    },
  });

  if (!contract) {
    return (
      <Alert>
        <Eye />
        <AlertTitle>Δεν βρέθηκε ενεργή σύμβαση για προεπισκόπηση</AlertTitle>
        <AlertDescription>Χρειάζεται τουλάχιστον μία ενεργή σύμβαση με πινακίδες.</AlertDescription>
      </Alert>
    );
  }

  const [customer, items] = await Promise.all([
    contract.TRDR
      ? prisma.cUSTORMER.findFirst({ where: { TRDR: contract.TRDR }, select: { NAME: true, AFM: true } })
      : null,
    prisma.iTEMS.findMany({ where: { CODE: { not: null } }, select: { MTRL: true, CODE: true } }),
  ]);

  const plateByMtrl = new Map(
    items.filter((i) => i.MTRL).map((i) => [String(i.MTRL).trim(), (i.CODE ?? "").trim().toUpperCase()])
  );
  const plates = [
    ...new Set(
      contract.lines
        .filter((l) => !isEmpty(l.MTRL))
        .map((l) => plateByMtrl.get(String(l.MTRL).trim()))
        .filter((p): p is string => !!p)
    ),
  ].sort();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = contract.WDATETO
    ? Math.round((contract.WDATETO.getTime() - today.getTime()) / 86_400_000)
    : null;
  const period = nextContractPeriod(contract.WDATEFROM, contract.WDATETO);

  // Πραγματικές κινήσεις των πινακίδων της σύμβασης — η προεπισκόπηση δείχνει
  // ακριβώς ό,τι θα δει ο πελάτης, όχι δείγμα.
  const gateBook = await getPortalGateBook(plates);

  const contracts: ContractDTO[] = [
    {
      inst: contract.INST,
      name: contract.NAME,
      slots: contract.NUM01 != null ? Number(contract.NUM01) : null,
      startsOn: fmtDate(contract.WDATEFROM),
      endsOn: fmtDate(contract.WDATETO),
      isActive: true,
      daysLeft,
      plates,
      carsInside: gateBook.insideCount,
      nextPeriod: formatPeriod(period),
      nextName: proposedContractName(contract.NAME ?? customer?.NAME ?? "", period),
    },
  ];

  // Δείγματα τιμολογίων και αιτημάτων — δεν αγγίζουμε το ERP για προεπισκόπηση.
  const invoices: InvoiceDTO[] = [
    { code: "ΤΠΥ0000381", date: "31/08/2026", amount: 360, url: "https://einvoice.impact.gr/" },
    { code: "ΤΠΥ0000348", date: "02/08/2026", amount: 360, url: "https://einvoice.impact.gr/" },
    { code: "ΤΠΥ0000305", date: "30/06/2026", amount: 360, url: null },
  ];

  const requests: RequestDTO[] = [
    {
      id: "preview-1",
      inst: contract.INST,
      type: "ADD_PLATE",
      plate: "ΙΚΑ4707",
      slots: null,
      status: "PENDING",
      createdAt: "σήμερα 13:40",
      error: null,
    },
    {
      id: "preview-2",
      inst: contract.INST,
      type: "REMOVE_PLATE",
      plate: plates[0] ?? "ΧΕΙ6052",
      slots: null,
      status: "APPLIED",
      createdAt: "χθες 09:15",
      error: null,
    },
  ];

  const name = customer?.NAME ?? contract.NAME ?? "Πελάτης";

  return (
    <PortalShell
      customerName={name}
      // Η προεπισκόπηση τρέχει με τη συνεδρία του προσωπικού· ένα κουμπί
      // αποσύνδεσης εδώ θα πετούσε έξω τον διαχειριστή που την εξετάζει.
      showLogout={false}
      banner={
        <Alert className="mb-4">
          <Eye />
          <AlertTitle>Προεπισκόπηση — ακριβώς η οθόνη του πελάτη</AlertTitle>
          <AlertDescription>
            Σύμβαση {contract.INST} · {plates.length} πινακίδες, με πραγματικά δεδομένα και
            πραγματικές κινήσεις. Τα τιμολόγια και τα αιτήματα είναι δείγματα και καμία
            ενέργεια δεν εκτελείται.
          </AlertDescription>
        </Alert>
      }
    >
      <ClientPortal
        customerName={name}
        afm={customer?.AFM ?? null}
        contracts={contracts}
        invoices={invoices}
        invoiceError={null}
        gateBook={gateBook}
        requests={requests}
        readOnly
      />
    </PortalShell>
  );
}
