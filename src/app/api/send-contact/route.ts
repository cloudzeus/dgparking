import { NextResponse } from "next/server";
import { sendEmail, formatFormData } from "@/lib/mailgun";
import { logConsent } from "@/lib/gdpr";
import type { ConsentType } from "@prisma/client";

/** Φόρμα επικοινωνίας του δημόσιου site. */
export async function POST(request: Request) {
  try {
    // Η συγκατάθεση δεν μπαίνει ποτέ στο email: βγαίνει εδώ, ώστε το μήνυμα
    // προς την εταιρεία να μείνει ακριβώς όπως ήταν.
    const { gdprConsent, ...data } = (await request.json()) as Record<string, unknown> & {
      gdprConsent?: { text?: unknown };
    };
    const { text, html } = formatFormData(data);

    const consentText = typeof gdprConsent?.text === "string" ? gdprConsent.text : null;
    if (consentText) {
      const type: ConsentType = "CONTACT_FORM";
      try {
        await logConsent({
          type,
          action: "GRANTED",
          email: typeof data.email === "string" ? data.email : null,
          consentText,
          method: "checkbox",
          locale: typeof data.locale === "string" ? data.locale.slice(0, 2) : null,
        });
      } catch (error) {
        // Η καταγραφή δεν εμποδίζει τον χρήστη να μας στείλει το μήνυμά του.
        console.error("[CONTACT] Could not record the consent:", error);
      }
    }

    // Στην εταιρεία (από τις ρυθμίσεις) και στον ίδιο τον αποστολέα.
    const result = await sendEmail({
      subject: "Νέο μήνυμα από τη φόρμα επικοινωνίας",
      text,
      html,
      replyTo: typeof data.email === "string" ? data.email : undefined,
    });

    if (!result.success) {
      console.error("[CONTACT] Mailgun error:", result.error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing contact form:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
