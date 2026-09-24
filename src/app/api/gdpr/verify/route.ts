import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { responseDeadline } from "@/lib/gdpr";
import { appBaseUrl } from "@/lib/newsletter";
import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";

/**
 * Ο σύνδεσμος επαλήθευσης από το email του αιτούντος.
 *
 * Επιβεβαιώνει ότι η διεύθυνση ανήκει όντως σε αυτόν, βάζει την ώρα
 * επιβεβαίωσης και περνά το αίτημα από `VERIFYING` σε `IN_PROGRESS`. Η
 * προθεσμία των 30 ημερών ξαναμετράει από εδώ (άρ. 12 §3).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const back = (locale: string, ok: boolean) =>
    NextResponse.redirect(`${appBaseUrl()}/${locale}/data-rights?verified=${ok ? "1" : "0"}`);

  if (!token) return back(routing.defaultLocale, false);

  try {
    const found = await prisma.dataSubjectRequest.findUnique({
      where: { token },
      select: { id: true, status: true, verifiedAt: true, locale: true },
    });

    const locale =
      found?.locale && hasLocale(routing.locales, found.locale)
        ? found.locale
        : routing.defaultLocale;

    if (!found) return back(routing.defaultLocale, false);

    // Ήδη επιβεβαιωμένο: ο σύνδεσμος είναι μιας χρήσης, αλλά δεύτερο κλικ δεν
    // είναι σφάλμα του χρήστη — του δείχνουμε την ίδια επιβεβαίωση.
    if (found.verifiedAt) return back(locale, true);

    if (found.status !== "RECEIVED" && found.status !== "VERIFYING") {
      return back(locale, false);
    }

    const verifiedAt = new Date();
    await prisma.dataSubjectRequest.update({
      where: { id: found.id },
      data: {
        verifiedAt,
        status: "IN_PROGRESS",
        dueAt: responseDeadline(verifiedAt),
      },
    });

    return back(locale, true);
  } catch (error) {
    console.error("[GDPR] Could not verify the data subject request:", error);
    return back(routing.defaultLocale, false);
  }
}
