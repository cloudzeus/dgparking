import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignComposer } from "@/components/newsletter/campaign-composer";
import { readCampaignContent, unsubscribeUrl } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

/** Επεξεργασία (ή προβολή, όταν έχει σταλεί) μιας εκστρατείας. */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const { id } = await params;

  const [campaign, subscriberCount] = await Promise.all([
    prisma.newsletterCampaign.findUnique({ where: { id } }),
    prisma.newsletterSubscriber.count({ where: { status: "SUBSCRIBED" } }),
  ]);

  if (!campaign) notFound();

  const content = readCampaignContent(campaign.contentJson);

  return (
    <CampaignComposer
      subscriberCount={subscriberCount}
      previewUnsubscribeUrl={unsubscribeUrl("preview")}
      campaign={{
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        preheader: campaign.preheader ?? "",
        template: campaign.template,
        locale: campaign.locale === "en" ? "en" : "el",
        contentHtml: content.html,
        ctaLabel: content.ctaLabel ?? "",
        ctaUrl: content.ctaUrl ?? "",
        heroImageUrl: content.heroImageUrl ?? "",
        status: campaign.status,
        sentAt: campaign.sentAt?.toISOString() ?? null,
        totalRecipients: campaign.totalRecipients,
      }}
    />
  );
}
