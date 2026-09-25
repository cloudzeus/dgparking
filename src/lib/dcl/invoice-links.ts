/**
 * Σύνδεσμοι παραστατικών για τη σελίδα του Ψηφιακού Πελατολογίου.
 *
 * Κάθε εγγραφή του βιβλίου πόρτας κρατά το `FINDOC` της απόδειξης που
 * εκδόθηκε (0 όταν δεν εκδόθηκε). Ο πραγματικός σύνδεσμος όμως ζει αλλού,
 * στο `MTRDOC.SOSIGNQR` — το δημόσιο permalink της ΑΑΔΕ που τυπώνεται ως QR
 * πάνω στο παραστατικό.
 *
 * ΓΙΑΤΙ ΜΙΑ ΜΑΖΙΚΗ ΚΛΗΣΗ
 * Μια κλήση ανά γραμμή θα σήμαινε διακόσιες κλήσεις στο ERP για μια σελίδα.
 * Τα `FINDOC` μαζεύονται και ρωτιούνται μία φορά.
 */

import { prisma } from "@/lib/prisma";
import { authenticateSoftOneAPI, getSoftOneTableData } from "@/lib/softone-api";
import { decrypt } from "@/lib/encryption";

export type InvoiceLink = {
  findoc: number;
  /** Το permalink της ΑΑΔΕ, όπως το κρατά το ERP. */
  url: string;
  code: string | null;
};

export async function fetchInvoiceLinks(
  findocs: number[]
): Promise<Map<number, InvoiceLink>> {
  const ids = [...new Set(findocs.filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) return new Map();

  const company = Number(process.env.PARKING_COMPANY ?? 1002);
  const connection = await prisma.softOneConnection.findFirst({ where: { company } });
  if (!connection) return new Map();

  const auth = await authenticateSoftOneAPI(
    connection.username,
    decrypt(connection.passwordEnc),
    String(connection.appId),
    String(connection.company),
    String(connection.branch),
    String(connection.module),
    String(connection.refid),
    undefined,
    connection.registeredName
  );
  if (!auth.success || !auth.clientID) return new Map();

  const out = new Map<number, InvoiceLink>();

  // Το `FINDOC IN (...)` με εκατοντάδες τιμές σπάει το φίλτρο του ERP, οπότε
  // η ερώτηση κόβεται σε κομμάτια.
  const CHUNK = 120;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const res = await getSoftOneTableData(
      "MTRDOC",
      "FINDOC,SOSIGNQR",
      auth.clientID,
      connection.appId,
      `COMPANY=${company} AND FINDOC IN (${slice.join(",")})`
    ).catch(() => null);
    if (!res?.success || !res.data) continue;

    for (const row of res.data as unknown[][]) {
      const findoc = Number(row[0]);
      const url = String(row[1] ?? "").trim();
      if (findoc && url.startsWith("http")) out.set(findoc, { findoc, url, code: null });
    }
  }

  // Οι κωδικοί (ΑΛΠ0003028) ζουν στο `FINDOC`, όχι στο `MTRDOC`.
  const found = [...out.keys()];
  for (let i = 0; i < found.length; i += CHUNK) {
    const slice = found.slice(i, i + CHUNK);
    const res = await getSoftOneTableData(
      "FINDOC",
      "FINDOC,FINCODE",
      auth.clientID,
      connection.appId,
      `COMPANY=${company} AND FINDOC IN (${slice.join(",")})`
    ).catch(() => null);
    if (!res?.success || !res.data) continue;
    for (const row of res.data as unknown[][]) {
      const findoc = Number(row[0]);
      const entry = out.get(findoc);
      if (entry) entry.code = String(row[1] ?? "").trim() || null;
    }
  }

  return out;
}
