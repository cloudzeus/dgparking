import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignsClient, type CampaignRow } from "@/components/newsletter/campaigns-client";

export const dynamic = "force-dynamic";

/** Λίστα εκστρατειών ενημερωτικού δελτίου. */
export default async function NewsletterCampaignsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const [campaigns, subscriberCount] = await Promise.all([
    prisma.newsletterCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { recipients: true } } },
    }),
    prisma.newsletterSubscriber.count({ where: { status: "SUBSCRIBED" } }),
  ]);

  // Αποτυχίες ανά εκστρατεία: όσοι παραλήπτες κράτησαν μήνυμα σφάλματος.
  const failures = await prisma.newsletterRecipient.groupBy({
    by: ["campaignId"],
    where: { error: { not: null } },
    _count: { _all: true },
  });
  const failuresByCampaign = new Map(failures.map((row) => [row.campaignId, row._count._all]));

  const rows: CampaignRow[] = campaigns.map((campaign) => {
    const failed = failuresByCampaign.get(campaign.id) ?? 0;
    return {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      preheader: campaign.preheader,
      template: campaign.template,
      status: campaign.status,
      locale: campaign.locale,
      totalRecipients: campaign.totalRecipients,
      deliveredCount: Math.max(campaign._count.recipients - failed, 0),
      failedCount: failed,
      sentAt: campaign.sentAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
    };
  });

  return (
    <CampaignsClient
      campaigns={rows}
      stats={{
        campaigns: rows.length,
        subscribers: subscriberCount,
        sent: rows.filter((row) => row.status === "SENT").length,
        drafts: rows.filter((row) => row.status === "DRAFT").length,
      }}
    />
  );
}
