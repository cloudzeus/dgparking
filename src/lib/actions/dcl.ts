"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { syncDcl, type SyncOutcome } from "@/lib/dcl/sync";
import { verifyAgainstAade, type VerifyResult } from "@/lib/dcl/verify";

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

/**
 * Αντιπαραβολή με ό,τι κρατά ΟΝΤΩΣ η ΑΑΔΕ.
 *
 * Τραβά πίσω τις εγγραφές με `RequestClients` — δεν διαβάζει τον δικό μας
 * πίνακα, γιατί εκείνος λέει τι νομίζουμε ότι στείλαμε, όχι τι έφτασε.
 */
export async function runDclVerify(): Promise<VerifyResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return {
      aadeTotal: 0,
      cameraTotal: 0,
      rows: [],
      counts: { MATCH: 0, ONLY_IN_AADE: 0, ONLY_IN_CAMERAS: 0, OPEN_IN_AADE: 0, TIME_DIFF: 0 },
      error: "Δεν έχετε δικαίωμα.",
    };
  }
  return verifyAgainstAade(2);
}
