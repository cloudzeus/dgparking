import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CronLogsClient } from "@/components/account/cron-logs-client";

export default async function CronLogsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and MANAGER can access
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Fetch all cron job logs for the user
  // For ADMIN, also include logs from integrations they own (even if different userId)
  const whereClause = session.user.role === "ADMIN"
    ? {
        // Admin can see all logs from their integrations
        OR: [
          { userId: session.user.id },
          {
            integration: {
              userId: session.user.id,
            },
          },
        ],
      }
    : {
        userId: session.user.id,
      };

  const logs = await prisma.cronJobLog.findMany({
    where: whereClause,
    include: {
      integration: {
        select: {
          id: true,
          name: true,
          objectName: true,
          tableName: true,
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  // Debug: Log how many logs were found and check for any logs in the system
  const totalLogsCount = await prisma.cronJobLog.count();
  console.log(`[CRON-LOGS] Found ${logs.length} logs for user ${session.user.id} (role: ${session.user.role}), total logs in system: ${totalLogsCount}`);
  
  // Also check if there are any logs for integrations owned by this user
  const userIntegrations = await prisma.softOneIntegration.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true },
  });
  console.log(`[CRON-LOGS] User has ${userIntegrations.length} integrations`);
  
  if (userIntegrations.length > 0) {
    const integrationIds = userIntegrations.map(i => i.id);
    const logsForUserIntegrations = await prisma.cronJobLog.count({
      where: {
        integrationId: { in: integrationIds },
      },
    });
    console.log(`[CRON-LOGS] Found ${logsForUserIntegrations} logs for user's integrations`);
  }

  return (
    <CronLogsClient
      logs={logs}
      currentUserRole={session.user.role}
    />
  );
}


