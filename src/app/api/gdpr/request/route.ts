import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { logConsent, requestContext, responseDeadline } from "@/lib/gdpr";
import { appBaseUrl } from "@/lib/newsletter";
import { sendEmail } from "@/lib/mailgun";
import { gdprRequestReceivedEmail } from "@/emails/templates/gdpr-request-received";
import { isRightKey } from "@/components/site/right-keys";
import type { DataRequestType } from "@prisma/client";

/**
 * Αίτημα άσκησης δικαιωμάτων από το δημόσιο site (άρ. 15-22 ΓΚΠΔ).
 *
 * Δεν εκτελούμε τίποτα πριν επαληθευτεί η ταυτότητα: το αίτημα γεννιέται σε
 * κατάσταση `VERIFYING` και ο σύνδεσμος του email το περνά σε `IN_PROGRESS`.
 * Έτσι κανείς δεν μπορεί να ζητήσει τα δεδομένα τρίτου γράφοντας απλώς τη
 * διεύθυνσή του.
 */

type RequestBody = {
  type: DataRequestType;
  fullName: string | null;
  email: string;
  message: string | null;
  locale: string | null;
  consentText: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBody(payload: unknown): RequestBody | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as Record<string, unknown>;

  if (!isRightKey(body.type)) return null;

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 255) return null;

  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 255) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 5000) : "";

  return {
    type: body.type,
    fullName: fullName || null,
    email,
    message: message || null,
    locale: typeof body.locale === "string" ? body.locale.slice(0, 2) : null,
    consentText: typeof body.consentText === "string" ? body.consentText.slice(0, 2000) : null,
  };
}

export async function POST(request: Request) {
  try {
    const body = parseBody(await request.json());
    if (!body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const context = await requestContext();
    const token = randomBytes(32).toString("hex");
    const dueAt = responseDeadline();

    const created = await prisma.dataSubjectRequest.create({
      data: {
        email: body.email,
        fullName: body.fullName,
        type: body.type,
        status: "VERIFYING",
        message: body.message,
        token,
        dueAt,
        locale: body.locale,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      select: { id: true },
    });

    // Το ακριβές κείμενο δίπλα στο checkbox της φόρμας, ως απόδειξη ότι ο
    // αιτών γνώριζε γιατί μας δίνει τα στοιχεία του.
    if (body.consentText) {
      await logConsent({
        type: "PRIVACY_POLICY",
        action: "GRANTED",
        email: body.email,
        consentText: body.consentText,
        method: "checkbox",
        locale: body.locale,
      });
    }

    const verifyUrl = `${appBaseUrl()}/api/gdpr/verify?token=${encodeURIComponent(token)}`;
    const mail = gdprRequestReceivedEmail({
      requestType: body.type,
      verifyUrl,
      dueDate: dueAt,
      referenceId: created.id,
      email: body.email,
      fullName: body.fullName ?? undefined,
    });

    const sent = await sendEmail({
      to: body.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    if (!sent.success) {
      // Το αίτημα υπάρχει ήδη στο μητρώο — ο υπεύθυνος θα το δει και χωρίς
      // το email. Δεν το ακυρώνουμε επειδή απέτυχε η αποστολή.
      console.error("[GDPR] Could not send the verification email:", sent.error);
    }

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    console.error("[GDPR] Could not register the data subject request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
