import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IntegrationsClient } from "@/components/integrations/integrations-client";
import { PageHeader } from "@/components/ui/page-header";

export default async function IntegrationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only allow ADMIN and MANAGER roles
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  // ADMIN: see all integrations in DB. MANAGER: only their own.
  const isAdmin = session.user.role === "ADMIN";
  const integrations = await prisma.softOneIntegration.findMany({
    where: isAdmin ? undefined : { userId: session.user.id },
    include: {
      connection: {
        select: {
          id: true,
          name: true,
          registeredName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // ADMIN: all connections (for wizard). MANAGER: only their own.
  const connections = await prisma.softOneConnection.findMany({
    where: isAdmin ? undefined : { userId: session.user.id },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="SOFTONE INTEGRATIONS"
        highlight="INTEGRATIONS"
        subtitle="Manage your SoftOne ERP integrations and connections"
      />

      <IntegrationsClient
        initialIntegrations={integrations.map((int) => ({
          ...int,
          configJson: (int.configJson ?? {}) as Record<string, any>,
        }))}
        connections={connections}
        userId={session.user.id}
      />
    </div>
  );
}








