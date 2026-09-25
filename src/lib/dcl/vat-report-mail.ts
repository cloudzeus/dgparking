/**
 * Αποστολή της αναφοράς ΑΦΜ στη διοίκηση.
 *
 * Εσωτερικό μήνυμα: περιέχει επωνυμίες, τηλέφωνα και πινακίδες πελατών.
 * Πάει στις ίδιες διευθύνσεις με την ημερήσια αναφορά, ποτέ σε πελάτη.
 */

import { getMailgunConfig, sendWithMailgun, type SendResult } from "@/lib/mailgun";
import { reportRecipients } from "@/lib/daily-report-mail";
import type { VatGapRow, VatReport } from "./vat-report";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

function table(rows: VatGapRow[]): string {
  if (rows.length === 0) return "<p style='color:#64748B;font-size:13px'>Καμία.</p>";
  const head = ["Σύμβαση", "ΑΦΜ", "Επωνυμία", "Τηλέφωνο", "Πινακίδες"]
    .map((h) => `<th align="left" style="padding:6px 10px 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748B;border-bottom:1px solid #E2E8F0">${h}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:7px 10px 7px 0;font-size:13px;color:#0F172A;white-space:nowrap">#${r.inst}</td>
          <td style="padding:7px 10px 7px 0;font-size:13px;color:#C4123D;white-space:nowrap">${esc(r.afm)}</td>
          <td style="padding:7px 10px 7px 0;font-size:13px;color:#0F172A">${esc(r.customer)}</td>
          <td style="padding:7px 10px 7px 0;font-size:13px;color:#0F172A;white-space:nowrap">${esc(r.phone ?? "—")}</td>
          <td style="padding:7px 0;font-size:13px;color:#0F172A;font-family:monospace">${esc(r.plates.join(", ") || "—")}</td>
        </tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%"><tr>${head}</tr>${body}</table>`;
}

function text(rep: VatReport): string {
  const rows = (rs: VatGapRow[]) =>
    rs.map((r) => `  #${r.inst}  ${r.afm}  ${r.customer}  ${r.phone ?? "—"}  ${r.plates.join(", ")}`).join("\n");
  return [
    "Συμβάσεις χωρίς έγκυρο ΑΦΜ",
    "",
    `Ενεργές συμβάσεις: ${rep.totalContracts}`,
    `Με έγκυρο ΑΦΜ:     ${rep.withValidVat}`,
    `Εταιρείες χωρίς:   ${rep.companies.length}`,
    `Ιδιώτες χωρίς:     ${rep.individuals.length}`,
    "",
    "ΚΑΝΕΝΑΣ ΔΕΝ ΕΜΠΟΔΙΖΕΤΑΙ ΝΑ ΣΤΑΘΜΕΥΣΕΙ. Το ΑΦΜ είναι προαιρετικό στο",
    "Ψηφιακό Πελατολόγιο· χωρίς αυτό η στάθμευση καταγράφεται ως μεμονωμένη",
    "αντί για επαναλαμβανόμενη υπηρεσία.",
    "",
    "ΕΤΑΙΡΕΙΕΣ (αξίζει τηλέφωνο):",
    rows(rep.companies) || "  —",
    "",
    "ΙΔΙΩΤΕΣ (αναμενόμενο — συνήθως δεν υπάρχει ΑΦΜ):",
    rows(rep.individuals) || "  —",
  ].join("\n");
}

export async function sendVatReport(
  rep: VatReport,
  to: string[] = reportRecipients()
): Promise<SendResult> {
  const config = await getMailgunConfig();
  if (!config) return { success: false, error: "Δεν έχουν οριστεί ρυθμίσεις Mailgun." };
  if (!config.isActive) return { success: false, error: "Η αποστολή email είναι απενεργοποιημένη." };

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:720px">
  <div style="background:#17285B;color:#fff;padding:22px 24px;border-radius:10px 10px 0 0">
    <div style="font-size:18px;font-weight:700">MEGA Parking</div>
    <div style="font-size:13px;opacity:.75;margin-top:2px">Συμβάσεις χωρίς έγκυρο ΑΦΜ</div>
  </div>
  <div style="border:1px solid #E2E8F0;border-top:0;border-radius:0 0 10px 10px;padding:20px 24px">
    <p style="margin:0 0 6px;font-size:14px;color:#0F172A">
      Από <strong>${rep.totalContracts}</strong> ενεργές συμβάσεις, οι
      <strong>${rep.withValidVat}</strong> έχουν έγκυρο ΑΦΜ.
    </p>
    <p style="margin:0 0 18px;padding:10px 12px;background:#F1F5F9;border-left:3px solid #16A34A;font-size:13px;color:#0F172A">
      <strong>Κανένας πελάτης δεν εμποδίζεται να σταθμεύσει.</strong> Το ΑΦΜ είναι
      προαιρετικό στο Ψηφιακό Πελατολόγιο. Χωρίς αυτό, η στάθμευση καταγράφεται ως
      μεμονωμένη αντί για επαναλαμβανόμενη υπηρεσία — σωστή, αλλά φτωχότερη.
    </p>

    <h3 style="margin:22px 0 10px;font-size:15px;color:#0F172A">
      Εταιρείες — ${rep.companies.length}
      <span style="font-weight:400;color:#64748B">· έχουν ΑΦΜ, λείπει από την καρτέλα</span>
    </h3>
    ${table(rep.companies)}

    <h3 style="margin:26px 0 10px;font-size:15px;color:#0F172A">
      Ιδιώτες — ${rep.individuals.length}
      <span style="font-weight:400;color:#64748B">· αναμενόμενο, συνήθως δεν υπάρχει ΑΦΜ</span>
    </h3>
    ${table(rep.individuals)}

    <p style="margin:20px 0 0;font-size:12px;color:#64748B">
      MEGA Parking · αυτόματη αναφορά ποιότητας δεδομένων
    </p>
  </div>
</div>`;

  return sendWithMailgun(config, {
    to,
    subject: `Συμβάσεις χωρίς έγκυρο ΑΦΜ — ${rep.companies.length} εταιρείες, ${rep.individuals.length} ιδιώτες`,
    text: text(rep),
    html,
  });
}
