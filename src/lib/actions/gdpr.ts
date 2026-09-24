"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/mailgun";
import { gdprRequestCompletedEmail } from "@/emails/templates/gdpr-request-completed";

/**
 * Διαχείριση των αιτημάτων άσκησης δικαιωμάτων.
 *
 * Μόνο διαχειριστές: το μητρώο περιέχει IP και συσκευή, δηλαδή τα ίδια τα
 * δεδομένα που προστατεύουμε. Καμία εγγραφή δεν διαγράφεται από εδώ — η
 * ιστορία του αιτήματος είναι μέρος της απόδειξης συμμόρφωσης.
 */

export type GdprActionResult = { success?: true; error?: string };

async function requireAdmin(): Promise<{ id: string } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return { id: session.user.id };
}

const REQUESTS_PATH = "/gdpr/requests";

/** Το αίτημα αναλαμβάνεται — π.χ. όταν επιβεβαιώθηκε η ταυτότητα εκτός email. */
export async function startDataRequest(id: string): Promise<GdprActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Δεν έχετε δικαίωμα πρόσβασης." };

  try {
    await prisma.dataSubjectRequest.update({
      where: { id },
      data: { status: "IN_PROGRESS", handledById: admin.id },
    });
    revalidatePath(REQUESTS_PATH);
    return { success: true };
  } catch (error) {
    console.error("[GDPR] Could not move the request to in progress:", error);
    return { error: "Δεν ήταν δυνατή η ενημέρωση του αιτήματος." };
  }
}

/**
 * Ολοκλήρωση με σημείωμα διεκπεραίωσης. Το σημείωμα φεύγει αυτούσιο στον
 * αιτούντα — είναι η απάντηση του άρ. 12 §3.
 */
export async function completeDataRequest(
  id: string,
  resolution: string,
): Promise<GdprActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Δεν έχετε δικαίωμα πρόσβασης." };

  const note = resolution.trim();
  if (note.length < 5) return { error: "Γράψτε τι ακριβώς έγινε με το αίτημα." };

  try {
    const completedAt = new Date();
    const request = await prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        resolution: note,
        handledById: admin.id,
        handledAt: completedAt,
      },
      select: { id: true, email: true, fullName: true, type: true },
    });

    const mail = gdprRequestCompletedEmail({
      requestType: request.type,
      referenceId: request.id,
      resolution: note,
      completedAt,
      fullName: request.fullName ?? undefined,
    });

    const sent = await sendEmail({
      to: request.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    revalidatePath(REQUESTS_PATH);

    if (!sent.success) {
      console.error("[GDPR] Could not send the completion email:", sent.error);
      return { error: "Το αίτημα ολοκληρώθηκε, αλλά το email δεν στάλθηκε." };
    }

    return { success: true };
  } catch (error) {
    console.error("[GDPR] Could not complete the request:", error);
    return { error: "Δεν ήταν δυνατή η ολοκλήρωση του αιτήματος." };
  }
}

/** Απόρριψη με αιτιολογία (άρ. 12 §4: ο αιτών μαθαίνει γιατί). */
export async function rejectDataRequest(
  id: string,
  resolution: string,
): Promise<GdprActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Δεν έχετε δικαίωμα πρόσβασης." };

  const note = resolution.trim();
  if (note.length < 5) return { error: "Γράψτε την αιτιολογία της απόρριψης." };

  try {
    await prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        resolution: note,
        handledById: admin.id,
        handledAt: new Date(),
      },
    });
    revalidatePath(REQUESTS_PATH);
    return { success: true };
  } catch (error) {
    console.error("[GDPR] Could not reject the request:", error);
    return { error: "Δεν ήταν δυνατή η απόρριψη του αιτήματος." };
  }
}
