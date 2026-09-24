import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  allCampaignStats,
  campaignStats,
  clientBreakdown,
  deviceBreakdown,
  eventTimeline,
  recipientDetails,
  topClickedLinks,
} from "@/lib/mailgun-analytics";
import { PageHeader } from "@/components/admin/page";
import { NewsletterStatsClient } from "@/components/newsletter/newsletter-stats-client";
import { StatsSyncButton } from "@/components/newsletter/stats-sync-button";
import type { CampaignRow, NewsletterStatsView } from "@/components/newsletter/stats-types";

export const dynamic = "force-dynamic";

/** Πόσες αποστολές δείχνουν αναλυτικούς παραλήπτες στην ανοιχτή γραμμή. */
const DETAILED_CAMPAIGNS = 12;

export default async function NewsletterStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const campaigns = await allCampaignStats();
  const requested = params.campaign;
  const selectedCampaignId = requested && campaigns.some((c) => c.id === requested) ? requested : null;

  const scope = selectedCampaignId ?? undefined;
  const listed = selectedCampaignId
    ? campaigns.filter((c) => c.id === selectedCampaignId)
    : campaigns;

  const [totals, timeline, topLinks, clients, devices, eventCount, details] = await Promise.all([
    campaignStats(scope),
    eventTimeline(scope),
    topClickedLinks(scope),
    clientBreakdown(scope),
    deviceBreakdown(scope),
    prisma.newsletterEvent.count({ where: scope ? { campaignId: scope } : {} }),
    Promise.all(
      listed.slice(0, DETAILED_CAMPAIGNS).map(async (c) => ({
        id: c.id,
        rows: await recipientDetails(c.id),
      })),
    ),
  ]);

  const detailsById = new Map(details.map((d) => [d.id, d.rows]));

  const rows: CampaignRow[] = listed.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: c.status,
    sentAt: c.sentAt?.toISOString() ?? null,
    stats: c.stats,
    recipients: (detailsById.get(c.id) ?? []).map((r) => ({
      email: r.email,
      delivered: r.delivered,
      opens: r.opens,
      clicks: r.clicks,
      failed: r.failed,
      lastActivity: r.lastActivity?.toISOString() ?? null,
    })),
  }));

  const view: NewsletterStatsView = {
    selectedCampaignId,
    options: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      sent: c.stats.sent,
      openRate: c.stats.openRate,
    })),
    totals,
    campaigns: rows,
    timeline,
    topLinks,
    clients,
    devices,
    hasEvents: eventCount > 0,
  };

  return (
    <>
      <PageHeader
        title="Στατιστικά ενημερωτικού δελτίου"
        description="Παραδόσεις, ανοίγματα, κλικ και προβλήματα ανά αποστολή, από τα συμβάντα του Mailgun."
        icon={BarChart3}
        actions={<StatsSyncButton campaignId={selectedCampaignId} />}
      />
      <NewsletterStatsClient view={view} />
    </>
  );
}
