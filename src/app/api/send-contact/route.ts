import { NextResponse } from "next/server";
import { sendEmail, formatFormData } from "@/lib/email";

/** Φόρμα επικοινωνίας του δημόσιου site. */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { text, html } = formatFormData(data);

    // Send email to both the user and the company
    const result = await sendEmail({
      to: [data.email, "accounts@kolleris.com"],
      subject: "New Contact Form Submission",
      text,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing contact form:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
