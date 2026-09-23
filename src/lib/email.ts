import nodemailer from "nodemailer";

/**
 * Αποστολή email των δημόσιων φορμών (επικοινωνία, αίτημα προσφοράς).
 * Μεταφέρθηκε από το megaparkingsite — ίδιος SMTP λογαριασμός, ίδια μορφή.
 *
 * ENV: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 */

type FormData = Record<string, string | number | boolean | null | undefined>;

// Create a transporter using SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false,
  },
});

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: Array.isArray(to) ? to.join(",") : to,
      subject,
      text,
      html,
    });

    console.log("Message sent: %s", info.messageId);
    return { success: true as const, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false as const, error };
  }
}

/** Μετατρέπει τα πεδία της φόρμας σε κείμενο και σε πίνακα HTML. */
export function formatFormData(data: FormData) {
  let text = "";
  let html = '<table style="border-collapse: collapse; width: 100%;">';

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;

    const label = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    text += `${label}: ${value}\n`;
    html += `
      <tr style="border: 1px solid #ddd;">
        <td style="padding: 8px; background-color: #f8f9fa; font-weight: bold;">${label}</td>
        <td style="padding: 8px;">${value}</td>
      </tr>
    `;
  }

  html += "</table>";
  return { text, html };
}
