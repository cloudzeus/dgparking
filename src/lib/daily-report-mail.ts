/**
 * Αποστολή της ημερήσιας αναφοράς.
 *
 * ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΗ ΓΕΝΝΗΤΡΙΑ
 * Η παραγωγή του PDF πρέπει να μπορεί να τρέξει χωρίς να στείλει τίποτα —
 * για έλεγχο, για κατέβασμα από τη διαχείριση, για δοκιμή. Η αποστολή είναι
 * η μόνη ενέργεια που φεύγει προς τα έξω και ζει μόνη της, ώστε να μην
 * μπορεί να συμβεί κατά λάθος.
 *
 * ΟΙ ΠΑΡΑΛΗΠΤΕΣ ΕΙΝΑΙ ΕΣΩΤΕΡΙΚΟΙ
 * Η αναφορά περιέχει πινακίδες πελατών, ώρες και ποσά. Πάει μόνο στη
 * διεύθυνση της διοίκησης — ποτέ σε πελάτη, ποτέ σε λίστα.
 */

import { getMailgunConfig, mailgunBaseUrl, type SendResult } from "@/lib/mailgun";
import type { ReportStats } from "@/lib/daily-report";

/** Οι παραλήπτες της αναφοράς. Αλλάζουν με μεταβλητή περιβάλλοντος. */
export function reportRecipients(): string[] {
  const raw = process.env.DAILY_REPORT_TO ?? "dimitris@kolleris.com,gkozyris@i4ria.com";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

/**
 * Ο διακόπτης της αυτόματης ημερήσιας αποστολής.
 *
 * Κλειστός από προεπιλογή. Μια αναφορά που αρχίζει να φεύγει μόνη της πριν
 * την εγκρίνει άνθρωπος είναι ακριβώς το είδος της αυτοματοποίησης που
 * μετανιώνει κανείς.
 */
export const DAILY_REPORT_ENABLED = process.env.DAILY_REPORT_ENABLED === "true";

function summaryText(s: ReportStats): string {
  const diff = s.ourTotal - s.erpTotal;
  return [
    `Ημερήσια αντιπαραβολή — ${s.date}`,
    "",
    `Στάσεις ημέρας:        ${s.total}`,
    `Συμφωνούν:             ${s.matched}`,
    `Αποκλίσεις:            ${s.problems}`,
    `Εκκρεμούν κάτω 15′:    ${s.pending}  (καθυστέρηση καταχώρησης, όχι απόκλιση)`,
    "",
    `Δικός μας υπολογισμός: ${s.ourTotal.toFixed(2)} €`,
    `Ψηφιακό πελατολόγιο:   ${s.erpTotal.toFixed(2)} €`,
    `Διαφορά:               ${diff.toFixed(2)} €`,
    "",
    `Οι αποκλίσεις με φωτογραφίες εισόδου και εξόδου βρίσκονται στο συνημμένο PDF.`,
    "",
    "— MEGA Parking, αυτόματη αναφορά",
  ].join("\n");
}

function summaryHtml(s: ReportStats): string {
  const diff = s.ourTotal - s.erpTotal;
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#64748B;font-size:13px">${label}</td>` +
    `<td style="padding:6px 0;font-size:13px;${strong ? "font-weight:700;" : ""}color:#0F172A">${value}</td></tr>`;

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">
  <div style="background:#17285B;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
    <div style="font-size:18px;font-weight:700">MEGA Parking</div>
    <div style="font-size:13px;opacity:.75;margin-top:2px">Ημερήσια αντιπαραβολή · ${s.date}</div>
  </div>
  <div style="border:1px solid #E2E8F0;border-top:0;border-radius:0 0 10px 10px;padding:20px 24px">
    <table style="border-collapse:collapse;width:100%">
      ${row("Στάσεις ημέρας", String(s.total))}
      ${row("Συμφωνούν", String(s.matched))}
      ${row("Αποκλίσεις", `<span style="color:${s.problems ? "#E31E2A" : "#16A34A"};font-weight:700">${s.problems}</span>`)}
      ${row("Εκκρεμούν κάτω 15′", `${s.pending} <span style="color:#94A3B8">καθυστέρηση, όχι απόκλιση</span>`)}
    </table>
    <hr style="border:0;border-top:1px solid #E2E8F0;margin:16px 0">
    <table style="border-collapse:collapse;width:100%">
      ${row("Δικός μας υπολογισμός", `${s.ourTotal.toFixed(2)} €`)}
      ${row("Ψηφιακό πελατολόγιο", `${s.erpTotal.toFixed(2)} €`)}
      ${row("Διαφορά", `${diff.toFixed(2)} €`, true)}
    </table>
    <p style="color:#64748B;font-size:12px;margin:16px 0 0">
      Οι αποκλίσεις, με φωτογραφία εισόδου και εξόδου για κάθε πινακίδα, βρίσκονται στο
      συνημμένο PDF.
    </p>
  </div>
</div>`;
}

/**
 * Στέλνει το PDF ως συνημμένο.
 *
 * Το Mailgun δέχεται συνημμένα μόνο ως `multipart/form-data`, ενώ οι
 * υπόλοιπες κλήσεις της εφαρμογής χρησιμοποιούν `urlencoded` — γι' αυτό η
 * κλήση γράφεται εδώ και δεν περνά από το κοινό `sendEmail`.
 */
export async function sendDailyReport(
  pdf: Buffer,
  stats: ReportStats,
  to: string[] = reportRecipients()
): Promise<SendResult> {
  const config = await getMailgunConfig();
  if (!config) return { success: false, error: "Δεν έχουν οριστεί ρυθμίσεις Mailgun." };
  if (!config.isActive) return { success: false, error: "Η αποστολή email είναι απενεργοποιημένη." };
  if (to.length === 0) return { success: false, error: "Δεν ορίστηκαν παραλήπτες." };

  const form = new FormData();
  form.set("from", `${config.fromName} <${config.fromEmail}>`);
  for (const addr of to) form.append("to", addr);
  form.set(
    "subject",
    stats.problems > 0
      ? `Αντιπαραβολή ${stats.date} — ${stats.problems} αποκλίσεις`
      : `Αντιπαραβολή ${stats.date} — καμία απόκλιση`
  );
  form.set("text", summaryText(stats));
  form.set("html", summaryHtml(stats));
  form.append(
    "attachment",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    `MEGA-Parking-${stats.date.split("/").reverse().join("-")}.pdf`
  );

  try {
    const res = await fetch(
      `${mailgunBaseUrl(config.region)}/${encodeURIComponent(config.domain)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
        },
        body: form,
        cache: "no-store",
      }
    );
    const raw = await res.text();
    if (!res.ok) {
      let detail = raw;
      try {
        detail = (JSON.parse(raw) as { message?: string }).message ?? raw;
      } catch {
        // κρατάμε το raw
      }
      return { success: false, error: `Mailgun ${res.status}: ${detail}` };
    }
    return { success: true, id: (JSON.parse(raw) as { id?: string }).id ?? "" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Η αποστολή απέτυχε.",
    };
  }
}
