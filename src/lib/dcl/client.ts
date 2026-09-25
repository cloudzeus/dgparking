/**
 * Ο HTTP client του Ψηφιακού Πελατολογίου.
 *
 * ΤΙ ΔΙΑΦΕΡΕΙ ΑΠΟ ΤΟ SOFTONE
 * Εδώ μιλάμε **XML**, όχι JSON — και η απάντηση έρχεται ως `text/plain` με
 * XML μέσα. Επίσης τα επιχειρησιακά σφάλματα γυρίζουν **HTTP 200**: η κλήση
 * «πέτυχε» τεχνικά και το λάθος κρύβεται στο σώμα. Όποιος ελέγξει μόνο το
 * status code θα νομίζει ότι όλα πήγαν καλά.
 */

import {
  type NewDigitalClient,
  type UpdateDigitalClient,
} from "./types";

/**
 * Τα namespace, από τα επίσημα XSD (DCL_v1_1.zip).
 *
 * ΠΡΟΣΟΧΗ — ΔΕΝ ΕΙΝΑΙ ΣΥΝΕΠΗ ΜΕΤΑΞΥ ΤΟΥΣ.
 * Το `dcrudt` (ενημέρωση) δηλώνεται με **https**, ενώ όλα τα υπόλοιπα με
 * **http**. Δεν είναι τυπογραφικό δικό μας: έτσι είναι γραμμένο στο
 * `updateClient-v1.1.xsd` της ΑΑΔΕ. Μην τα «ομογενοποιήσεις» — λάθος
 * πρωτόκολλο δίνει σφάλμα 101 «Could not find schema information», που
 * μοιάζει με σφάλμα σύνταξης XML ενώ είναι σφάλμα δήλωσης namespace.
 */
const NS_NEW = "http://www.aade.gr/myDATA/dcrnew/v1.0";
const NS_UPD = "https://www.aade.gr/myDATA/dcrudt/v1.0";
export const NS_COR = "http://www.aade.gr/myDATA/dcrudtcor/v1.0";

export type DclConfig = {
  userId: string;
  subscriptionKey: string;
  baseUrl: string;
};

export function loadDclConfig(): DclConfig | null {
  const userId = process.env.AADE_USER_ID?.trim();
  const subscriptionKey = process.env.AADE_SUBSCRIPTION_KEY?.trim();
  if (!userId || !subscriptionKey) return null;
  return {
    userId,
    subscriptionKey,
    baseUrl: (process.env.AADE_DCL_BASE_URL ?? "https://mydataapidev.aade.gr").replace(/\/$/, ""),
  };
}

/** Είναι ο διακόπτης αποστολής ανοιχτός; Κλειστός από προεπιλογή. */
export function isSubmitEnabled(): boolean {
  return process.env.AADE_DCL_SUBMIT_ENABLED === "true";
}

const esc = (v: unknown) =>
  String(v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!
  );

/** Στοιχείο μόνο όταν η τιμή υπάρχει — τα κενά στοιχεία προκαλούν σφάλμα 203. */
const el = (name: string, value: unknown): string =>
  value === undefined || value === null || value === ""
    ? ""
    : `<${name}>${esc(typeof value === "boolean" ? (value ? "true" : "false") : value)}</${name}>`;

export function buildSendClientXml(p: NewDigitalClient): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<NewDigitalClientDoc xmlns="${NS_NEW}">
  <newDigitalClient>
    ${el("clientServiceType", p.clientServiceType)}
    ${el("creationDateTime", p.creationDateTime)}
    ${el("branch", p.branch)}
    ${el("recurringService", p.recurringService)}
    ${el("customerVatNumber", p.customerVatNumber)}
    ${el("customerCountry", p.customerCountry)}
    ${el("transmissionFailure", p.transmissionFailure)}
    ${el("comments", p.comments)}
    <useCase>
      <parkingcarwash>
        ${el("vehicleRegistrationNumber", p.vehicleRegistrationNumber)}
      </parkingcarwash>
    </useCase>
  </newDigitalClient>
</NewDigitalClientDoc>`;
}

export function buildUpdateClientXml(p: UpdateDigitalClient): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<UpdateClientDoc xmlns="${NS_UPD}">
  <updateClient>
    ${el("initialDclId", p.initialDclId)}
    ${el("clientServiceType", p.clientServiceType)}
    ${el("entryCompletion", p.entryCompletion)}
    ${el("nonIssueInvoice", p.nonIssueInvoice)}
    ${el("amount", p.amount)}
    ${el("providedServiceCategory", p.providedServiceCategory)}
    ${el("providedServiceCategoryOther", p.providedServiceCategoryOther)}
    ${el("invoiceKind", p.invoiceKind)}
    ${el("reasonNonIssueType", p.reasonNonIssueType)}
    ${el("comments", p.comments)}
  </updateClient>
</UpdateClientDoc>`;
}

export type DclResult =
  | { ok: true; id: number; raw: string }
  | { ok: false; code: string; message: string; raw: string };

/** Απλή εξαγωγή του πρώτου στοιχείου — αρκεί για τα σχήματα της ΑΑΔΕ. */
function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function interpret(raw: string): DclResult {
  // Τα επιχειρησιακά σφάλματα έρχονται με HTTP 200 — ο έλεγχος γίνεται ΕΔΩ.
  const statusCode = pick(raw, "statusCode");
  if (statusCode && statusCode.toLowerCase() !== "success") {
    return {
      ok: false,
      code: pick(raw, "code") ?? statusCode,
      message: pick(raw, "message") ?? "Άγνωστο σφάλμα ΑΑΔΕ.",
      raw,
    };
  }
  // Τα ονόματα των πεδίων αναγνωριστικού, από το επίσημο `response-v1.1.xsd`.
  // ΔΙΑΦΕΡΟΥΝ ανά μέθοδο και ΔΕΝ ταυτίζονται με τα ονόματα του αιτήματος:
  // το άνοιγμα γυρίζει `newClientDclID` (όχι `idDcl`) και η ολοκλήρωση
  // `updatedClientDclID` (όχι `updateUniqueId`).
  const id =
    pick(raw, "newClientDclID") ??
    pick(raw, "updatedClientDclID") ??
    pick(raw, "cancellationID") ??
    pick(raw, "correlateId");

  if (!id) {
    return { ok: false, code: "NO_ID", message: "Η ΑΑΔΕ δεν επέστρεψε αναγνωριστικό.", raw };
  }
  return { ok: true, id: Number(id), raw };
}

async function post(config: DclConfig, path: string, xml: string): Promise<DclResult> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "aade-user-id": config.userId,
      "ocp-apim-subscription-key": config.subscriptionKey,
      "Content-Type": "application/xml",
    },
    body: xml,
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, code: `HTTP_${res.status}`, message: raw.slice(0, 300), raw };
  }
  return interpret(raw);
}

export const sendClient = (c: DclConfig, p: NewDigitalClient) =>
  post(c, "/DCL/SendClient", buildSendClientXml(p));

export const updateClient = (c: DclConfig, p: UpdateDigitalClient) =>
  post(c, "/DCL/UpdateClient", buildUpdateClientXml(p));

/** Ανάγνωση — δεν δημιουργεί τίποτα. Χρήσιμο για επαλήθευση και ανάκαμψη. */
export async function requestClients(
  c: DclConfig,
  fromDclId = 0
): Promise<{ ok: boolean; raw: string }> {
  const res = await fetch(`${c.baseUrl}/DCL/RequestClients?DCLID=${fromDclId}`, {
    headers: {
      "aade-user-id": c.userId,
      "ocp-apim-subscription-key": c.subscriptionKey,
    },
    signal: AbortSignal.timeout(30_000),
  });
  return { ok: res.ok, raw: await res.text() };
}
