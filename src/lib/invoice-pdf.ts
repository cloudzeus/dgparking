/**
 * Αρχειοθέτηση τιμολογίων σε PDF.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ
 * Το τιμολόγιο ζει στον πάροχο ηλεκτρονικής τιμολόγησης. Ο σύνδεσμος που
 * κρατά το ERP (`MTRDOC.SOSIGNQR`) οδηγεί σε σελίδα του παρόχου, εκτός του
 * ελέγχου μας: αλλάζει διεύθυνση, μπορεί να ζητήσει σύνδεση, και κάποτε θα
 * πάψει να δείχνει παλιά παραστατικά. Ο πελάτης που θέλει να τυπώσει δώδεκα
 * μήνες τιμολογίων δεν πρέπει να εξαρτάται από τίποτα από αυτά.
 *
 * Η ΛΥΣΗ
 * Κατεβάζουμε το PDF μία φορά και το κρατάμε εμείς. Η διεύθυνση του παρόχου
 * δέχεται `/pdf` στο τέλος του δημόσιου permalink και επιστρέφει το αρχείο.
 *
 * ΓΙΑΤΙ ΔΕΝ ΔΙΝΟΥΜΕ ΤΟΝ ΣΥΝΔΕΣΜΟ ΤΟΥ CDN ΣΤΟΝ ΠΕΛΑΤΗ
 * Το τιμολόγιο περιέχει προσωπικά και οικονομικά στοιχεία. Μια διεύθυνση CDN
 * είναι δημόσια σε όποιον τη μάθει, για πάντα. Το αρχείο σερβίρεται πάντα
 * μέσα από δικό μας endpoint που ελέγχει ότι το παραστατικό ανήκει στον
 * συνδεδεμένο πελάτη· η διαδρομή στο CDN μένει κρυφή και τυχαία.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const STORAGE_HOST = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";

/** Το μέγιστο που δεχόμαστε — ένα τιμολόγιο υπηρεσιών δεν είναι ποτέ τόσο. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Η διεύθυνση του PDF στον πάροχο.
 *
 * Δέχεται μόνο permalinks `/p/` του παρόχου· οτιδήποτε άλλο (π.χ. η γυμνή
 * αρχική σελίδα, που οδηγεί σε φόρμα σύνδεσης) απορρίπτεται αντί να
 * κατεβάσουμε μια σελίδα HTML και να τη σώσουμε σαν τιμολόγιο.
 */
export function pdfUrlFor(permalink: string): string | null {
  let u: URL;
  try {
    u = new URL(permalink);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!/(^|\.)impact\.gr$/i.test(u.hostname)) return null;
  if (!/^\/p\/[^/]+\/[^/]+\/[^/]+\/?$/.test(u.pathname)) return null;
  return `${u.origin}${u.pathname.replace(/\/$/, "")}/pdf`;
}

/**
 * Κατεβάζει και αποθηκεύει το PDF, ή επιστρέφει το ήδη αποθηκευμένο.
 *
 * Είναι ιδιοκτησιακά ουδέτερη: ΔΕΝ ελέγχει σε ποιον ανήκει το παραστατικό.
 * Αυτό είναι δουλειά του καλούντος, που ξέρει τη συνεδρία.
 */
export async function archiveInvoicePdf(
  findoc: number,
  permalink: string
): Promise<{ path: string; bytes: number } | { error: string }> {
  const existing = await prisma.invoicePdf.findUnique({ where: { findoc } });
  if (existing) return { path: existing.storagePath, bytes: existing.bytes };

  if (!STORAGE_ZONE || !ACCESS_KEY) return { error: "Δεν έχει ρυθμιστεί αποθήκευση αρχείων." };

  const src = pdfUrlFor(permalink);
  if (!src) return { error: "Ο σύνδεσμος του παραστατικού δεν είναι έγκυρος." };

  let body: Buffer;
  try {
    const res = await fetch(src, { redirect: "follow", signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return { error: `Ο πάροχος απάντησε ${res.status}.` };
    const type = res.headers.get("content-type") ?? "";
    // Χωρίς αυτόν τον έλεγχο, μια σελίδα σφάλματος του παρόχου θα
    // αποθηκευόταν ως «τιμολόγιο» και θα ανακαλυπτόταν μήνες μετά.
    if (!type.toLowerCase().includes("pdf")) return { error: `Ο πάροχος δεν επέστρεψε PDF (${type}).` };
    body = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Η λήψη απέτυχε." };
  }

  if (body.length === 0) return { error: "Ο πάροχος επέστρεψε κενό αρχείο." };
  if (body.length > MAX_BYTES) return { error: "Το αρχείο είναι υπερβολικά μεγάλο." };
  if (body.subarray(0, 5).toString("latin1") !== "%PDF-") return { error: "Το αρχείο δεν είναι PDF." };

  // Τυχαίο όνομα: η διαδρομή δεν πρέπει να μαντεύεται από τον αριθμό
  // παραστατικού, γιατί το CDN δεν ελέγχει ποιος ζητά το αρχείο.
  const path = `invoices/${findoc}-${randomBytes(16).toString("hex")}.pdf`;
  const put = await fetch(`https://${STORAGE_HOST}/${STORAGE_ZONE}/${path}`, {
    method: "PUT",
    headers: { AccessKey: ACCESS_KEY, "Content-Type": "application/pdf" },
    body: new Uint8Array(body),
  });
  if (!put.ok) return { error: `Η αποθήκευση απέτυχε (${put.status}).` };

  await prisma.invoicePdf.create({
    data: { findoc, storagePath: path, bytes: body.length, sourceUrl: permalink },
  });
  return { path, bytes: body.length };
}

/** Το αποθηκευμένο αρχείο, για σερβίρισμα. */
export async function readArchivedPdf(path: string): Promise<Buffer | null> {
  if (!STORAGE_ZONE || !ACCESS_KEY) return null;
  const res = await fetch(`https://${STORAGE_HOST}/${STORAGE_ZONE}/${path}`, {
    headers: { AccessKey: ACCESS_KEY },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
