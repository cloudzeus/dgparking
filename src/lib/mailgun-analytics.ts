import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMailgunConfig, mailgunBaseUrl, type MailgunConfig } from "@/lib/mailgun";

/**
 * Στατιστικά ενημερωτικού δελτίου από το Mailgun.
 *
 * Ο λογαριασμός είναι ΕΥΡΩΠΗΣ: όλες οι κλήσεις πάνε στο `api.eu.mailgun.net`
 * (η περιοχή έρχεται από τις ρυθμίσεις, `mailgunBaseUrl`). Κλειδί EU σε
 * αμερικανικό endpoint απαντά 401.
 *
 * Καμία συνάρτηση δεν πετάει σφάλμα δικτύου στη διεπαφή: όλα επιστρέφουν
 * `MailgunResult<T>` και η σελίδα δείχνει το μήνυμα στα ελληνικά.
 */

// ── Τύποι ────────────────────────────────────────────────────────────────────

export type MailgunResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Ένα συμβάν όπως το δίνει το Events API ή το `event-data` του webhook. */
export type MailgunRawEvent = {
  event?: string;
  timestamp?: number;
  recipient?: string;
  url?: string;
  reason?: string;
  severity?: string;
  message?: { headers?: { "message-id"?: string } };
  geolocation?: { city?: string | null; country?: string | null };
  "client-info"?: { "client-name"?: string | null; "device-type"?: string | null };
  "delivery-status"?: { message?: string | null; description?: string | null };
  "user-variables"?: Record<string, unknown>;
};

type EventsApiResponse = {
  items?: MailgunRawEvent[];
  paging?: { next?: string; previous?: string; first?: string; last?: string };
};

/** Κανονικοποιημένο συμβάν, έτοιμο για τον πίνακα `newsletter_events`. */
export type NormalizedEvent = {
  messageId: string | null;
  email: string;
  event: string;
  url: string | null;
  reason: string | null;
  city: string | null;
  country: string | null;
  clientName: string | null;
  deviceType: string | null;
  timestamp: Date;
};

export type FetchEventsOptions = {
  /** Αρχή περιόδου. */
  begin: Date;
  /** Τέλος περιόδου (προεπιλογή: τώρα). */
  end?: Date;
  /** Φίλτρο τύπου συμβάντος (`delivered`, `opened`, `clicked`…). */
  event?: string;
  /** Φίλτρο σε συγκεκριμένο Message-Id. */
  messageId?: string;
  /** Εγγραφές ανά σελίδα (το Mailgun δέχεται έως 300). */
  limit?: number;
  /** Ανώτατο πλήθος σελίδων ώστε η κλήση να μην τρέχει ποτέ ατέρμονα. */
  maxPages?: number;
};

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_LIMIT = 300;

/** Τα συμβάντα που καταλαβαίνει η σελίδα στατιστικών. */
export const TRACKED_EVENTS = [
  "accepted",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "rejected",
  "complained",
  "unsubscribed",
] as const;

// ── Βοηθητικά ────────────────────────────────────────────────────────────────

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
}

/** Το Mailgun δίνει το Message-Id άλλοτε με `<…>` και άλλοτε χωρίς. */
export function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^<|>$/g, "");
  return trimmed.length > 0 ? trimmed.slice(0, 255) : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

/** Μετατρέπει ένα ακατέργαστο συμβάν (API ή webhook) σε γραμμή της βάσης. */
export function normalizeEvent(raw: MailgunRawEvent): NormalizedEvent | null {
  const email = text(raw.recipient, 255);
  const event = text(raw.event, 30);
  if (!email || !event) return null;

  const seconds = typeof raw.timestamp === "number" ? raw.timestamp : Number(raw.timestamp);
  if (!Number.isFinite(seconds)) return null;

  const clientInfo = raw["client-info"] ?? {};
  const deliveryStatus = raw["delivery-status"] ?? {};

  return {
    messageId: normalizeMessageId(raw.message?.headers?.["message-id"]),
    email,
    event: event.toLowerCase(),
    url: text(raw.url, 2000),
    reason:
      text(raw.reason, 2000) ??
      text(deliveryStatus.description, 2000) ??
      text(deliveryStatus.message, 2000),
    city: text(raw.geolocation?.city, 100),
    country: text(raw.geolocation?.country, 2),
    clientName: text(clientInfo["client-name"], 100),
    deviceType: text(clientInfo["device-type"], 50),
    timestamp: new Date(Math.round(seconds * 1000)),
  };
}

function describeHttpError(status: number, body: string): string {
  let detail = body;
  try {
    detail = (JSON.parse(body) as { message?: string }).message ?? body;
  } catch {
    // κρατάμε το σκέτο κείμενο — σε 401 το Mailgun δεν στέλνει JSON
  }
  if (status === 401) {
    return "Το Mailgun απέρριψε το κλειδί (401). Λάθος κλειδί API ή λάθος περιοχή — ο λογαριασμός είναι EU και θέλει api.eu.mailgun.net.";
  }
  if (status === 404) {
    return "Το Mailgun δεν βρήκε το domain (404). Έλεγξε το domain στις ρυθμίσεις.";
  }
  return `Σφάλμα Mailgun ${status}: ${detail.slice(0, 500)}`;
}

// ── Events API ───────────────────────────────────────────────────────────────

/**
 * Κατεβάζει συμβάντα από το Events API, ακολουθώντας τον δείκτη `paging.next`
 * μέχρι το `maxPages` (προεπιλογή 20) — ποτέ ατέρμονος βρόχος.
 *
 * GET {base}/{domain}/events
 */
export async function fetchEvents(
  options: FetchEventsOptions,
  config?: MailgunConfig,
): Promise<MailgunResult<MailgunRawEvent[]>> {
  const settings = config ?? (await getMailgunConfig());
  if (!settings) {
    return { ok: false, error: "Δεν έχουν οριστεί ρυθμίσεις Mailgun (Ρυθμίσεις → Mailgun)." };
  }

  const { begin, end = new Date(), event, messageId, limit = DEFAULT_LIMIT } = options;
  const maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);

  const params = new URLSearchParams();
  params.set("begin", String(Math.floor(begin.getTime() / 1000)));
  params.set("end", String(Math.floor(end.getTime() / 1000)));
  params.set("ascending", "yes");
  params.set("limit", String(Math.min(Math.max(limit, 1), 300)));
  if (event) params.set("event", event);
  if (messageId) params.set("message-id", messageId);

  let url = `${mailgunBaseUrl(settings.region)}/${encodeURIComponent(settings.domain)}/events?${params.toString()}`;
  const items: MailgunRawEvent[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: authHeader(settings.apiKey), Accept: "application/json" },
        cache: "no-store",
      });
    } catch (error) {
      console.error("[MAILGUN-ANALYTICS] Η κλήση απέτυχε:", error);
      return {
        ok: false,
        error: "Δεν ήταν δυνατή η επικοινωνία με το Mailgun. Δοκίμασε ξανά σε λίγο.",
      };
    }

    const body = await res.text();
    if (!res.ok) {
      return { ok: false, error: describeHttpError(res.status, body) };
    }

    let parsed: EventsApiResponse;
    try {
      parsed = JSON.parse(body) as EventsApiResponse;
    } catch {
      return { ok: false, error: "Το Mailgun απάντησε με μη αναγνώσιμο περιεχόμενο." };
    }

    const pageItems = parsed.items ?? [];
    items.push(...pageItems);

    const next = parsed.paging?.next;
    if (pageItems.length === 0 || !next || next === url) break;
    url = next;
  }

  return { ok: true, data: items };
}

// ── Αποθήκευση ───────────────────────────────────────────────────────────────

/**
 * Γράφει συμβάντα στη βάση. Μοναδικό κλειδί `messageId+event+email+timestamp`,
 * οπότε η ίδια κλήση μπορεί να ξανατρέξει χωρίς διπλοεγγραφές. Την ίδια πόρτα
 * χρησιμοποιεί και ο webhook receiver.
 */
export async function storeEvents(
  events: NormalizedEvent[],
  campaignIdByMessageId?: Map<string, string>,
): Promise<number> {
  if (events.length === 0) return 0;

  const lookup = campaignIdByMessageId ?? (await messageIdIndex(events));

  const rows: Prisma.NewsletterEventCreateManyInput[] = events.map((e) => ({
    campaignId: e.messageId ? (lookup.get(e.messageId) ?? null) : null,
    messageId: e.messageId,
    email: e.email,
    event: e.event,
    url: e.url,
    reason: e.reason,
    city: e.city,
    country: e.country,
    clientName: e.clientName,
    deviceType: e.deviceType,
    timestamp: e.timestamp,
  }));

  const result = await prisma.newsletterEvent.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/** Αντιστοίχιση Message-Id → αποστολή, από τους παραλήπτες που έχουμε καταγράψει. */
async function messageIdIndex(events: NormalizedEvent[]): Promise<Map<string, string>> {
  const ids = [...new Set(events.map((e) => e.messageId).filter((id): id is string => !!id))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const recipients = await prisma.newsletterRecipient.findMany({
    where: { messageId: { in: ids } },
    select: { messageId: true, campaignId: true },
  });
  for (const r of recipients) {
    const key = normalizeMessageId(r.messageId);
    if (key) map.set(key, r.campaignId);
  }

  // Οι παραλήπτες αποθηκεύονται συχνά με `<…>` — δοκίμασε και τη γυμνή μορφή.
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const bracketed = await prisma.newsletterRecipient.findMany({
      where: { messageId: { in: missing.map((id) => `<${id}>`) } },
      select: { messageId: true, campaignId: true },
    });
    for (const r of bracketed) {
      const key = normalizeMessageId(r.messageId);
      if (key) map.set(key, r.campaignId);
    }
  }

  return map;
}

export type SyncSummary = { fetched: number; stored: number; campaignId: string };

/**
 * Κατεβάζει τα συμβάντα μιας αποστολής και τα γράφει στη βάση.
 * Η περίοδος ξεκινά μία ώρα πριν την αποστολή, για να μη χαθεί τίποτα.
 */
export async function syncCampaignEvents(campaignId: string): Promise<MailgunResult<SyncSummary>> {
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, sentAt: true, createdAt: true },
  });
  if (!campaign) {
    return { ok: false, error: "Η αποστολή δεν βρέθηκε." };
  }

  const recipients = await prisma.newsletterRecipient.findMany({
    where: { campaignId },
    select: { email: true, messageId: true, campaignId: true },
  });
  if (recipients.length === 0) {
    return { ok: false, error: "Η αποστολή δεν έχει παραλήπτες ακόμη." };
  }

  const lookup = new Map<string, string>();
  const emails = new Set<string>();
  for (const r of recipients) {
    emails.add(r.email.toLowerCase());
    const key = normalizeMessageId(r.messageId);
    if (key) lookup.set(key, r.campaignId);
  }

  const start = campaign.sentAt ?? campaign.createdAt;
  const begin = new Date(start.getTime() - 60 * 60 * 1000);

  const fetched = await fetchEvents({ begin });
  if (!fetched.ok) return fetched;

  const normalized: NormalizedEvent[] = [];
  for (const raw of fetched.data) {
    const event = normalizeEvent(raw);
    if (!event) continue;
    const belongs =
      (event.messageId && lookup.has(event.messageId)) || emails.has(event.email.toLowerCase());
    if (belongs) normalized.push(event);
  }

  const stored = await storeEvents(normalized, lookup);

  // Συμβάντα που ήρθαν από webhook χωρίς αντιστοίχιση — δώσ' τους την αποστολή.
  const orphanIds = [...lookup.keys()];
  if (orphanIds.length > 0) {
    await prisma.newsletterEvent.updateMany({
      where: { campaignId: null, messageId: { in: orphanIds } },
      data: { campaignId },
    });
  }

  return { ok: true, data: { fetched: normalized.length, stored, campaignId } };
}

// ── Συγκεντρωτικά από τη βάση ────────────────────────────────────────────────

export type CampaignStats = {
  campaignId: string | null;
  /** Παραλήπτες τη στιγμή της αποστολής. */
  sent: number;
  delivered: number;
  openedUnique: number;
  openedTotal: number;
  clickedUnique: number;
  clickedTotal: number;
  /** Μοναδικοί παραλήπτες με οριστική αποτυχία (bounce / απόρριψη). */
  bounced: number;
  /** Συνολικά συμβάντα αποτυχίας. */
  failedTotal: number;
  complained: number;
  unsubscribed: number;
  /** Ποσοστά 0–100. */
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  /** Click-to-open rate: κλικ ως προς ανοίγματα. */
  ctor: number;
};

const FAILURE_EVENTS = ["failed", "rejected", "bounced"];

function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

type EventCountRow = { campaignId: string | null; event: string; total: number; unique: number };

async function eventCounts(campaignId?: string): Promise<EventCountRow[]> {
  const where: Prisma.NewsletterEventWhereInput = campaignId ? { campaignId } : {};

  const [totals, uniques] = await Promise.all([
    prisma.newsletterEvent.groupBy({
      by: ["campaignId", "event"],
      where,
      _count: { _all: true },
    }),
    prisma.newsletterEvent.groupBy({
      by: ["campaignId", "event", "email"],
      where,
    }),
  ]);

  const uniqueByKey = new Map<string, number>();
  for (const row of uniques) {
    const key = `${row.campaignId ?? ""}::${row.event}`;
    uniqueByKey.set(key, (uniqueByKey.get(key) ?? 0) + 1);
  }

  return totals.map((row) => ({
    campaignId: row.campaignId,
    event: row.event,
    total: row._count._all,
    unique: uniqueByKey.get(`${row.campaignId ?? ""}::${row.event}`) ?? 0,
  }));
}

function buildStats(campaignId: string | null, sent: number, rows: EventCountRow[]): CampaignStats {
  const total = (event: string) =>
    rows.filter((r) => r.event === event).reduce((sum, r) => sum + r.total, 0);
  const unique = (event: string) =>
    rows.filter((r) => r.event === event).reduce((sum, r) => sum + r.unique, 0);

  const delivered = unique("delivered");
  const openedUnique = unique("opened");
  const clickedUnique = unique("clicked");
  const bounced = FAILURE_EVENTS.reduce((sum, e) => sum + unique(e), 0);
  const failedTotal = FAILURE_EVENTS.reduce((sum, e) => sum + total(e), 0);
  const base = delivered > 0 ? delivered : sent;

  return {
    campaignId,
    sent,
    delivered,
    openedUnique,
    openedTotal: total("opened"),
    clickedUnique,
    clickedTotal: total("clicked"),
    bounced,
    failedTotal,
    complained: unique("complained"),
    unsubscribed: unique("unsubscribed"),
    deliveryRate: rate(delivered, sent),
    openRate: rate(openedUnique, base),
    clickRate: rate(clickedUnique, base),
    ctor: rate(clickedUnique, openedUnique),
  };
}

/** Συγκεντρωτικά μιας αποστολής (ή όλων, αν δεν δοθεί `campaignId`). */
export async function campaignStats(campaignId?: string): Promise<CampaignStats> {
  const [rows, sentAgg] = await Promise.all([
    eventCounts(campaignId),
    prisma.newsletterCampaign.aggregate({
      where: campaignId ? { id: campaignId } : {},
      _sum: { totalRecipients: true },
    }),
  ]);
  return buildStats(campaignId ?? null, sentAgg._sum.totalRecipients ?? 0, rows);
}

export type CampaignWithStats = {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
  stats: CampaignStats;
};

/** Όλες οι αποστολές με τα συγκεντρωτικά τους — μία φορά, χωρίς N+1. */
export async function allCampaignStats(): Promise<CampaignWithStats[]> {
  const [campaigns, rows] = await Promise.all([
    prisma.newsletterCampaign.findMany({
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        subject: true,
        status: true,
        sentAt: true,
        createdAt: true,
        totalRecipients: true,
      },
    }),
    eventCounts(),
  ]);

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: c.status,
    sentAt: c.sentAt,
    createdAt: c.createdAt,
    stats: buildStats(
      c.id,
      c.totalRecipients,
      rows.filter((r) => r.campaignId === c.id),
    ),
  }));
}

export type TimelinePoint = { date: string; delivered: number; opened: number; clicked: number };

/** Παραδόσεις / ανοίγματα / κλικ ανά ημέρα. */
export async function eventTimeline(campaignId?: string): Promise<TimelinePoint[]> {
  const rows = await prisma.$queryRaw<Array<{ day: Date | string; event: string; total: bigint }>>(
    campaignId
      ? Prisma.sql`SELECT DATE(timestamp) AS day, event, COUNT(*) AS total
                   FROM newsletter_events
                   WHERE campaign_id = ${campaignId}
                   GROUP BY day, event ORDER BY day ASC`
      : Prisma.sql`SELECT DATE(timestamp) AS day, event, COUNT(*) AS total
                   FROM newsletter_events
                   GROUP BY day, event ORDER BY day ASC`,
  );

  const byDay = new Map<string, TimelinePoint>();
  for (const row of rows) {
    const day = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10);
    const point = byDay.get(day) ?? { date: day, delivered: 0, opened: 0, clicked: 0 };
    const count = Number(row.total);
    if (row.event === "delivered") point.delivered += count;
    if (row.event === "opened") point.opened += count;
    if (row.event === "clicked") point.clicked += count;
    byDay.set(day, point);
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type LabelledCount = { label: string; value: number };

/** Οι συνδέσμοι με τα περισσότερα κλικ. */
export async function topClickedLinks(campaignId?: string, take = 8): Promise<LabelledCount[]> {
  const rows = await prisma.newsletterEvent.groupBy({
    by: ["url"],
    where: { event: "clicked", url: { not: null }, ...(campaignId ? { campaignId } : {}) },
    _count: { _all: true },
    orderBy: { _count: { url: "desc" } },
    take,
  });
  return rows
    .filter((r): r is typeof r & { url: string } => typeof r.url === "string")
    .map((r) => ({ label: r.url, value: r._count._all }));
}

/** Κατανομή προγραμμάτων email (Gmail, Outlook…) από τα ανοίγματα. */
export async function clientBreakdown(campaignId?: string, take = 5): Promise<LabelledCount[]> {
  const rows = await prisma.newsletterEvent.groupBy({
    by: ["clientName"],
    where: {
      event: { in: ["opened", "clicked"] },
      clientName: { not: null },
      ...(campaignId ? { campaignId } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { clientName: "desc" } },
    take,
  });
  return rows
    .filter((r): r is typeof r & { clientName: string } => typeof r.clientName === "string")
    .map((r) => ({ label: r.clientName, value: r._count._all }));
}

/** Κατανομή συσκευών (desktop / mobile / tablet). */
export async function deviceBreakdown(campaignId?: string, take = 5): Promise<LabelledCount[]> {
  const rows = await prisma.newsletterEvent.groupBy({
    by: ["deviceType"],
    where: {
      event: { in: ["opened", "clicked"] },
      deviceType: { not: null },
      ...(campaignId ? { campaignId } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { deviceType: "desc" } },
    take,
  });
  return rows
    .filter((r): r is typeof r & { deviceType: string } => typeof r.deviceType === "string")
    .map((r) => ({ label: r.deviceType, value: r._count._all }));
}

export type RecipientDetail = {
  email: string;
  delivered: boolean;
  opens: number;
  clicks: number;
  failed: boolean;
  lastActivity: Date | null;
};

/** Ανά παραλήπτη, για το ανοιχτό περιεχόμενο της γραμμής. */
export async function recipientDetails(campaignId: string, take = 50): Promise<RecipientDetail[]> {
  const [recipients, events] = await Promise.all([
    prisma.newsletterRecipient.findMany({
      where: { campaignId },
      select: { email: true },
      orderBy: { email: "asc" },
      take,
    }),
    prisma.newsletterEvent.findMany({
      where: { campaignId },
      select: { email: true, event: true, timestamp: true },
    }),
  ]);

  const byEmail = new Map<string, RecipientDetail>();
  for (const r of recipients) {
    byEmail.set(r.email.toLowerCase(), {
      email: r.email,
      delivered: false,
      opens: 0,
      clicks: 0,
      failed: false,
      lastActivity: null,
    });
  }

  for (const e of events) {
    const row = byEmail.get(e.email.toLowerCase());
    if (!row) continue;
    if (e.event === "delivered") row.delivered = true;
    if (e.event === "opened") row.opens += 1;
    if (e.event === "clicked") row.clicks += 1;
    if (FAILURE_EVENTS.includes(e.event)) row.failed = true;
    if (!row.lastActivity || e.timestamp > row.lastActivity) row.lastActivity = e.timestamp;
  }

  return [...byEmail.values()];
}

/* ── Πρόσθετες αναλύσεις για τη σελίδα στατιστικών ────────────────────────── */

/**
 * Γεωγραφική κατανομή, από τα ανοίγματα.
 *
 * Το Mailgun δίνει πόλη και χώρα μόνο όταν τα αναγνωρίσει· τα κενά δεν
 * μετριούνται ως «άγνωστο», γιατί θα κυριαρχούσαν στο γράφημα και δεν λένε
 * τίποτα.
 */
export async function geoBreakdown(campaignId?: string, take = 8): Promise<LabelledCount[]> {
  const rows = await prisma.newsletterEvent.groupBy({
    by: ["city"],
    where: {
      event: { in: ["opened", "clicked"] },
      city: { not: null },
      ...(campaignId ? { campaignId } : {}),
    },
    _count: { _all: true },
    orderBy: { _count: { city: "desc" } },
    take,
  });
  return rows
    .filter((r): r is typeof r & { city: string } => typeof r.city === "string" && r.city.trim() !== "")
    .map((r) => ({ label: r.city, value: r._count._all }));
}

/**
 * Πότε μέσα στο εικοσιτετράωρο ανοίγουν οι παραλήπτες.
 *
 * Απαντά σε πρακτική ερώτηση: τι ώρα να φύγει το επόμενο δελτίο. Επιστρέφει
 * πάντα και τις 24 ώρες, ακόμα και τις κενές — αλλιώς το γράφημα δείχνει
 * ψευδή συνέχεια ανάμεσα σε ώρες που απέχουν.
 */
export async function opensByHour(campaignId?: string): Promise<{ hour: number; opens: number }[]> {
  const events = await prisma.newsletterEvent.findMany({
    where: { event: "opened", ...(campaignId ? { campaignId } : {}) },
    select: { timestamp: true },
  });
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, opens: 0 }));
  for (const e of events) {
    // Ώρα Ελλάδας: ο παραλήπτης διαβάζει στη δική του ώρα, όχι σε UTC.
    const h = Number(
      e.timestamp.toLocaleString("en-GB", { timeZone: "Europe/Athens", hour: "2-digit", hour12: false })
    );
    if (h >= 0 && h < 24) buckets[h].opens++;
  }
  return buckets;
}

/**
 * Πόσο γρήγορα ανοίγεται ένα δελτίο μετά την παράδοση.
 *
 * Δείχνει αν το κοινό αντιδρά αμέσως ή σε βάθος ημερών — που καθορίζει πόσο
 * νωρίς έχει νόημα να κρίνει κανείς μια αποστολή.
 */
export async function timeToOpen(campaignId?: string): Promise<LabelledCount[]> {
  const where = campaignId ? { campaignId } : {};
  const [delivered, opened] = await Promise.all([
    prisma.newsletterEvent.findMany({
      where: { ...where, event: "delivered" },
      select: { email: true, timestamp: true },
    }),
    prisma.newsletterEvent.findMany({
      where: { ...where, event: "opened" },
      select: { email: true, timestamp: true },
      orderBy: { timestamp: "asc" },
    }),
  ]);

  const deliveredAt = new Map<string, Date>();
  for (const d of delivered) {
    const prev = deliveredAt.get(d.email);
    if (!prev || d.timestamp < prev) deliveredAt.set(d.email, d.timestamp);
  }
  const firstOpen = new Map<string, Date>();
  for (const o of opened) if (!firstOpen.has(o.email)) firstOpen.set(o.email, o.timestamp);

  const buckets = [
    { label: "< 1 ώρα", max: 60 },
    { label: "1–6 ώρες", max: 360 },
    { label: "6–24 ώρες", max: 1440 },
    { label: "1–3 ημέρες", max: 4320 },
    { label: "> 3 ημέρες", max: Infinity },
  ];
  const counts = buckets.map((b) => ({ label: b.label, value: 0 }));

  for (const [email, open] of firstOpen) {
    const sent = deliveredAt.get(email);
    if (!sent) continue;
    const minutes = (open.getTime() - sent.getTime()) / 60000;
    if (minutes < 0) continue;
    const i = buckets.findIndex((b) => minutes < b.max);
    if (i >= 0) counts[i].value++;
  }
  return counts;
}

/** Οι λόγοι αποτυχίας — τι ακριβώς πήγε στραβά, όχι απλώς πόσα. */
export async function failureReasons(campaignId?: string, take = 6): Promise<LabelledCount[]> {
  const rows = await prisma.newsletterEvent.findMany({
    where: { event: { in: ["failed", "complained"] }, ...(campaignId ? { campaignId } : {}) },
    select: { reason: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    // Οι αιτιολογίες του Mailgun είναι ελεύθερο κείμενο με μοναδικά στοιχεία
    // μέσα (διευθύνσεις, ids). Κρατάμε την πρώτη πρόταση, αλλιώς κάθε
    // αποτυχία γίνεται δική της κατηγορία και το γράφημα δεν λέει τίποτα.
    const raw = (r.reason ?? "Άγνωστη αιτία").split(/[.:;]/)[0].trim().slice(0, 70);
    counts.set(raw || "Άγνωστη αιτία", (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, take);
}

/** Η πορεία της λίστας συνδρομητών στον χρόνο. */
export async function subscriberGrowth(
  months = 6
): Promise<{ month: string; subscribed: number; unsubscribed: number }[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months + 1);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const subs = await prisma.newsletterSubscriber.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true, unsubscribedAt: true },
  });

  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const buckets = new Map<string, { subscribed: number; unsubscribed: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(from);
    d.setMonth(from.getMonth() + i);
    buckets.set(keyOf(d), { subscribed: 0, unsubscribed: 0 });
  }
  for (const s of subs) {
    const k = keyOf(s.createdAt);
    if (buckets.has(k)) buckets.get(k)!.subscribed++;
    if (s.unsubscribedAt) {
      const u = keyOf(s.unsubscribedAt);
      if (buckets.has(u)) buckets.get(u)!.unsubscribed++;
    }
  }
  const NAMES = ["Ιαν","Φεβ","Μάρ","Απρ","Μάι","Ιούν","Ιούλ","Αύγ","Σεπ","Οκτ","Νοέ","Δεκ"];
  return [...buckets.entries()].map(([k, v]) => ({
    month: NAMES[Number(k.split("-")[1]) - 1],
    ...v,
  }));
}

/** Η σύνθεση της λίστας αυτή τη στιγμή. */
export async function subscriberMix(): Promise<LabelledCount[]> {
  const rows = await prisma.newsletterSubscriber.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const LABEL: Record<string, string> = {
    SUBSCRIBED: "Εγγεγραμμένοι",
    PENDING: "Εκκρεμείς",
    UNSUBSCRIBED: "Διαγραμμένοι",
    BOUNCED: "Μη παραδοτέοι",
    COMPLAINED: "Καταγγελίες",
  };
  return rows
    .map((r) => ({ label: LABEL[r.status] ?? r.status, value: r._count._all }))
    .sort((a, b) => b.value - a.value);
}
