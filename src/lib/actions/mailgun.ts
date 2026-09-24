"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { sendWithMailgun } from "@/lib/mailgun";

const MASKED = "••••••••";

const schema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, "Συμπλήρωσε το domain.")
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Το domain δεν μοιάζει σωστό (π.χ. mg.megaparking.gr)."),
  apiKey: z.string().trim().min(1, "Συμπλήρωσε το κλειδί API."),
  region: z.enum(["eu", "us"]),
  fromName: z.string().trim().min(1, "Συμπλήρωσε το όνομα αποστολέα."),
  fromEmail: z.email("Η διεύθυνση αποστολέα δεν είναι έγκυρη."),
  recipientEmail: z.email("Η διεύθυνση παραλήπτη δεν είναι έγκυρη."),
  isActive: z.boolean(),
});

export type MailgunFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

/** Μόνο διαχειριστές αγγίζουν τα στοιχεία αποστολής. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Δεν έχεις δικαίωμα σε αυτή την ενέργεια.");
  }
  return session.user;
}

function parse(formData: FormData) {
  return schema.safeParse({
    domain: formData.get("domain"),
    apiKey: formData.get("apiKey"),
    region: formData.get("region"),
    fromName: formData.get("fromName"),
    fromEmail: formData.get("fromEmail"),
    recipientEmail: formData.get("recipientEmail"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
}

function fieldErrorsOf(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * Το κλειδί δεν επιστρέφει ποτέ στον browser: η φόρμα δείχνει κουκκίδες και,
 * αν ο χρήστης δεν το αλλάξει, κρατάμε το ήδη αποθηκευμένο.
 */
async function resolveApiKey(submitted: string): Promise<string | null> {
  if (submitted !== MASKED) return submitted;

  const existing = await prisma.mailgunSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!existing) return null;

  try {
    return decrypt(existing.apiKeyEnc);
  } catch {
    return null;
  }
}

export async function saveMailgunSettings(
  _prev: MailgunFormState | undefined,
  formData: FormData
): Promise<MailgunFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Έλεγξε τα πεδία της φόρμας.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const apiKey = await resolveApiKey(parsed.data.apiKey);
  if (!apiKey) {
    return { error: "Συμπλήρωσε το κλειδί API.", fieldErrors: { apiKey: "Συμπλήρωσε το κλειδί API." } };
  }

  const data = {
    domain: parsed.data.domain,
    apiKeyEnc: encrypt(apiKey),
    region: parsed.data.region,
    fromName: parsed.data.fromName,
    fromEmail: parsed.data.fromEmail,
    recipientEmail: parsed.data.recipientEmail,
    isActive: parsed.data.isActive,
  };

  const existing = await prisma.mailgunSettings.findFirst({ orderBy: { createdAt: "asc" } });

  if (existing) {
    await prisma.mailgunSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.mailgunSettings.create({ data });
  }

  revalidatePath("/settings");
  return { success: "Οι ρυθμίσεις αποθηκεύτηκαν." };
}

/**
 * Δοκιμαστικό email με τα στοιχεία της φόρμας — χωρίς να χρειάζεται αποθήκευση
 * πρώτα. Το αποτέλεσμα κρατιέται στη βάση για να φαίνεται στη σελίδα.
 */
export async function sendMailgunTest(
  _prev: MailgunFormState | undefined,
  formData: FormData
): Promise<MailgunFormState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Έλεγξε τα πεδία της φόρμας.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const apiKey = await resolveApiKey(parsed.data.apiKey);
  if (!apiKey) {
    return { error: "Συμπλήρωσε το κλειδί API.", fieldErrors: { apiKey: "Συμπλήρωσε το κλειδί API." } };
  }

  const to = String(formData.get("testEmail") || parsed.data.recipientEmail).trim();
  const toCheck = z.email().safeParse(to);
  if (!toCheck.success) {
    return { error: "Η διεύθυνση δοκιμής δεν είναι έγκυρη.", fieldErrors: { testEmail: "Μη έγκυρη διεύθυνση." } };
  }

  const now = new Date();
  const result = await sendWithMailgun(
    {
      domain: parsed.data.domain,
      apiKey,
      region: parsed.data.region,
      fromName: parsed.data.fromName,
      fromEmail: parsed.data.fromEmail,
    },
    {
      to,
      subject: "Δοκιμή Mailgun — MEGA Parking",
      text: `Δοκιμαστικό μήνυμα από τη σελίδα ρυθμίσεων.\nΏρα: ${now.toLocaleString("el-GR", { timeZone: "Europe/Athens" })}\nDomain: ${parsed.data.domain}\nΠεριοχή: ${parsed.data.region.toUpperCase()}`,
      html: `<p>Δοκιμαστικό μήνυμα από τη σελίδα ρυθμίσεων.</p><p>Ώρα: ${now.toLocaleString("el-GR", { timeZone: "Europe/Athens" })}<br>Domain: ${parsed.data.domain}<br>Περιοχή: ${parsed.data.region.toUpperCase()}</p>`,
    }
  );

  const existing = await prisma.mailgunSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    await prisma.mailgunSettings.update({
      where: { id: existing.id },
      data: {
        lastTestAt: now,
        lastTestOk: result.success,
        lastTestError: result.success ? null : result.error,
      },
    });
  }

  revalidatePath("/settings");

  return result.success
    ? { success: `Το δοκιμαστικό email στάλθηκε στο ${to}.` }
    : { error: result.error };
}
