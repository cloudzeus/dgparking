import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscribersClient, type SubscriberRow } from "@/components/newsletter/subscribers-client";

export const dynamic = "force-dynamic";

/** Λίστα συνδρομητών ενημερωτικού δελτίου. */
export default async function NewsletterSubscribersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { recipients: true } } },
  });

  const rows: SubscriberRow[] = subscribers.map((subscriber) => ({
    id: subscriber.id,
    email: subscriber.email,
    firstName: subscriber.firstName,
    lastName: subscriber.lastName,
    locale: subscriber.locale,
    status: subscriber.status,
    source: subscriber.source,
    confirmedAt: subscriber.confirmedAt?.toISOString() ?? null,
    unsubscribedAt: subscriber.unsubscribedAt?.toISOString() ?? null,
    createdAt: subscriber.createdAt.toISOString(),
    campaignCount: subscriber._count.recipients,
  }));

  return (
    <SubscribersClient
      subscribers={rows}
      stats={{
        total: rows.length,
        subscribed: rows.filter((row) => row.status === "SUBSCRIBED").length,
        pending: rows.filter((row) => row.status === "PENDING").length,
        unsubscribed: rows.filter((row) => row.status === "UNSUBSCRIBED").length,
      }}
    />
  );
}
