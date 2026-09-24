import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailgunConfig, sendWithMailgun } from "@/lib/mailgun";
import { newsletterWelcomeEmail } from "@/emails/templates/newsletter-welcome";
import { appBaseUrl, unsubscribeUrl } from "@/lib/newsletter";

/**
 * Δεύτερο βήμα της διπλής επιβεβαίωσης: ο χρήστης πάτησε τον σύνδεσμο του
 * email. Από εδώ και πέρα η εγγραφή είναι `SUBSCRIBED` και λαμβάνει δελτία.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(status: "confirmed" | "invalid"): NextResponse {
  return NextResponse.redirect(`${appBaseUrl()}/?newsletter=${status}`, { status: 303 });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) return back("invalid");

  try {
    const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { token } });
    if (!subscriber) return back("invalid");

    if (subscriber.status !== "SUBSCRIBED") {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { status: "SUBSCRIBED", confirmedAt: new Date(), unsubscribedAt: null },
      });

      const config = await getMailgunConfig();
      if (config?.isActive) {
        const message = newsletterWelcomeEmail({
          unsubscribeUrl: unsubscribeUrl(subscriber.token),
          name: subscriber.firstName ?? undefined,
        });
        const result = await sendWithMailgun(config, {
          to: subscriber.email,
          subject: message.subject,
          text: message.text,
          html: message.html,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl(subscriber.token)}>` },
        });
        if (!result.success) console.error("[NEWSLETTER] welcome email failed:", result.error);
      }
    }

    return back("confirmed");
  } catch (error) {
    console.error("[NEWSLETTER] confirm failed:", error);
    return back("invalid");
  }
}
