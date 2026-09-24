import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { ConsentAction, ConsentType } from "@prisma/client";

/**
 * Καταγραφή συγκαταθέσεων (GDPR άρ. 7 §1).
 *
 * Ο υπεύθυνος επεξεργασίας πρέπει να ΜΠΟΡΕΙ ΝΑ ΑΠΟΔΕΙΞΕΙ ότι ο χρήστης
 * συναίνεσε: πότε ακριβώς, από ποια IP, με ποιο κείμενο μπροστά του και σε
 * ποια έκδοση πολιτικής. Γι' αυτό κάθε εγγραφή είναι αμετάβλητη — η ανάκληση
 * δεν σβήνει τίποτα, γράφει νέα εγγραφή `WITHDRAWN`.
 */

/** Ανεβάζουμε την έκδοση όταν αλλάζει το κείμενο της πολιτικής. */
export const POLICY_VERSION = "2026-09";

/**
 * Η πραγματική IP του επισκέπτη.
 *
 * Πίσω από proxy (Coolify, Cloudflare, nginx) το `request.ip` δείχνει τον
 * proxy. Το πρώτο μέλος του `x-forwarded-for` είναι ο πελάτης· τα υπόλοιπα
 * είναι οι ενδιάμεσοι.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? null;
}

export async function requestContext() {
  const h = await headers();
  return {
    ipAddress: await clientIp(),
    userAgent: h.get("user-agent"),
    sourceUrl: h.get("referer"),
  };
}

export async function logConsent(input: {
  type: ConsentType;
  action: ConsentAction;
  email?: string | null;
  subscriberId?: string | null;
  userId?: string | null;
  /** Το ακριβές κείμενο δίπλα στο checkbox ή στο κουμπί. */
  consentText?: string | null;
  /** «double-opt-in», «checkbox», «banner», «form-submit»… */
  method?: string | null;
  locale?: string | null;
}) {
  const ctx = await requestContext();

  return prisma.consentLog.create({
    data: {
      type: input.type,
      action: input.action,
      email: input.email ?? null,
      subscriberId: input.subscriberId ?? null,
      userId: input.userId ?? null,
      consentText: input.consentText ?? null,
      policyVersion: POLICY_VERSION,
      method: input.method ?? null,
      locale: input.locale ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      sourceUrl: ctx.sourceUrl,
    },
  });
}

/** Το ιστορικό συγκαταθέσεων μιας διεύθυνσης — για αίτημα πρόσβασης (άρ. 15). */
export function consentHistory(email: string) {
  return prisma.consentLog.findMany({
    where: { email },
    orderBy: { createdAt: "desc" },
  });
}

/** Προθεσμία απάντησης σε αίτημα δικαιωμάτων: ένας μήνας (άρ. 12 §3). */
export function responseDeadline(from: Date = new Date()): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + 30);
  return due;
}
