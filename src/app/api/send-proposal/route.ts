import { NextResponse } from "next/server";
import { sendEmail, formatFormData } from "@/lib/mailgun";
import { logConsent } from "@/lib/gdpr";

/** Αίτημα επιχειρηματικής προσφοράς από το δημόσιο site. */
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
      try {
        await logConsent({
          type: "PROPOSAL_FORM",
          action: "GRANTED",
          email: typeof data.email === "string" ? data.email : null,
          consentText,
          method: "checkbox",
          locale: typeof data.locale === "string" ? data.locale.slice(0, 2) : null,
        });
      } catch (error) {
        // Η καταγραφή δεν εμποδίζει τον χρήστη να ζητήσει προσφορά.
        console.error("[PROPOSAL] Could not record the consent:", error);
      }
    }

    const result = await sendEmail({
      subject: "Νέο αίτημα επαγγελματικής προσφοράς",
      text,
      html,
      replyTo: typeof data.email === "string" ? data.email : undefined,
    });

    if (!result.success) {
      console.error("[PROPOSAL] Mailgun error:", result.error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing proposal request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
