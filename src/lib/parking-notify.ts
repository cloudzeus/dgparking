/**
 * Ειδοποιήσεις αποκλίσεων παρκινγκ.
 *
 * ΓΙΑΤΙ ΔΥΟ ΚΑΝΑΛΙΑ
 * Μετρήσαμε ~146 αποκλίσεις το 24ωρο. Αν σταλούν όλες ως ξεχωριστά email, ο
 * παραλήπτης σταματά να τα διαβάζει την πρώτη μέρα και χάνονται ακριβώς αυτές
 * που έχουν σημασία. Οπότε:
 *   - ΑΜΕΣΑ  → μόνο διαφορά ποσού και διαφορά ώρας (~12/ημέρα, οικονομικό βάρος)
 *   - ΣΥΝΟΨΗ → όλα τα υπόλοιπα, μία φορά την ημέρα, με αριθμούς και τα κυριότερα
 *
 * Κάθε απόκλιση ειδοποιείται ΜΙΑ φορά: το `notifiedAt` σφραγίζεται μόλις σταλεί.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailgun";
import {
  parkingDeviationAlertEmail,
  parkingDeviationDigestEmail,
  type DeviationItem,
  type DeviationKind,
  type DigestCounts,
} from "@/emails/templates/parking-deviation";
import type { ParkingDeviation } from "@prisma/client";

/** Είδη που δικαιολογούν άμεσο email. */
// Η μη κλεισμένη έξοδος μπαίνει κι αυτή στις άμεσες: σημαίνει στάθμευση που
// δεν τιμολογήθηκε, δηλαδή ίδιο οικονομικό βάρος με τη διαφορά ποσού.
const IMMEDIATE: DeviationKind[] = ["AMOUNT_DIFF", "TIME_DIFF", "EXIT_DIFF"];
/** Πόσες περιπτώσεις αναλύονται μέσα στη σύνοψη. */
const HIGHLIGHT_LIMIT = 10;
/** Φρένο ασφαλείας: ποτέ περισσότερα από τόσα άμεσα email σε μία εκτέλεση. */
const MAX_IMMEDIATE_PER_RUN = 20;

function toItem(d: ParkingDeviation): DeviationItem {
  return {
    plate: d.plate,
    kind: d.kind as DeviationKind,
    explanation: d.explanation,
    ourEntry: d.ourEntry,
    ourExit: d.ourExit,
    ourAmount: d.ourAmount,
    erpEntry: d.erpEntry,
    erpExit: d.erpExit,
    erpAmount: d.erpAmount,
    erpSoaction: d.erpSoaction,
  };
}

function reviewUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return base ? `${base.replace(/\/$/, "")}/reconciliation` : undefined;
}

/**
 * Στέλνει τα άμεσα email για τις σοβαρές αποκλίσεις που δεν έχουν ειδοποιηθεί.
 * Οι υπόλοιπες μένουν στην ουρά και φεύγουν με τη σύνοψη.
 */
export async function sendImmediateAlerts() {
  const pending = await prisma.parkingDeviation.findMany({
    where: { notifiedAt: null, resolvedAt: null, kind: { in: IMMEDIATE } },
    orderBy: { firstSeenAt: "asc" },
    take: MAX_IMMEDIATE_PER_RUN,
  });

  const sent: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const deviation of pending) {
    const email = parkingDeviationAlertEmail({
      item: toItem(deviation),
      detectedAt: deviation.firstSeenAt,
      reviewUrl: reviewUrl(),
    });
    const result = await sendEmail({
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    if (result.success) sent.push(deviation.id);
    else failed.push({ id: deviation.id, error: result.error ?? "άγνωστο σφάλμα" });
  }

  if (sent.length) {
    await prisma.parkingDeviation.updateMany({
      where: { id: { in: sent } },
      data: { notifiedAt: new Date() },
    });
  }

  return { candidates: pending.length, sent: sent.length, failed };
}

/**
 * Ημερήσια σύνοψη για ό,τι εντοπίστηκε στο διάστημα, και σφράγισμα όλων των
 * εκκρεμών ως ειδοποιημένων — ακόμα και όσων δεν μπήκαν στα highlights, αφού
 * έχουν ήδη μετρηθεί στους αριθμούς.
 */
export async function sendDailyDigest(hours = 24) {
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const deviations = await prisma.parkingDeviation.findMany({
    where: { firstSeenAt: { gte: since }, resolvedAt: null },
    orderBy: { firstSeenAt: "desc" },
  });

  const counts = {
    AMOUNT_DIFF: 0,
    TIME_DIFF: 0,
    EXIT_DIFF: 0,
    MISSING_IN_ERP: 0,
    MISSING_IN_CAMERAS: 0,
  } as DigestCounts;
  let amountDelta = 0;
  for (const d of deviations) {
    counts[d.kind as DeviationKind] += 1;
    amountDelta += (d.ourAmount ?? 0) - (d.erpAmount ?? 0);
  }
  amountDelta = Math.round(amountDelta * 100) / 100;

  // Email στέλνουμε ΜΟΝΟ όταν υπάρχει ασυμφωνία. Ένα καθημερινό «όλα καλά»
  // εκπαιδεύει τον παραλήπτη να αγνοεί τον αποστολέα, και τότε χάνεται και το
  // μήνυμα που έχει σημασία.
  if (deviations.length === 0) {
    return { total: 0, counts, amountDelta: 0, sent: false, skipped: true as const };
  }

  // Πρώτα οι οικονομικές, μετά οι υπόλοιπες — η σύνοψη πρέπει να ανοίγει με ό,τι κοστίζει.
  const ranked = [...deviations].sort((a, b) => {
    const wa = IMMEDIATE.includes(a.kind as DeviationKind) ? 0 : 1;
    const wb = IMMEDIATE.includes(b.kind as DeviationKind) ? 0 : 1;
    return wa - wb;
  });

  const periodLabel = `τελευταίων ${hours} ωρών`;
  const email = parkingDeviationDigestEmail({
    counts,
    highlights: ranked.slice(0, HIGHLIGHT_LIMIT).map(toItem),
    periodLabel,
    amountDelta,
    reviewUrl: reviewUrl(),
  });

  const result = await sendEmail({
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (result.success) {
    const ids = deviations.filter((d) => d.notifiedAt === null).map((d) => d.id);
    if (ids.length) {
      await prisma.parkingDeviation.updateMany({
        where: { id: { in: ids } },
        data: { notifiedAt: new Date() },
      });
    }
  }

  return {
    total: deviations.length,
    counts,
    amountDelta,
    sent: result.success,
    skipped: false as const,
    error: result.success ? undefined : result.error,
  };
}
