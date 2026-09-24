import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CampaignComposer } from "@/components/newsletter/campaign-composer";
import { unsubscribeUrl } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

/** Νέα εκστρατεία — κενό πρόχειρο. */
export default async function NewCampaignPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const subscriberCount = await prisma.newsletterSubscriber.count({ where: { status: "SUBSCRIBED" } });

  return (
    <CampaignComposer
      subscriberCount={subscriberCount}
      previewUnsubscribeUrl={unsubscribeUrl("preview")}
      campaign={{
        id: null,
        name: "",
        subject: "",
        preheader: "",
        template: "announcement",
        locale: "el",
        contentHtml: "",
        ctaLabel: "",
        ctaUrl: "",
        heroImageUrl: "",
        status: "DRAFT",
        sentAt: null,
        totalRecipients: 0,
      }}
    />
  );
}
