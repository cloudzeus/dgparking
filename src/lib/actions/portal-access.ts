"use server";

/**
 * Έγκριση πρόσβασης πελατών στο portal.
 *
 * Η έγκριση είναι ΑΝΘΡΩΠΙΝΗ απόφαση: το ΑΦΜ που δήλωσε ο χρήστης είναι δημόσια
 * πληροφορία και δεν αποδεικνύει ότι ανήκει στην εταιρία. Εδώ ο διαχειριστής
 * επιβεβαιώνει τη σχέση και μόνο τότε ενεργοποιείται ο λογαριασμός.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailgun";
import { portalAccessDecisionEmail } from "@/emails/templates/portal-access";

export type AccessActionResult = { success?: boolean; error?: string };

async function requireApprover() {
  const session = await auth();
  if (!session?.user) return { error: "Απαιτείται σύνδεση." } as const;
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Δεν έχετε δικαίωμα έγκρισης." } as const;
  }
  return { userId: session.user.id as string } as const;
}

/** Εγκρίνει την πρόσβαση και ενεργοποιεί τον λογαριασμό. */
export async function approvePortalAccess(
  accessId: string,
  trdrOverride?: string
): Promise<AccessActionResult> {
  const approver = await requireApprover();
  if ("error" in approver) return { error: approver.error };

  const access = await prisma.customerPortalAccess.findUnique({
    where: { id: accessId },
    include: { user: { select: { id: true, email: true, firstName: true } } },
  });
  if (!access) return { error: "Το αίτημα δεν βρέθηκε." };

  const trdr = trdrOverride?.trim() || access.trdr;
  if (!trdr) {
    return {
      error:
        "Δεν έχει οριστεί πελάτης. Το ΑΦΜ δεν αντιστοιχήθηκε αυτόματα — επίλεξε πελάτη πριν την έγκριση.",
    };
  }

  // Ο ίδιος πελάτης δεν πρέπει να έχει δύο εγκεκριμένους λογαριασμούς χωρίς να
  // το ξέρει κανείς — δεν το απαγορεύουμε, αλλά το καταγράφουμε στη σημείωση.
  const others = await prisma.customerPortalAccess.count({
    where: { trdr, status: "APPROVED", NOT: { id: accessId } },
  });

  await prisma.$transaction([
    prisma.customerPortalAccess.update({
      where: { id: accessId },
      data: {
        status: "APPROVED",
        trdr,
        decidedAt: new Date(),
        decidedById: approver.userId,
        note: others > 0 ? `Προσοχή: υπάρχουν ήδη ${others} εγκεκριμένοι χρήστες για τον ίδιο πελάτη.` : null,
      },
    }),
    prisma.user.update({ where: { id: access.userId }, data: { isActive: true } }),
  ]);

  const email = portalAccessDecisionEmail({
    approved: true,
    firstName: access.user.firstName ?? undefined,
    customerName: access.matchedName ?? undefined,
  });
  await sendEmail({
    to: access.user.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  revalidatePath("/portal-access");
  return { success: true };
}

/** Απορρίπτει το αίτημα. Ο λογαριασμός μένει ανενεργός. */
export async function rejectPortalAccess(
  accessId: string,
  reason?: string
): Promise<AccessActionResult> {
  const approver = await requireApprover();
  if ("error" in approver) return { error: approver.error };

  const access = await prisma.customerPortalAccess.findUnique({
    where: { id: accessId },
    include: { user: { select: { email: true, firstName: true } } },
  });
  if (!access) return { error: "Το αίτημα δεν βρέθηκε." };

  await prisma.customerPortalAccess.update({
    where: { id: accessId },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: approver.userId,
      note: reason?.trim() || null,
    },
  });

  const email = portalAccessDecisionEmail({
    approved: false,
    firstName: access.user.firstName ?? undefined,
    reason: reason?.trim() || undefined,
  });
  await sendEmail({
    to: access.user.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  revalidatePath("/portal-access");
  return { success: true };
}

/**
 * Υποψήφιοι πελάτες για ένα ΑΦΜ που δεν αντιστοιχήθηκε αυτόματα.
 * Χρήσιμο όταν το ΑΦΜ λείπει από την καρτέλα του ERP.
 */
export async function searchCustomers(query: string) {
  const q = query.trim();
  if (q.length < 3) return [];
  return prisma.cUSTORMER.findMany({
    where: {
      OR: [{ NAME: { contains: q } }, { AFM: { contains: q } }, { CODE: { contains: q } }],
    },
    select: { TRDR: true, NAME: true, AFM: true, CODE: true },
    take: 20,
  });
}
