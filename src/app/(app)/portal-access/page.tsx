import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeContractWhere } from "@/lib/contract-active";
import { PageHeader } from "@/components/admin/page";
import { PortalAccessClient, type AccessRequestDTO } from "@/components/portal/portal-access-client";
import { UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PortalAccessPage() {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const requests = await prisma.customerPortalAccess.findMany({
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    include: {
      user: { select: { email: true, firstName: true, lastName: true, isActive: true } },
    },
  });

  // Πόσες ενεργές συμβάσεις έχει ο κάθε υποψήφιος πελάτης — ο διαχειριστής
  // πρέπει να βλέπει αν το αίτημα αφορά πραγματικό συνδρομητή πριν εγκρίνει.
  const trdrs = [...new Set(requests.map((r) => r.trdr).filter(Boolean) as string[])];
  const contracts = trdrs.length
    ? await prisma.iNST.groupBy({
        by: ["TRDR"],
        where: { TRDR: { in: trdrs }, ...activeContractWhere() },
        _count: { _all: true },
      })
    : [];
  const contractsByTrdr = new Map(contracts.map((c) => [c.TRDR!, c._count._all]));

  const rows: AccessRequestDTO[] = requests.map((r) => ({
    id: r.id,
    status: r.status,
    afm: r.afm,
    trdr: r.trdr,
    matchedName: r.matchedName,
    activeContracts: r.trdr ? contractsByTrdr.get(r.trdr) ?? 0 : 0,
    fullName: [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || "—",
    email: r.user.email,
    accountActive: r.user.isActive,
    requestedAt: r.requestedAt.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" }),
    decidedAt: r.decidedAt
      ? r.decidedAt.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })
      : null,
    note: r.note,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Αιτήματα πρόσβασης πελατών"
        description="Έγκριση λογαριασμών για το portal. Το ΑΦΜ είναι δημόσια πληροφορία — επιβεβαιώστε ότι ο χρήστης εκπροσωπεί πράγματι τον πελάτη πριν εγκρίνετε."
        icon={UserCheck}
      />
      <PortalAccessClient requests={rows} />
    </div>
  );
}
