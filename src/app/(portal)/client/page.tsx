import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPortalGateBook } from "@/lib/portal-gatebook";
import {
  getPortalCustomer,
  getPortalContracts,
  getPortalInvoices,
  type PortalInvoice,
} from "@/lib/portal-data";
import { ClientPortal, type ContractDTO, type InvoiceDTO, type RequestDTO } from "@/components/portal/client-portal";
import { nextContractPeriod, proposedContractName, formatPeriod } from "@/lib/contract-period";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export default async function ClientPortalPage() {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customer = await getPortalCustomer(session.user.id as string);
  if (!customer) return null; // το layout εμφανίζει το μήνυμα αναμονής

  const [contracts, requests] = await Promise.all([
    getPortalContracts(customer.trdr),
    prisma.contractChangeRequest.findMany({
      where: { userId: session.user.id as string },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Τα τιμολόγια έρχονται από το ERP· αν η σύνδεση πέσει, η σελίδα πρέπει να
  // συνεχίσει να δείχνει σύμβαση και πινακίδες αντί να αποτύχει ολόκληρη.
  let invoices: PortalInvoice[] = [];
  let invoiceError: string | null = null;
  try {
    invoices = await getPortalInvoices(customer.trdr, 12);
  } catch (e) {
    invoiceError = e instanceof Error ? e.message : "Τα τιμολόγια δεν φορτώθηκαν.";
    console.error("[PORTAL] Αποτυχία ανάκτησης τιμολογίων:", e);
  }

  // Οι δηλωμένοι οδηγοί ανά πινακίδα — δικό μας πεδίο, εκτός SoftOne.
  const driverRows = await prisma.plateDriver.findMany({ where: { trdr: customer.trdr } });
  const drivers = Object.fromEntries(driverRows.map((d) => [d.plate, d.driverName]));

  const contractRows: ContractDTO[] = contracts.map((c) => {
    const period = nextContractPeriod(c.startsOn, c.endsOn);
    return {
      inst: c.inst,
      name: c.name,
      slots: c.slots,
      startsOn: fmtDate(c.startsOn),
      endsOn: fmtDate(c.endsOn),
      isActive: c.isActive,
      daysLeft: c.daysLeft,
      drivers,
      plates: c.plates,
      carsInside: c.carsInside,
      nextPeriod: formatPeriod(period),
      nextName: proposedContractName(c.name ?? customer.name, period),
    };
  });

  const invoiceRows: InvoiceDTO[] = invoices.map((i) => ({
    findoc: i.findoc,
    code: i.code,
    date: fmtDate(i.date),
    amount: i.amount,
    url: i.url,
  }));

  const requestRows: RequestDTO[] = requests.map((r) => ({
    id: r.id,
    inst: r.inst,
    type: r.type,
    plate: r.plate,
    slots: r.slots,
    status: r.status,
    createdAt: r.createdAt.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }),
    error: r.error,
  }));

  // Οι κινήσεις αφορούν τις πινακίδες ΟΛΩΝ των ενεργών συμβάσεων του πελάτη:
  // το όχημα είναι ένα, η σύμβαση κάτω από την οποία μπήκε δεν τον ενδιαφέρει.
  const gateBook = await getPortalGateBook(
    contractRows.filter((c) => c.isActive).flatMap((c) => c.plates)
  );

  return (
    <ClientPortal
      customerName={customer.name}
      afm={customer.afm}
      contracts={contractRows}
      invoices={invoiceRows}
      invoiceError={invoiceError}
      requests={requestRows}
      gateBook={gateBook}
    />
  );
}
