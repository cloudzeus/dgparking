import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

/**
 * Αποστολή email μέσω Mailgun.
 *
 * Ο λογαριασμός είναι ΕΥΡΩΠΗΣ: το endpoint είναι `api.eu.mailgun.net`, ΟΧΙ το
 * `api.mailgun.net`. Ένα κλειδί EU σε αμερικανικό endpoint απαντά 401, οπότε η
 * περιοχή διαβάζεται από τις ρυθμίσεις και προεπιλογή είναι το `eu`.
 *
 * Τα στοιχεία ζουν στη βάση (σελίδα «Ρυθμίσεις → Mailgun»), όχι σε ENV: το
 * κλειδί API αποθηκεύεται κρυπτογραφημένο και αποκρυπτογραφείται εδώ.
 */

const ENDPOINTS = {
  eu: "https://api.eu.mailgun.net/v3",
  us: "https://api.mailgun.net/v3",
} as const;

export type MailgunRegion = keyof typeof ENDPOINTS;

export function mailgunBaseUrl(region: string): string {
  return ENDPOINTS[region === "us" ? "us" : "eu"];
}

export type MailgunConfig = {
  domain: string;
  apiKey: string;
  region: MailgunRegion;
  fromName: string;
  fromEmail: string;
  recipientEmail: string;
  isActive: boolean;
};

/** Οι αποθηκευμένες ρυθμίσεις, με το κλειδί ήδη αποκρυπτογραφημένο. */
export async function getMailgunConfig(): Promise<MailgunConfig | null> {
  const row = await prisma.mailgunSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!row) return null;

  let apiKey: string;
  try {
    apiKey = decrypt(row.apiKeyEnc);
  } catch (error) {
    console.error("[MAILGUN] Could not decrypt the stored API key:", error);
    return null;
  }

  return {
    domain: row.domain,
    apiKey,
    region: row.region === "us" ? "us" : "eu",
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    recipientEmail: row.recipientEmail,
    isActive: row.isActive,
  };
}

export type SendResult =
  | { success: true; id: string }
  | { success: false; error: string };

/** Χαμηλού επιπέδου κλήση, ώστε η δοκιμή να μπορεί να περάσει δικά της στοιχεία. */
export async function sendWithMailgun(
  config: Pick<MailgunConfig, "domain" | "apiKey" | "region" | "fromName" | "fromEmail">,
  message: {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    /**
     * Επιπλέον κεφαλίδες μηνύματος (στέλνονται ως `h:<όνομα>`).
     * Τα ενημερωτικά δελτία το χρειάζονται για το `List-Unsubscribe`.
     */
    headers?: Record<string, string>;
  }
): Promise<SendResult> {
  const body = new URLSearchParams();
  body.set("from", `${config.fromName} <${config.fromEmail}>`);
  for (const to of Array.isArray(message.to) ? message.to : [message.to]) {
    body.append("to", to);
  }
  body.set("subject", message.subject);
  body.set("text", message.text);
  if (message.html) body.set("html", message.html);
  if (message.replyTo) body.set("h:Reply-To", message.replyTo);
  for (const [name, value] of Object.entries(message.headers ?? {})) {
    if (value) body.set(`h:${name}`, value);
  }

  const url = `${mailgunBaseUrl(config.region)}/${encodeURIComponent(config.domain)}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    const raw = await res.text();

    if (!res.ok) {
      // Το Mailgun απαντά JSON με `message`, αλλά σε 401 στέλνει σκέτο κείμενο.
      let detail = raw;
      try {
        detail = (JSON.parse(raw) as { message?: string }).message ?? raw;
      } catch {
        // κρατάμε το raw
      }
      const hint =
        res.status === 401
          ? " (έλεγξε το κλειδί και την περιοχή — ο λογαριασμός EU θέλει api.eu.mailgun.net)"
          : "";
      return { success: false, error: `Mailgun ${res.status}: ${detail}${hint}` };
    }

    const data = JSON.parse(raw) as { id?: string };
    return { success: true, id: data.id ?? "" };
  } catch (error) {
    console.error("[MAILGUN] Request failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/** Αποστολή με τις αποθηκευμένες ρυθμίσεις. Χρησιμοποιείται από τις φόρμες του site. */
export async function sendEmail(message: {
  to?: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Περνά αυτούσιο στο Mailgun — π.χ. `List-Unsubscribe` στα δελτία. */
  headers?: Record<string, string>;
}): Promise<SendResult> {
  const config = await getMailgunConfig();

  if (!config) {
    return { success: false, error: "Δεν έχουν οριστεί ρυθμίσεις Mailgun." };
  }
  if (!config.isActive) {
    return { success: false, error: "Η αποστολή email μέσω Mailgun είναι απενεργοποιημένη." };
  }

  return sendWithMailgun(config, { ...message, to: message.to ?? config.recipientEmail });
}

/** Μετατρέπει τα πεδία της φόρμας σε κείμενο και σε πίνακα HTML. */
export function formatFormData(data: Record<string, unknown>) {
  let text = "";
  let html = '<table style="border-collapse: collapse; width: 100%;">';

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;

    const label = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    const safe = String(value).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

    text += `${label}: ${value}\n`;
    html += `
      <tr style="border: 1px solid #ddd;">
        <td style="padding: 8px; background-color: #f8f9fa; font-weight: bold;">${label}</td>
        <td style="padding: 8px;">${safe}</td>
      </tr>
    `;
  }

  html += "</table>";
  return { text, html };
}
