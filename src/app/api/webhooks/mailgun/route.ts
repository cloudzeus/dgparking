import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeEvent, storeEvents, type MailgunRawEvent } from "@/lib/mailgun-analytics";

/**
 * POST /api/webhooks/mailgun
 *
 * Δέχεται τα συμβάντα του Mailgun (delivered, opened, clicked, failed…) ώστε τα
 * στατιστικά να ενημερώνονται ζωντανά, χωρίς να ρωτάμε συνέχεια το Events API.
 *
 * Η υπογραφή ΕΛΕΓΧΕΤΑΙ ΠΑΝΤΑ: HMAC-SHA256 του `timestamp + token` με το
 * webhook signing key (`MAILGUN_WEBHOOK_SIGNING_KEY`), σύγκριση με
 * `crypto.timingSafeEqual`. Χωρίς κλειδί δεν δεχόμαστε τίποτα.
 *
 * Η διαδρομή είναι ήδη στη λίστα χωρίς σύνδεση (`/api/webhooks` στο proxy.ts).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Παλιότερα από αυτό θεωρούνται επανάληψη παλιού αιτήματος. */
const MAX_AGE_SECONDS = 15 * 60;

type WebhookPayload = {
  signature?: { timestamp?: string; token?: string; signature?: string };
  "event-data"?: MailgunRawEvent;
};

function verifySignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(`${timestamp}${token}`)
    .digest("hex");

  const given = Buffer.from(signature, "hex");
  const mine = Buffer.from(expected, "hex");
  if (given.length !== mine.length || given.length === 0) return false;
  return crypto.timingSafeEqual(given, mine);
}

export async function POST(request: Request) {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.error(
      "[MAILGUN-WEBHOOK] Λείπει το MAILGUN_WEBHOOK_SIGNING_KEY — τα συμβάντα απορρίπτονται.",
    );
    return NextResponse.json({ error: "webhook signing key not configured" }, { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { timestamp, token, signature } = payload.signature ?? {};
  if (!timestamp || !token || !signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > MAX_AGE_SECONDS) {
    return NextResponse.json({ error: "stale timestamp" }, { status: 401 });
  }

  if (!/^[0-9a-f]+$/i.test(signature) || !verifySignature(signingKey, timestamp, token, signature)) {
    console.warn("[MAILGUN-WEBHOOK] Απορρίφθηκε συμβάν με άκυρη υπογραφή.");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const raw = payload["event-data"];
  if (!raw) {
    // Υπογεγραμμένο αλλά χωρίς περιεχόμενο (π.χ. δοκιμή) — δεν είναι σφάλμα.
    return NextResponse.json({ ok: true, stored: 0 });
  }

  const event = normalizeEvent(raw);
  if (!event) {
    return NextResponse.json({ ok: true, stored: 0 });
  }

  try {
    const stored = await storeEvents([event]);
    return NextResponse.json({ ok: true, stored });
  } catch (error) {
    console.error("[MAILGUN-WEBHOOK] Η αποθήκευση απέτυχε:", error);
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }
}

/** Έλεγχος ότι η διαδρομή απαντά (δεν αποκαλύπτει τίποτα). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/mailgun",
    method: "POST",
    signed: true,
    configured: Boolean(process.env.MAILGUN_WEBHOOK_SIGNING_KEY),
  });
}
