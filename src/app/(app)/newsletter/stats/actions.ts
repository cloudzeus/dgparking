"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncCampaignEvents } from "@/lib/mailgun-analytics";

/**
 * Ενέργειες της σελίδας «Στατιστικά ενημερωτικού δελτίου».
 * Ζουν εδώ και όχι στο `lib/actions/newsletter.ts`, που ανήκει στις αποστολές.
 */

export type SyncState = { ok: boolean; message: string };

/**
 * «Ανανέωση από Mailgun»: κατεβάζει τα συμβάντα μίας αποστολής ή όλων των
 * σταλμένων και τα γράφει στη βάση (η εγγραφή είναι επαναληπτική — δεν
 * δημιουργεί διπλότυπα).
 */
export async function syncNewsletterStats(campaignId?: string): Promise<SyncState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, message: "Δεν έχεις δικαίωμα σε αυτή την ενέργεια." };
  }

  const campaigns = campaignId
    ? [{ id: campaignId }]
    : await prisma.newsletterCampaign.findMany({
        where: { status: { in: ["SENT", "SENDING"] } },
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        select: { id: true },
        take: 10,
      });

  if (campaigns.length === 0) {
    return { ok: false, message: "Δεν υπάρχει καμία αποστολή για ανανέωση." };
  }

  let stored = 0;
  const errors: string[] = [];

  for (const campaign of campaigns) {
    const result = await syncCampaignEvents(campaign.id);
    if (result.ok) {
      stored += result.data.stored;
    } else {
      errors.push(result.error);
    }
  }

  revalidatePath("/newsletter/stats");

  if (errors.length > 0 && stored === 0) {
    return { ok: false, message: errors[0] };
  }

  const suffix = errors.length > 0 ? ` (${errors.length} αποστολές δεν ανανεώθηκαν)` : "";
  return {
    ok: true,
    message:
      stored > 0
        ? `Καταγράφηκαν ${stored.toLocaleString("el-GR")} νέα συμβάντα.${suffix}`
        : `Δεν υπήρχαν νέα συμβάντα.${suffix}`,
  };
}
