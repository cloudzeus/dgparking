import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logConsent } from "@/lib/gdpr";
import { NEWSLETTER_CONSENT_TEXT, appBaseUrl } from "@/lib/newsletter";

/**
 * Διαγραφή από το ενημερωτικό δελτίο.
 *
 * `GET` για τον σύνδεσμο του υποσέλιδου, `POST` για το «One-Click» των
 * Gmail/Outlook (κεφαλίδα `List-Unsubscribe-Post`). Η ανάκληση ΔΕΝ σβήνει
 * τίποτα: γράφει νέα εγγραφή `WITHDRAWN` στο αρχείο συγκαταθέσεων.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function withdraw(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;

  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { token } });
  if (!subscriber) return false;

  if (subscriber.status !== "UNSUBSCRIBED") {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
    });
  }

  await logConsent({
    type: "NEWSLETTER",
    action: "WITHDRAWN",
    email: subscriber.email,
    subscriberId: subscriber.id,
    consentText: NEWSLETTER_CONSENT_TEXT,
    method: "unsubscribe-link",
    locale: subscriber.locale,
  });

  return true;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  try {
    const ok = await withdraw(token);
    return NextResponse.redirect(`${appBaseUrl()}/?newsletter=${ok ? "unsubscribed" : "invalid"}`, {
      status: 303,
    });
  } catch (error) {
    console.error("[NEWSLETTER] unsubscribe failed:", error);
    return NextResponse.redirect(`${appBaseUrl()}/?newsletter=invalid`, { status: 303 });
  }
}

/** One-Click: ο πελάτης email δεν διαβάζει το σώμα, μόνο τον κωδικό 200. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  try {
    await withdraw(token);
  } catch (error) {
    console.error("[NEWSLETTER] one-click unsubscribe failed:", error);
  }
  return new NextResponse("OK", { status: 200 });
}
