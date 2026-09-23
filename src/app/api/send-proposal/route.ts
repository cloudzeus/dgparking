import { NextResponse } from "next/server";
import { sendEmail, formatFormData } from "@/lib/email";

/** Αίτημα επιχειρηματικής προσφοράς από το δημόσιο site. */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { text, html } = formatFormData(data);

    // Send email to both the user and the company
    const result = await sendEmail({
      to: [data.email, "accounts@kolleris.com"],
      subject: "New Business Proposal Request",
      text,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing proposal request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
