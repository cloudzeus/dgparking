import { NextResponse } from "next/server";
import { logConsent } from "@/lib/gdpr";
import type { ConsentAction } from "@prisma/client";

/**
 * Οι επιλογές cookie του επισκέπτη, ως απόδειξη στη βάση (άρ. 7 §1).
 *
 * Μία εγγραφή ανά κατηγορία, με το ακριβές κείμενο που είχε μπροστά του και
 * την IP/συσκευή που δίνει το `logConsent`. Τα απαραίτητα cookies δεν
 * καταγράφονται: δεν στηρίζονται σε συγκατάθεση.
 */

type ConsentBody = {
  analytics: boolean;
  marketing: boolean;
  /** Το κείμενο του banner/διαλόγου, στη γλώσσα που το είδε. */
  consentText: string;
  locale?: string;
};

function parseBody(payload: unknown): ConsentBody | null {
  if (typeof payload !== "object" || payload === null) return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.analytics !== "boolean" || typeof body.marketing !== "boolean") return null;
  if (typeof body.consentText !== "string" || body.consentText.trim() === "") return null;
  return {
    analytics: body.analytics,
    marketing: body.marketing,
    consentText: body.consentText.slice(0, 2000),
    locale: typeof body.locale === "string" ? body.locale.slice(0, 2) : undefined,
  };
}

const action = (granted: boolean): ConsentAction => (granted ? "GRANTED" : "WITHDRAWN");

export async function POST(request: Request) {
  try {
    const body = parseBody(await request.json());
    if (!body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await Promise.all([
      logConsent({
        type: "COOKIES_ANALYTICS",
        action: action(body.analytics),
        consentText: body.consentText,
        method: "banner",
        locale: body.locale ?? null,
      }),
      logConsent({
        type: "COOKIES_MARKETING",
        action: action(body.marketing),
        consentText: body.consentText,
        method: "banner",
        locale: body.locale ?? null,
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[GDPR] Could not record the cookie choice:", error);
    // Η επιλογή του επισκέπτη ισχύει ούτως ή άλλως στη συσκευή του — δεν τον
    // μπλοκάρουμε επειδή απέτυχε η καταγραφή.
    return NextResponse.json({ error: "Could not record consent" }, { status: 500 });
  }
}
