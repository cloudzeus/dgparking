import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeContractWhere } from "@/lib/contract-active";
import { PageHeader } from "@/components/admin/page";
import {
  ContractRequestsClient,
  type ChangeRequestDTO,
  type CapacityDTO,
} from "@/components/contracts/contract-requests-client";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isEmpty = (m: string | null) => {
  const v = String(m ?? "").trim();
  return v === "" || v === "0";
};

export default async function ContractRequestsPage() {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const [requests, activeContracts] = await Promise.all([
    prisma.contractChangeRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    }),
    prisma.iNST.findMany({
      where: { ...activeContractWhere(), lines: { some: {} } },
      select: { INST: true, NAME: true, NUM01: true, lines: { select: { MTRL: true } } },
      orderBy: { INST: "asc" },
    }),
  ]);

  // Χωρητικότητα ανά σύμβαση: πόσες γραμμές έχουν πινακίδα και πόσες είναι
  // κενές. Οι κενές είναι διαθέσιμες θέσεις — εκεί μπαίνουν οι νέες πινακίδες
  // αντί να μεγαλώνει η σύμβαση.
  const capacity: CapacityDTO[] = activeContracts
    .map((c) => {
      const filled = c.lines.filter((l) => !isEmpty(l.MTRL)).length;
      const empty = c.lines.filter((l) => isEmpty(l.MTRL)).length;
      return {
        inst: c.INST,
        name: c.NAME,
        slots: c.NUM01 != null ? Number(c.NUM01) : null,
        filled,
        empty,
      };
    })
    .filter((c) => c.empty > 0)
    .sort((a, b) => b.empty - a.empty);

  const capacityByInst = new Map(capacity.map((c) => [c.inst, c]));

  const rows: ChangeRequestDTO[] = requests.map((r) => ({
    id: r.id,
    inst: r.inst,
    type: r.type,
    plate: r.plate,
    slots: r.slots,
    newPeriod:
      r.newStartDate && r.newEndDate
        ? `${r.newStartDate.toLocaleDateString("el-GR")} — ${r.newEndDate.toLocaleDateString("el-GR")}`
        : null,
    newName: r.newName,
    status: r.status,
    createdAt: r.createdAt.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }),
    requester: [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || r.user.email,
    error: r.error,
    note: r.note,
    emptyLines: capacityByInst.get(r.inst)?.empty ?? 0,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Αιτήματα συμβάσεων"
        description="Έγκριση αλλαγών που ζητούν οι πελάτες. Η έγκριση γράφει απευθείας στο SoftOne — ελέγξτε πριν πατήσετε."
        icon={ClipboardCheck}
      />
      <ContractRequestsClient requests={rows} capacity={capacity} />
    </div>
  );
}
