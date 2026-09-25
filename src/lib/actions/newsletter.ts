"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMailgunConfig, sendWithMailgun, type MailgunConfig } from "@/lib/mailgun";
import { logConsent } from "@/lib/gdpr";
import {
  NEWSLETTER_CONSENT_TEXT,
  appBaseUrl,
  newSubscriberToken,
  readCampaignContent,
  unsubscribeUrl,
  personalizeUrl,
} from "@/lib/newsletter";
import { renderNewsletter, renderNewsletterText } from "@/emails/newsletters";
import type { CampaignStatus } from "@prisma/client";

/**
 * Ενέργειες ενημερωτικού δελτίου.
 *
 * Η αποστολή γίνεται εδώ και όχι σε route handler, ώστε να τρέχει με τη
 * συνεδρία του χρήστη και να ανανεώνει μόνη της τις σελίδες.
 */

export type NewsletterFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  /** Το id της εκστρατείας μετά από αποθήκευση — ο επεξεργαστής κάνει redirect. */
  campaignId?: string;
};

/** Δελτία γράφουν και στέλνουν διαχειριστές και υπεύθυνοι. */
async function requireStaff() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Δεν έχεις δικαίωμα σε αυτή την ενέργεια.");
  }
  return session.user;
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

const campaignSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Δώσε ένα όνομα στην εκστρατεία.").max(255),
  subject: z.string().trim().min(1, "Συμπλήρωσε το θέμα του email.").max(255),
  preheader: z.string().trim().max(255).optional(),
  template: z.string().trim().min(1),
  locale: z.enum(["el", "en"]),
  contentHtml: z.string().trim().min(1, "Το περιεχόμενο είναι κενό."),
  ctaLabel: z.string().trim().max(120).optional(),
  ctaUrl: z.string().trim().max(500).optional(),
  heroImageUrl: z.string().trim().max(500).optional(),
  /** Μία εικόνα ανά ενότητα· `null` = ενότητα χωρίς εικόνα. */
  featureImageUrls: z.array(z.string().trim().max(500).nullable()).optional(),
});

type CampaignInput = z.infer<typeof campaignSchema>;

function parseCampaign(formData: FormData) {
  return campaignSchema.safeParse({
    id: formData.get("id")?.toString() || undefined,
    name: formData.get("name")?.toString() ?? "",
    subject: formData.get("subject")?.toString() ?? "",
    preheader: formData.get("preheader")?.toString() || undefined,
    template: formData.get("template")?.toString() ?? "announcement",
    locale: (formData.get("locale")?.toString() as "el" | "en") ?? "el",
    contentHtml: formData.get("contentHtml")?.toString() ?? "",
    ctaLabel: formData.get("ctaLabel")?.toString() || undefined,
    ctaUrl: formData.get("ctaUrl")?.toString() || undefined,
    heroImageUrl: formData.get("heroImageUrl")?.toString() || undefined,
    // Οι εικόνες ενοτήτων δεν έχουν ακόμα πεδίο στον επεξεργαστή· μπαίνουν
    // προγραμματιστικά στο `contentJson`. Το `undefined` εδώ δεν τις σβήνει:
    // η αποθήκευση διαβάζει ό,τι υπάρχει ήδη.
    featureImageUrls: undefined,
  });
}

/** Το HTML που θα φύγει, με τον σύνδεσμο διαγραφής του συγκεκριμένου παραλήπτη. */
function buildHtml(input: CampaignInput, token: string): string {
  return renderNewsletter(input.template, {
    title: input.subject,
    preheader: input.preheader ?? "",
    contentHtml: input.contentHtml,
    ctaLabel: input.ctaLabel,
    ctaUrl: personalizeUrl(input.ctaUrl, token),
    heroImageUrl: input.heroImageUrl,
    featureImageUrls: input.featureImageUrls,
    unsubscribeUrl: unsubscribeUrl(token),
  });
}

function buildText(input: CampaignInput, token: string): string {
  return renderNewsletterText({
    title: input.subject,
    preheader: input.preheader ?? "",
    contentHtml: input.contentHtml,
    ctaLabel: input.ctaLabel,
    ctaUrl: personalizeUrl(input.ctaUrl, token),
    heroImageUrl: input.heroImageUrl,
    featureImageUrls: input.featureImageUrls,
    unsubscribeUrl: unsubscribeUrl(token),
  });
}

/** Αποθήκευση προχείρου — δημιουργία ή ενημέρωση. */
export async function saveCampaign(
  _prev: NewsletterFormState | undefined,
  formData: FormData,
): Promise<NewsletterFormState> {
  let user;
  try {
    user = await requireStaff();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const parsed = parseCampaign(formData);
  if (!parsed.success) {
    return { error: "Έλεγξε τα πεδία της φόρμας.", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const input = parsed.data;

  const buildData = (featureImageUrls?: (string | null)[]) => ({
    name: input.name,
    subject: input.subject,
    preheader: input.preheader ?? null,
    template: input.template,
    locale: input.locale,
    contentJson: {
      html: input.contentHtml,
      ctaLabel: input.ctaLabel ?? "",
      ctaUrl: input.ctaUrl ?? "",
      heroImageUrl: input.heroImageUrl ?? "",
      ...(featureImageUrls ? { featureImageUrls } : {}),
    },
  });

  try {
    if (input.id) {
      const existing = await prisma.newsletterCampaign.findUnique({ where: { id: input.id } });
      if (!existing) return { error: "Η εκστρατεία δεν βρέθηκε." };
      if (existing.status === "SENT" || existing.status === "SENDING") {
        return { error: "Η εκστρατεία έχει ήδη σταλεί και δεν αλλάζει." };
      }
      // Οι εικόνες ενοτήτων δεν έχουν πεδίο στη φόρμα. Η αποθήκευση γράφει
      // ολόκληρο το `contentJson`, οπότε χωρίς αυτό μια απλή διόρθωση
      // κειμένου θα τις έσβηνε σιωπηλά.
      const kept =
        input.featureImageUrls ?? readCampaignContent(existing.contentJson).featureImageUrls;
      await prisma.newsletterCampaign.update({
        where: { id: input.id },
        data: buildData(kept),
      });
    } else {
      const created = await prisma.newsletterCampaign.create({
        data: { ...buildData(input.featureImageUrls), createdById: user.id },
      });
      revalidatePath("/newsletter");
      return { success: "Το πρόχειρο αποθηκεύτηκε.", campaignId: created.id };
    }
  } catch (error) {
    console.error("[NEWSLETTER] save failed:", error);
    return { error: "Η αποθήκευση απέτυχε." };
  }

  revalidatePath("/newsletter");
  revalidatePath(`/newsletter/${input.id}`);
  return { success: "Το πρόχειρο αποθηκεύτηκε.", campaignId: input.id };
}

/** Δοκιμαστική αποστολή σε μία διεύθυνση — δεν αγγίζει τους συνδρομητές. */
export async function sendTestNewsletter(
  _prev: NewsletterFormState | undefined,
  formData: FormData,
): Promise<NewsletterFormState> {
  try {
    await requireStaff();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const parsed = parseCampaign(formData);
  if (!parsed.success) {
    return { error: "Έλεγξε τα πεδία της φόρμας.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const to = formData.get("testEmail")?.toString().trim() ?? "";
  const emailCheck = z.email().safeParse(to);
  if (!emailCheck.success) {
    return { error: "Η διεύθυνση δοκιμής δεν είναι έγκυρη.", fieldErrors: { testEmail: "Μη έγκυρη διεύθυνση." } };
  }

  const config = await getMailgunConfig();
  if (!config) return { error: "Δεν έχουν οριστεί ρυθμίσεις Mailgun." };
  if (!config.isActive) return { error: "Η αποστολή email μέσω Mailgun είναι απενεργοποιημένη." };

  const token = "preview";
  const result = await sendWithMailgun(config, {
    to,
    subject: `[Δοκιμή] ${parsed.data.subject}`,
    text: buildText(parsed.data, token),
    html: buildHtml(parsed.data, token),
    headers: { "List-Unsubscribe": `<${unsubscribeUrl(token)}>` },
  });

  return result.success
    ? { success: `Το δοκιμαστικό δελτίο στάλθηκε στο ${to}.` }
    : { error: result.error };
}

/** Πόσα μηνύματα φεύγουν ταυτόχρονα — το Mailgun αντέχει άνετα 20. */
const BATCH_SIZE = 20;
/** Μικρή ανάσα ανάμεσα στις παρτίδες, για να μη χτυπήσουμε όριο ρυθμού. */
const BATCH_PAUSE_MS = 400;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function sendToSubscriber(
  config: MailgunConfig,
  campaignId: string,
  input: CampaignInput,
  subscriber: { id: string; email: string; token: string },
): Promise<boolean> {
  const link = unsubscribeUrl(subscriber.token);
  const result = await sendWithMailgun(config, {
    to: subscriber.email,
    subject: input.subject,
    text: buildText(input, subscriber.token),
    html: buildHtml(input, subscriber.token),
    headers: {
      "List-Unsubscribe": `<${link}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  await prisma.newsletterRecipient.upsert({
    where: { campaignId_subscriberId: { campaignId, subscriberId: subscriber.id } },
    create: {
      campaignId,
      subscriberId: subscriber.id,
      email: subscriber.email,
      messageId: result.success ? result.id : null,
      error: result.success ? null : result.error,
    },
    update: {
      messageId: result.success ? result.id : null,
      error: result.success ? null : result.error,
    },
  });

  return result.success;
}

/** Αποστολή σε όλους τους εγγεγραμμένους συνδρομητές. */
export async function sendCampaign(
  _prev: NewsletterFormState | undefined,
  formData: FormData,
): Promise<NewsletterFormState> {
  try {
    await requireStaff();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const id = formData.get("id")?.toString().trim();
  if (!id) return { error: "Αποθήκευσε πρώτα την εκστρατεία." };

  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) return { error: "Η εκστρατεία δεν βρέθηκε." };
  if (campaign.status === "SENT") return { error: "Η εκστρατεία έχει ήδη σταλεί." };
  if (campaign.status === "SENDING") return { error: "Η αποστολή βρίσκεται ήδη σε εξέλιξη." };

  const content = readCampaignContent(campaign.contentJson);
  const input: CampaignInput = {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    preheader: campaign.preheader ?? undefined,
    template: campaign.template,
    locale: campaign.locale === "en" ? "en" : "el",
    contentHtml: content.html,
    ctaLabel: content.ctaLabel,
    ctaUrl: content.ctaUrl,
    heroImageUrl: content.heroImageUrl,
    featureImageUrls: content.featureImageUrls,
  };

  if (!input.contentHtml.trim()) return { error: "Το περιεχόμενο είναι κενό." };

  const config = await getMailgunConfig();
  if (!config) return { error: "Δεν έχουν οριστεί ρυθμίσεις Mailgun." };
  if (!config.isActive) return { error: "Η αποστολή email μέσω Mailgun είναι απενεργοποιημένη." };

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: "SUBSCRIBED" },
    select: { id: true, email: true, token: true },
    orderBy: { createdAt: "asc" },
  });

  if (subscribers.length === 0) return { error: "Δεν υπάρχουν εγγεγραμμένοι συνδρομητές." };

  await prisma.newsletterCampaign.update({
    where: { id },
    data: { status: "SENDING", totalRecipients: subscribers.length },
  });

  let sent = 0;
  let failed = 0;

  try {
    const batches = chunk(subscribers, BATCH_SIZE);
    for (const [index, batch] of batches.entries()) {
      const results = await Promise.allSettled(
        batch.map((subscriber) => sendToSubscriber(config, id, input, subscriber)),
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) sent += 1;
        else failed += 1;
      }
      if (index < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
      }
    }
  } catch (error) {
    console.error("[NEWSLETTER] send failed:", error);
  }

  const status: CampaignStatus = sent === 0 ? "FAILED" : "SENT";
  await prisma.newsletterCampaign.update({
    where: { id },
    data: {
      status,
      sentAt: new Date(),
      totalRecipients: subscribers.length,
      renderedHtml: buildHtml(input, "preview"),
    },
  });

  revalidatePath("/newsletter");
  revalidatePath(`/newsletter/${id}`);

  return status === "SENT"
    ? {
        success:
          failed > 0
            ? `Στάλθηκε σε ${sent} από ${subscribers.length} συνδρομητές (${failed} αποτυχίες).`
            : `Στάλθηκε σε ${sent} συνδρομητές.`,
      }
    : { error: "Καμία αποστολή δεν πέτυχε. Έλεγξε τις ρυθμίσεις Mailgun." };
}

/** Διαγραφή προχείρου. */
export async function deleteCampaign(
  _prev: NewsletterFormState | undefined,
  formData: FormData,
): Promise<NewsletterFormState> {
  try {
    await requireStaff();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const id = formData.get("id")?.toString().trim();
  if (!id) return { error: "Λείπει η εκστρατεία." };

  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) return { error: "Η εκστρατεία δεν βρέθηκε." };
  if (campaign.status === "SENT") return { error: "Οι σταλμένες εκστρατείες μένουν για το ιστορικό." };

  await prisma.newsletterCampaign.delete({ where: { id } });
  revalidatePath("/newsletter");
  return { success: "Η εκστρατεία διαγράφηκε." };
}

// ── Συνδρομητές ───────────────────────────────────────────────────────────────

const subscriberSchema = z.object({
  email: z.email("Η διεύθυνση δεν είναι έγκυρη."),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  locale: z.enum(["el", "en"]),
});

/** Χειροκίνητη προσθήκη από τη διαχείριση — μπαίνει κατευθείαν ως εγγεγραμμένος. */
export async function addSubscriber(
  _prev: NewsletterFormState | undefined,
  formData: FormData,
): Promise<NewsletterFormState> {
  try {
    await requireStaff();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const parsed = subscriberSchema.safeParse({
    email: formData.get("email")?.toString().trim().toLowerCase() ?? "",
    firstName: formData.get("firstName")?.toString() || undefined,
    lastName: formData.get("lastName")?.toString() || undefined,
    locale: (formData.get("locale")?.toString() as "el" | "en") ?? "el",
  });
  if (!parsed.success) {
    return { error: "Έλεγξε τα πεδία της φόρμας.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: parsed.data.email } });
  if (existing && existing.status === "SUBSCRIBED") {
    return { error: "Η διεύθυνση είναι ήδη εγγεγραμμένη." };
  }

  const subscriber = existing
    ? await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          status: "SUBSCRIBED",
          firstName: parsed.data.firstName ?? existing.firstName,
          lastName: parsed.data.lastName ?? existing.lastName,
          locale: parsed.data.locale,
          confirmedAt: existing.confirmedAt ?? new Date(),
          unsubscribedAt: null,
        },
      })
    : await prisma.newsletterSubscriber.create({
        data: {
          email: parsed.data.email,
          firstName: parsed.data.firstName ?? null,
          lastName: parsed.data.lastName ?? null,
          locale: parsed.data.locale,
          status: "SUBSCRIBED",
          token: newSubscriberToken(),
          source: "admin",
          confirmedAt: new Date(),
        },
      });

  await logConsent({
    type: "NEWSLETTER",
    action: "GRANTED",
    email: subscriber.email,
    subscriberId: subscriber.id,
    consentText: NEWSLETTER_CONSENT_TEXT,
    method: "admin",
    locale: subscriber.locale,
  });

  revalidatePath("/newsletter/subscribers");
  return { success: `Ο συνδρομητής ${subscriber.email} προστέθηκε.` };
}

/** Διαγραφή συνδρομητή από τη λίστα (ανάκληση συγκατάθεσης). */
export async function unsubscribeSubscriber(
  _prev: NewsletterFormState | undefined,
  formData: FormData,
): Promise<NewsletterFormState> {
  try {
    await requireStaff();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const id = formData.get("id")?.toString().trim();
  if (!id) return { error: "Λείπει ο συνδρομητής." };

  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { id } });
  if (!subscriber) return { error: "Ο συνδρομητής δεν βρέθηκε." };

  await prisma.newsletterSubscriber.update({
    where: { id },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });

  await logConsent({
    type: "NEWSLETTER",
    action: "WITHDRAWN",
    email: subscriber.email,
    subscriberId: subscriber.id,
    consentText: NEWSLETTER_CONSENT_TEXT,
    method: "admin",
    locale: subscriber.locale,
  });

  revalidatePath("/newsletter/subscribers");
  return { success: `Ο συνδρομητής ${subscriber.email} διαγράφηκε από τη λίστα.` };
}

/** Η διεύθυνση της εφαρμογής, για εμφάνιση στη σελίδα συνδρομητών. */
export async function newsletterBaseUrl(): Promise<string> {
  return appBaseUrl();
}
