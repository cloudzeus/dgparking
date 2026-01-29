import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersClient } from "@/components/customers/customers-client";
import type { Role } from "@prisma/client";

export default async function CustomersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN, MANAGER, and EMPLOYEE can access
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const customers = await prisma.cUSTORMER.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <CustomersClient customers={customers} currentUserRole={session.user.role} />;
}

