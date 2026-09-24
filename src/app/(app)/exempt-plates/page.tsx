import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page";
import { ExemptPlatesClient, type ExemptPlateDTO } from "@/components/exempt/exempt-plates-client";
import { ShieldOff } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ExemptPlatesPage() {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const plates = await prisma.exemptPlate.findMany({
    orderBy: [{ isActive: "desc" }, { category: "asc" }, { plate: "asc" }],
  });

  const rows: ExemptPlateDTO[] = plates.map((p) => ({
    id: p.id,
    plate: p.plate,
    category: p.category,
    note: p.note,
    isActive: p.isActive,
    validFrom: p.validFrom.toLocaleDateString("el-GR"),
    validUntil: p.validUntil ? p.validUntil.toLocaleDateString("el-GR") : null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Απαλλαγμένες πινακίδες"
        description="Οχήματα που δεν χρεώνονται — προσωπικό, ιδιοκτήτες, συνεργάτες. Η απαλλαγή ισχύει από την ημέρα καταχώρησης και μετά."
        icon={ShieldOff}
      />
      <ExemptPlatesClient plates={rows} />
    </div>
  );
}
