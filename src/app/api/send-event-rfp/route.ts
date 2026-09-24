import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/mailgun";
import { logConsent } from "@/lib/gdpr";

/**
 * Αίτημα κράτησης θέσεων για εκδήλωση, από το δημόσιο site.
 *
 * ΔΥΟ ΜΗΝΥΜΑΤΑ, ΟΧΙ ΕΝΑ
 * Στη διαχείριση φεύγει το αίτημα προς ενέργεια. Στον πελάτη φεύγει
 * ΑΝΤΙΓΡΑΦΟ όσων συμπλήρωσε: χωρίς αυτό δεν έχει τίποτα να κρατήσει, δεν
 * ξέρει αν στάλθηκε, και θα ξαναστείλει την ίδια φόρμα.
 *
 * Η αποτυχία του αντιγράφου ΔΕΝ ακυρώνει το αίτημα. Το μήνυμα προς την
 * εταιρεία είναι αυτό που μετράει· αν δεν φύγει η επιβεβαίωση, το αίτημα
 * έχει ήδη καταγραφεί και κάποιος θα τηλεφωνήσει.
 */

const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(6).max(40),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Άκυρη ημερομηνία."),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/, "Άκυρη ώρα."),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/, "Άκυρη ώρα."),
  spaces: z.coerce.number().int().min(1).max(500),
  eventType: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  locale: z.string().trim().max(5).optional(),
  gdprConsentText: z.string().trim().max(1000).optional(),
});

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export async function POST(request: Request) {
  let data: z.infer<typeof Schema>;
  try {
    data = Schema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Ελέγξτε τα στοιχεία της φόρμας."
        : "Μη έγκυρο αίτημα.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Η ώρα λήξης μπορεί να είναι μικρότερη — μια εκδήλωση περνά τα μεσάνυχτα.
  // Δεν το θεωρούμε σφάλμα, αλλά το σημειώνουμε ώστε να μην παρεξηγηθεί.
  const overnight = data.timeTo <= data.timeFrom;

  const rows: [string, string][] = [
    ["Ονοματεπώνυμο", data.name],
    ["Εταιρεία", data.company || "—"],
    ["Email", data.email],
    ["Τηλέφωνο", data.phone],
    ["Ημερομηνία", dmy(data.eventDate)],
    ["Ώρες", `${data.timeFrom} – ${data.timeTo}${overnight ? " (επόμενη ημέρα)" : ""}`],
    ["Θέσεις", String(data.spaces)],
    ["Είδος εκδήλωσης", data.eventType || "—"],
    ["Σημειώσεις", data.notes || "—"],
  ];

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 14px 7px 0;color:#64748B;font-size:13px;white-space:nowrap">${esc(k)}</td>` +
        `<td style="padding:7px 0;font-size:13px;color:#0F172A">${esc(v).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");

  const shell = (title: string, intro: string, footer: string) =>
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">
      <div style="background:#17285B;color:#fff;padding:22px 24px;border-radius:10px 10px 0 0">
        <div style="font-size:18px;font-weight:700">MEGA Parking</div>
        <div style="font-size:13px;opacity:.75;margin-top:2px">${esc(title)}</div>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:0;border-radius:0 0 10px 10px;padding:20px 24px">
        <p style="margin:0 0 14px;font-size:14px;color:#0F172A">${intro}</p>
        <table style="border-collapse:collapse;width:100%">${table}</table>
        <p style="margin:18px 0 0;font-size:12px;color:#64748B">${footer}</p>
      </div>
    </div>`;

  // 1) Προς τη διαχείριση — αυτό είναι το μήνυμα που πρέπει να φύγει.
  const toCompany = await sendEmail({
    subject: `Αίτημα εκδήλωσης — ${data.spaces} θέσεις, ${dmy(data.eventDate)}`,
    text,
    html: shell(
      "Νέο αίτημα κράτησης για εκδήλωση",
      `Ο/Η <strong>${esc(data.name)}</strong> ζητά <strong>${data.spaces} θέσεις</strong> για τις <strong>${dmy(data.eventDate)}</strong>.`,
      "Απαντήστε απευθείας σε αυτό το μήνυμα για να φτάσει στον πελάτη."
    ),
    replyTo: data.email,
  });

  if (!toCompany.success) {
    console.error("[EVENT-RFP] Το αίτημα δεν στάλθηκε:", toCompany.error);
    return NextResponse.json(
      { error: "Το αίτημα δεν στάλθηκε. Δοκιμάστε ξανά ή τηλεφωνήστε μας." },
      { status: 502 }
    );
  }

  // 2) Προς τον πελάτη — αντίγραφο. Δεν μπλοκάρει την επιτυχία.
  const toCustomer = await sendEmail({
    to: data.email,
    subject: `Λάβαμε το αίτημά σας — ${data.spaces} θέσεις, ${dmy(data.eventDate)}`,
    text: `Λάβαμε το αίτημά σας και θα επικοινωνήσουμε μαζί σας εντός μίας εργάσιμης ημέρας.\n\n${text}`,
    html: shell(
      "Λάβαμε το αίτημά σας",
      "Ευχαριστούμε. Καταγράψαμε τα παρακάτω στοιχεία και θα επικοινωνήσουμε μαζί σας <strong>εντός μίας εργάσιμης ημέρας</strong> με διαθεσιμότητα και τιμή.",
      "Αν κάτι χρειάζεται διόρθωση, απαντήστε σε αυτό το μήνυμα. MEGA Parking · Κ. Μαυρομιχάλη 4, Πειραιάς"
    ),
  });
  if (!toCustomer.success) {
    console.error("[EVENT-RFP] Το αντίγραφο προς τον πελάτη δεν στάλθηκε:", toCustomer.error);
  }

  if (data.gdprConsentText) {
    try {
      await logConsent({
        type: "PROPOSAL_FORM",
        action: "GRANTED",
        email: data.email,
        consentText: data.gdprConsentText,
        method: "checkbox",
        locale: data.locale?.slice(0, 2) ?? null,
      });
    } catch (error) {
      // Η καταγραφή συγκατάθεσης δεν εμποδίζει τον πελάτη να ζητήσει προσφορά.
      console.error("[EVENT-RFP] Η συγκατάθεση δεν καταγράφηκε:", error);
    }
  }

  return NextResponse.json({ success: true, copySent: toCustomer.success });
}
