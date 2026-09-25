"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Απόφαση για μια υπέρβαση.
 *
 * Η χρέωση δεν γίνεται αυτόματα: ο υπολογισμός λέει τι οφείλεται, αλλά το
 * παραστατικό το κόβει άνθρωπος αφού δει το αποδεικτικό. Εδώ καταγράφεται
 * ΤΙ αποφασίστηκε και από ποιον, ώστε η ίδια υπέρβαση να μην ξανακοιταχτεί
 * και καμία να μη χαθεί.
 */
export type OverrunDecisionResult = { success?: boolean; error?: string };

export async function decideOverrun(
  inst: number,
  windowAtIso: string,
  status: "INVOICED" | "WAIVED" | "PENDING",
  amount: number,
  note?: string
): Promise<OverrunDecisionResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Δεν έχετε δικαίωμα." };
  }

  const windowAt = new Date(windowAtIso);
  if (isNaN(windowAt.getTime())) return { error: "Άκυρο περιστατικό." };

  // Η αιτιολόγηση είναι υποχρεωτική όταν κάτι αγνοείται: χωρίς αυτήν, σε έναν
  // μήνα κανείς δεν θα θυμάται γιατί δεν χρεώθηκε.
  if (status === "WAIVED" && !note?.trim()) {
    return { error: "Γράψε γιατί δεν χρεώνεται." };
  }

  const data = {
    status,
    amount,
    note: note?.trim() || null,
    decidedBy: session.user.email ?? null,
    decidedAt: status === "PENDING" ? null : new Date(),
  };

  await prisma.overrunDecision.upsert({
    where: { inst_windowAt: { inst, windowAt } },
    create: { inst, windowAt, ...data },
    update: data,
  });

  revalidatePath("/overruns");
  return { success: true };
}
