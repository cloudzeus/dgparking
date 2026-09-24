import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalCustomer, getPortalInvoices } from "@/lib/portal-data";
import { archiveInvoicePdf, readArchivedPdf } from "@/lib/invoice-pdf";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/portal/invoices/[findoc]
 *
 * Το τιμολόγιο του πελάτη σε PDF.
 *
 * ΓΙΑΤΙ ΠΕΡΝΑΕΙ ΑΠΟ ΕΔΩ ΚΑΙ ΔΕΝ ΔΙΝΟΥΜΕ ΣΥΝΔΕΣΜΟ
 * Ο σύνδεσμος του παρόχου είναι εκτός ελέγχου μας — μπορεί να ζητήσει
 * σύνδεση ή να πάψει να δείχνει παλιά παραστατικά — και ένας δημόσιος
 * σύνδεσμος CDN θα έδινε σε όποιον τον μάθει πρόσβαση σε οικονομικά
 * στοιχεία, για πάντα. Εδώ ελέγχεται πρώτα ότι το παραστατικό ανήκει στον
 * συνδεδεμένο πελάτη, και μόνο τότε σερβίρεται το αρχείο.
 *
 * Το PDF κατεβαίνει από τον πάροχο την πρώτη φορά και μετά μένει δικό μας.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ findoc: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Απαιτείται σύνδεση." }, { status: 401 });
  }

  const { findoc: raw } = await params;
  const findoc = Number(raw);
  if (!Number.isInteger(findoc) || findoc <= 0) {
    return NextResponse.json({ error: "Άκυρο παραστατικό." }, { status: 400 });
  }

  const customer = await getPortalCustomer(session.user.id as string);
  if (!customer) {
    return NextResponse.json({ error: "Ο λογαριασμός δεν έχει συνδεθεί με πελάτη." }, { status: 403 });
  }

  // Ο ΕΛΕΓΧΟΣ ΙΔΙΟΚΤΗΣΙΑΣ. Η λίστα προκύπτει από το ERP φιλτραρισμένη στον
  // συγκεκριμένο πελάτη, οπότε ένα παραστατικό άλλου δεν μπορεί να βρεθεί
  // εδώ όσο κι αν μαντέψει κανείς τον αριθμό.
  let mine;
  try {
    const invoices = await getPortalInvoices(customer.trdr);
    mine = invoices.find((i) => i.findoc === findoc);
  } catch (e) {
    console.error("[PORTAL-INVOICE] Αποτυχία ανάγνωσης παραστατικών:", e);
    return NextResponse.json({ error: "Δεν ήταν δυνατή η ανάκτηση των τιμολογίων." }, { status: 502 });
  }
  if (!mine) {
    return NextResponse.json({ error: "Το παραστατικό δεν βρέθηκε." }, { status: 404 });
  }

  const stored = await prisma.invoicePdf.findUnique({ where: { findoc } });
  let path = stored?.storagePath ?? null;

  if (!path) {
    if (!mine.url) {
      return NextResponse.json(
        { error: "Το παραστατικό δεν έχει ακόμα σύνδεσμο από τον πάροχο." },
        { status: 409 }
      );
    }
    const archived = await archiveInvoicePdf(findoc, mine.url);
    if ("error" in archived) {
      console.error(`[PORTAL-INVOICE] ${findoc}: ${archived.error}`);
      return NextResponse.json({ error: archived.error }, { status: 502 });
    }
    path = archived.path;
  }

  const pdf = await readArchivedPdf(path);
  if (!pdf) {
    return NextResponse.json({ error: "Το αρχείο δεν είναι διαθέσιμο." }, { status: 502 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline`: ανοίγει στον browser για να το δει ή να το τυπώσει, με
      // ανθρώπινο όνομα αν επιλέξει αποθήκευση.
      "Content-Disposition": `inline; filename="${(mine.code || `invoice-${findoc}`).replace(/[^\w.-]/g, "_")}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
