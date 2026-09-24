"use server";

/**
 * Έγκριση αιτημάτων πελατών από τον διαχειριστή.
 *
 * Αυτό είναι το ΜΟΝΟ σημείο της εφαρμογής που γράφει σε συμβάσεις του ERP, και
 * γράφει μόνο μετά από ρητή ανθρώπινη ενέργεια. Το αποτέλεσμα της εγγραφής
 * αποθηκεύεται στο αίτημα (`APPLIED` ή `FAILED` με το μήνυμα), ώστε μια αποτυχία
 * να μη μοιάζει με επιτυχία.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addPlateToContract,
  removePlateFromContract,
  findMtrlForPlate,
  getContractLineState,
} from "@/lib/contract-lines";

export type ApprovalResult = { success?: boolean; error?: string; note?: string };

async function requireApprover() {
  const session = await auth();
  if (!session?.user) return { error: "Απαιτείται σύνδεση." } as const;
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return { error: "Δεν έχετε δικαίωμα έγκρισης." } as const;
  }
  return { userId: session.user.id as string } as const;
}

/** Εγκρίνει το αίτημα ΚΑΙ το εφαρμόζει στο ERP. */
export async function approveRequest(requestId: string): Promise<ApprovalResult> {
  const approver = await requireApprover();
  if ("error" in approver) return { error: approver.error };

  const request = await prisma.contractChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) return { error: "Το αίτημα δεν βρέθηκε." };
  if (request.status !== "PENDING") return { error: "Το αίτημα έχει ήδη κριθεί." };

  // Η ανανέωση δημιουργεί ΝΕΑ σύμβαση — δεν υποστηρίζεται ακόμα αυτόματα.
  if (request.type === "RENEW") {
    return {
      error:
        "Η ανανέωση δημιουργεί νέα σύμβαση και πρέπει προς το παρόν να καταχωρηθεί από το SoftOne. " +
        "Μετά την καταχώρηση, σημείωσε το αίτημα ως ολοκληρωμένο.",
    };
  }

  if (!request.plate) return { error: "Το αίτημα δεν έχει πινακίδα." };

  const mtrl = await findMtrlForPlate(request.plate);
  if (!mtrl) {
    await prisma.contractChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "FAILED",
        decidedAt: new Date(),
        decidedById: approver.userId,
        error: `Η πινακίδα ${request.plate} δεν υπάρχει ως είδος στο ERP. Δημιούργησέ την πρώτα.`,
      },
    });
    revalidatePath("/contract-requests");
    return { error: `Η πινακίδα ${request.plate} δεν υπάρχει ως είδος στο ERP.` };
  }

  const result =
    request.type === "ADD_PLATE"
      ? await addPlateToContract(request.inst, mtrl)
      : await removePlateFromContract(request.inst, mtrl);

  if (!result.success) {
    await prisma.contractChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "FAILED",
        decidedAt: new Date(),
        decidedById: approver.userId,
        error: result.error ?? "Άγνωστο σφάλμα ERP.",
      },
    });
    revalidatePath("/contract-requests");
    return { error: result.error ?? "Η εγγραφή στο ERP απέτυχε." };
  }

  await prisma.contractChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "APPLIED",
      decidedAt: new Date(),
      decidedById: approver.userId,
      appliedAt: new Date(),
      error: null,
    },
  });

  revalidatePath("/contract-requests");
  revalidatePath("/contracts");
  return {
    success: true,
    note:
      result.mode === "filled-empty"
        ? "Συμπληρώθηκε κενή γραμμή της σύμβασης — η χωρητικότητα δεν άλλαξε."
        : "Προστέθηκε νέα γραμμή στη σύμβαση.",
  };
}

export async function rejectRequest(requestId: string, reason?: string): Promise<ApprovalResult> {
  const approver = await requireApprover();
  if ("error" in approver) return { error: approver.error };

  const request = await prisma.contractChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) return { error: "Το αίτημα δεν βρέθηκε." };
  if (request.status !== "PENDING") return { error: "Το αίτημα έχει ήδη κριθεί." };

  await prisma.contractChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: approver.userId,
      note: reason?.trim() || null,
    },
  });
  revalidatePath("/contract-requests");
  return { success: true };
}

/** Σημειώνει χειροκίνητα ένα αίτημα ως ολοκληρωμένο (π.χ. ανανέωση που έγινε στο ERP). */
export async function markApplied(requestId: string): Promise<ApprovalResult> {
  const approver = await requireApprover();
  if ("error" in approver) return { error: approver.error };

  await prisma.contractChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "APPLIED",
      decidedAt: new Date(),
      decidedById: approver.userId,
      appliedAt: new Date(),
      note: "Καταχωρήθηκε χειροκίνητα στο SoftOne.",
    },
  });
  revalidatePath("/contract-requests");
  return { success: true };
}

/** Χωρητικότητα σύμβασης — για να βλέπει ο εγκρίνων αν υπάρχει ελεύθερη θέση. */
export async function contractCapacity(inst: number) {
  const state = await getContractLineState(inst);
  if (!state) return null;
  return { slots: state.slots, filled: state.filled.length, empty: state.emptyLines.length };
}
