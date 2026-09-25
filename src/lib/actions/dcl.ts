"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { syncDcl, type SyncOutcome } from "@/lib/dcl/sync";

/**
 * Χειροκίνητος συγχρονισμός με το Ψηφιακό Πελατολόγιο.
 *
 * Δεν τρέχει σε χρονοδιάγραμμα: όσο μιλάμε στο δοκιμαστικό περιβάλλον, η
 * αποστολή πρέπει να ξεκινά από άνθρωπο που βλέπει το αποτέλεσμα.
 */
export async function runDclSync(): Promise<SyncOutcome & { error?: string }> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return {
      opened: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      submitDisabled: true,
      messages: [],
      error: "Δεν έχετε δικαίωμα.",
    };
  }

  const result = await syncDcl();
  revalidatePath("/dcl");
  return result;
}
