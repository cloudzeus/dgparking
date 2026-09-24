import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPortalCustomer,
  getPortalContracts,
  getPortalInvoices,
  type PortalInvoice,
} from "@/lib/portal-data";
import { ClientPortal, type ContractDTO, type InvoiceDTO, type RequestDTO } from "@/components/portal/client-portal";

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

  const contractRows: ContractDTO[] = contracts.map((c) => ({
    inst: c.inst,
    name: c.name,
    slots: c.slots,
    startsOn: fmtDate(c.startsOn),
    endsOn: fmtDate(c.endsOn),
    isActive: c.isActive,
    daysLeft: c.daysLeft,
    plates: c.plates,
    carsInside: c.carsInside,
  }));

  const invoiceRows: InvoiceDTO[] = invoices.map((i) => ({
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

  return (
    <ClientPortal
      customerName={customer.name}
      afm={customer.afm}
      contracts={contractRows}
      invoices={invoiceRows}
      invoiceError={invoiceError}
      requests={requestRows}
    />
  );
}
