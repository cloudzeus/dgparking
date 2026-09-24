/**
 * Ειδοποιήσεις επικείμενης λήξης συμβάσεων.
 *
 * Στέλνεται ΜΙΑ φορά ανά σύμβαση, ανά «σκαλοπάτι» ημερών και ανά ημερομηνία
 * λήξης — το τρίτο σκέλος είναι αυτό που κάνει τη διαφορά: όταν η σύμβαση
 * ανανεωθεί και αποκτήσει νέα λήξη, η επόμενη ειδοποίηση επιτρέπεται κανονικά.
 *
 * Η αποστολή πάει σε ΟΛΕΣ τις διευθύνσεις του πελάτη: 13 από τις 34 ενεργές
 * συμβάσεις με email έχουν περισσότερες από μία, συχνά λογιστήριο και
 * υπεύθυνο στόλου ξεχωριστά.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailgun";
import { automatedEmailsEnabled, automatedEmailsBlockedMessage } from "@/lib/notifications-gate";
import { contractExpiryEmail } from "@/emails/templates/contract-expiry";
import { getExpiringContracts } from "@/lib/portal-data";

/** Πόσες ημέρες πριν τη λήξη ειδοποιούμε. */
export const NOTICE_DAYS = 7;

function portalUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return base ? `${base.replace(/\/$/, "")}/client` : undefined;
}

export type ExpiryRunResult = {
  examined: number;
  sent: number;
  skippedAlreadySent: number;
  skippedNoEmail: { inst: number; name: string | null }[];
  failed: { inst: number; error: string }[];
};

export async function sendExpiryNotices(daysAhead = NOTICE_DAYS): Promise<ExpiryRunResult> {
  if (!automatedEmailsEnabled()) {
    console.log(automatedEmailsBlockedMessage("ειδοποιήσεις λήξης συμβάσεων"));
    return { examined: 0, sent: 0, skippedAlreadySent: 0, skippedNoEmail: [], failed: [] };
  }

  const contracts = await getExpiringContracts(daysAhead);
  const result: ExpiryRunResult = {
    examined: contracts.length,
    sent: 0,
    skippedAlreadySent: 0,
    skippedNoEmail: [],
    failed: [],
  };
  if (contracts.length === 0) return result;

  const trdrs = [...new Set(contracts.map((c) => c.TRDR).filter(Boolean) as string[])];
  const [emails, customers, lineCounts] = await Promise.all([
    prisma.customerEmail.findMany({
      where: { trdr: { in: trdrs } },
      orderBy: { isPrimary: "desc" },
      select: { trdr: true, email: true },
    }),
    prisma.cUSTORMER.findMany({
      where: { TRDR: { in: trdrs } },
      select: { TRDR: true, NAME: true },
    }),
    prisma.iNSTLINES.groupBy({
      by: ["INST"],
      where: { INST: { in: contracts.map((c) => c.INST) } },
      _count: { _all: true },
    }),
  ]);

  const mailsByTrdr = new Map<string, string[]>();
  for (const e of emails) {
    mailsByTrdr.set(e.trdr, [...(mailsByTrdr.get(e.trdr) ?? []), e.email]);
  }
  const nameByTrdr = new Map(customers.map((c) => [c.TRDR!, c.NAME]));
  const platesByInst = new Map(lineCounts.map((l) => [l.INST, l._count._all]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const contract of contracts) {
    if (!contract.WDATETO) continue;

    const expiresOn = new Date(contract.WDATETO);
    expiresOn.setHours(0, 0, 0, 0);

    // Το κλειδί περιλαμβάνει την ημερομηνία λήξης, ώστε μετά από ανανέωση να
    // μπορεί να σταλεί νέα ειδοποίηση για τη νέα λήξη.
    const already = await prisma.contractExpiryNotice.findFirst({
      where: { inst: contract.INST, daysAhead, expiresOn },
      select: { id: true },
    });
    if (already) {
      result.skippedAlreadySent++;
      continue;
    }

    const recipients = contract.TRDR ? mailsByTrdr.get(contract.TRDR) ?? [] : [];
    if (recipients.length === 0) {
      result.skippedNoEmail.push({ inst: contract.INST, name: contract.NAME });
      continue;
    }

    const daysLeft = Math.round((expiresOn.getTime() - today.getTime()) / 86_400_000);
    const message = contractExpiryEmail({
      customerName: (contract.TRDR ? nameByTrdr.get(contract.TRDR) : null) ?? contract.NAME ?? "πελάτη",
      inst: contract.INST,
      expiresOn,
      daysLeft,
      slots: contract.NUM01 != null ? Number(contract.NUM01) : null,
      plateCount: platesByInst.get(contract.INST) ?? 0,
      portalUrl: portalUrl(),
    });

    const sendResult = await sendEmail({
      to: recipients,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (!sendResult.success) {
      result.failed.push({ inst: contract.INST, error: sendResult.error ?? "άγνωστο σφάλμα" });
      continue;
    }

    // Καταγραφή ΜΟΝΟ μετά από επιτυχή αποστολή, ώστε μια αποτυχία να
    // ξαναδοκιμάζεται στην επόμενη εκτέλεση αντί να χάνεται σιωπηλά.
    await prisma.contractExpiryNotice.create({
      data: { inst: contract.INST, daysAhead, expiresOn, sentTo: recipients.join(", ").slice(0, 255) },
    });
    result.sent++;
  }

  return result;
}
