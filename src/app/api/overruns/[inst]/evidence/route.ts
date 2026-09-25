import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildOverrunEvidence } from "@/lib/overrun-evidence";

/**
 * GET /api/overruns/[inst]/evidence?days=7
 *
 * Το αποδεικτικό μιας υπέρβασης σε PDF — ό,τι χρειάζεται για να τιμολογηθεί
 * ο πελάτης πέραν της σύμβασης: οχήματα, ώρες, φωτογραφίες, χρεώσιμος χρόνος.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ inst: string }> }
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Δεν έχετε δικαίωμα." }, { status: 403 });
  }

  const { inst: raw } = await params;
  const inst = Number(raw);
  if (!Number.isInteger(inst) || inst <= 0) {
    return NextResponse.json({ error: "Άκυρη σύμβαση." }, { status: 400 });
  }

  const days = Number(new URL(request.url).searchParams.get("days")) || 7;
  const result = await buildOverrunEvidence(inst, days);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="yperbasi-${inst}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
