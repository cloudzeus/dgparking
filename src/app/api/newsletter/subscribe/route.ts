import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logConsent } from "@/lib/gdpr";
import { getMailgunConfig, sendWithMailgun } from "@/lib/mailgun";
import { newsletterConfirmEmail } from "@/emails/templates/newsletter-confirm";
import { NEWSLETTER_CONSENT_TEXT, confirmUrl, newSubscriberToken } from "@/lib/newsletter";

/**
 * Εγγραφή στο ενημερωτικό δελτίο από το δημόσιο site.
 *
 * Διπλή επιβεβαίωση (double opt-in): εδώ δημιουργείται ΜΟΝΟ εγγραφή
 * `PENDING` και φεύγει το email επιβεβαίωσης. Κανένα δελτίο δεν στέλνεται
 * πριν ο χρήστης πατήσει τον σύνδεσμο.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.email("Η διεύθυνση δεν είναι έγκυρη."),
  name: z.string().trim().max(100).optional(),
  locale: z.enum(["el", "en"]).optional(),
  /** Το checkbox της φόρμας — χωρίς αυτό δεν υπάρχει συγκατάθεση. */
  consent: z.literal(true, { message: "Χρειάζεται η συγκατάθεσή σου." }),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο αίτημα." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Έλεγξε τα στοιχεία σου." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const locale = parsed.data.locale ?? "el";
  const [firstName, ...rest] = (parsed.data.name ?? "").trim().split(/\s+/).filter(Boolean);

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (existing?.status === "SUBSCRIBED") {
      // Δεν αποκαλύπτουμε περισσότερα: η απάντηση είναι ίδια για όλους.
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    const token = newSubscriberToken();
    const subscriber = existing
      ? await prisma.newsletterSubscriber.update({
          where: { id: existing.id },
          data: {
            token,
            status: "PENDING",
            locale,
            firstName: firstName ?? existing.firstName,
            lastName: rest.length ? rest.join(" ") : existing.lastName,
            unsubscribedAt: null,
          },
        })
      : await prisma.newsletterSubscriber.create({
          data: {
            email,
            token,
            locale,
            status: "PENDING",
            source: "site-footer",
            firstName: firstName ?? null,
            lastName: rest.length ? rest.join(" ") : null,
          },
        });

    // GDPR άρ. 7 §1: κρατάμε το ακριβές κείμενο που είδε ο χρήστης.
    await logConsent({
      type: "NEWSLETTER",
      action: "GRANTED",
      email: subscriber.email,
      subscriberId: subscriber.id,
      consentText: NEWSLETTER_CONSENT_TEXT,
      method: "double-opt-in",
      locale,
    });

    const config = await getMailgunConfig();
    if (config?.isActive) {
      const message = newsletterConfirmEmail({
        confirmUrl: confirmUrl(token),
        email: subscriber.email,
        name: subscriber.firstName ?? undefined,
      });
      const result = await sendWithMailgun(config, {
        to: subscriber.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      if (!result.success) {
        console.error("[NEWSLETTER] confirmation email failed:", result.error);
      }
    } else {
      console.error("[NEWSLETTER] Mailgun is not configured — confirmation email not sent.");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NEWSLETTER] subscribe failed:", error);
    return NextResponse.json({ error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." }, { status: 500 });
  }
}
