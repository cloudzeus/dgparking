"use server";

/**
 * Αιτήματα πελατών για αλλαγές στη σύμβαση.
 *
 * ΤΙΠΟΤΑ ΔΕΝ ΓΡΑΦΕΤΑΙ ΣΤΟ ERP ΑΠΟ ΕΔΩ. Οι πινακίδες και οι θέσεις επηρεάζουν
 * τιμολόγηση και φυσική πρόσβαση στο πάρκινγκ, οπότε κάθε αλλαγή περνά από
 * έγκριση. Εδώ μόνο καταγράφεται το αίτημα.
 *
 * ΑΠΟΜΟΝΩΣΗ: κάθε ενέργεια επαληθεύει ότι η σύμβαση ανήκει στον πελάτη του
 * συνδεδεμένου χρήστη. Το `inst` έρχεται από τον φυλλομετρητή και δεν είναι
 * εμπιστεύσιμο.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPortalCustomer } from "@/lib/portal-data";
import { isContractActive } from "@/lib/contract-active";
import { normalizePlate } from "@/lib/plate";
import { nextContractPeriod, proposedContractName, formatPeriod } from "@/lib/contract-period";
import {
  MAX_PLATES_PER_SLOT,
  MAX_CHANGES_PER_SLOT,
  CHANGE_COOLDOWN_HOURS,
} from "@/lib/contract-limits";

export type RequestResult = { success?: boolean; error?: string };

const isEmptyMtrl = (m: string | null) => {
  const v = String(m ?? "").trim();
  return v === "" || v === "0";
};

/**
 * Ελέγχει αν ο πελάτης δικαιούται να κάνει κι άλλη αλλαγή σε αυτή τη σύμβαση.
 * Μετράει ΟΛΑ τα αιτήματα αλλαγής πινακίδων, εκκρεμή και εγκεκριμένα: ένα
 * εκκρεμές αίτημα δεσμεύει ήδη μια αλλαγή, αλλιώς θα μπορούσε να υποβάλει
 * δεκάδες πριν εγκριθεί το πρώτο.
 */
async function checkChangeAllowance(inst: number, slots: number | null) {
  const quota = (slots ?? 1) * MAX_CHANGES_PER_SLOT;
  const changes = await prisma.contractChangeRequest.findMany({
    where: {
      inst,
      type: { in: ["ADD_PLATE", "REMOVE_PLATE"] },
      status: { in: ["PENDING", "APPROVED", "APPLIED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (changes.length >= quota) {
    return {
      error:
        `Έχετε εξαντλήσει τις αλλαγές για αυτή τη σύμβαση (${changes.length} από ${quota}). ` +
        `Επιτρέπονται ${MAX_CHANGES_PER_SLOT} αλλαγές ανά θέση. Επικοινωνήστε μαζί μας αν χρειάζεστε περισσότερες.`,
    };
  }

  const last = changes[0]?.createdAt;
  if (last) {
    const hoursSince = (Date.now() - last.getTime()) / 3_600_000;
    if (hoursSince < CHANGE_COOLDOWN_HOURS) {
      const remaining = Math.ceil(CHANGE_COOLDOWN_HOURS - hoursSince);
      return {
        error:
          `Οι αλλαγές δεν γίνονται συνεχόμενα. Η επόμενη είναι διαθέσιμη σε ${remaining} ώρες.`,
      };
    }
  }
  return { used: changes.length, quota };
}

/** Επιστρέφει τον χρήστη και τη σύμβαση, αφού επαληθεύσει ότι του ανήκει. */
async function requireOwnedContract(inst: number) {
  const session = await auth();
  if (!session?.user) return { error: "Απαιτείται σύνδεση." } as const;

  const customer = await getPortalCustomer(session.user.id as string);
  if (!customer) return { error: "Ο λογαριασμός δεν έχει εγκεκριμένη πρόσβαση." } as const;

  const contract = await prisma.iNST.findUnique({
    where: { INST: inst },
    select: { INST: true, TRDR: true, WDATETO: true, NUM01: true },
  });
  if (!contract || contract.TRDR !== customer.trdr) {
    // Ίδιο μήνυμα για «δεν υπάρχει» και «δεν σου ανήκει», ώστε να μη διαρρέει
    // ποιες συμβάσεις υπάρχουν.
    return { error: "Η σύμβαση δεν βρέθηκε." } as const;
  }
  return { userId: session.user.id as string, customer, contract } as const;
}

export async function requestAddPlate(inst: number, plateInput: string): Promise<RequestResult> {
  const owned = await requireOwnedContract(inst);
  if ("error" in owned) return { error: owned.error };

  const plate = normalizePlate(plateInput);
  if (plate.length < 4 || plate.length > 10) {
    return { error: "Η πινακίδα πρέπει να έχει 4 έως 10 χαρακτήρες, χωρίς κενά ή παύλες." };
  }
  if (!isContractActive({ WDATETO: owned.contract.WDATETO })) {
    return { error: "Η σύμβαση έχει λήξει. Ανανεώστε την πρώτα." };
  }

  const duplicate = await prisma.contractChangeRequest.findFirst({
    where: { inst, plate, type: "ADD_PLATE", status: { in: ["PENDING", "APPROVED"] } },
  });
  if (duplicate) return { error: `Υπάρχει ήδη εκκρεμές αίτημα για την πινακίδα ${plate}.` };

  // ΟΡΙΟ ΧΩΡΗΤΙΚΟΤΗΤΑΣ: έως 3 πινακίδες ανά θέση.
  //
  // Τρεις ενεργές συμβάσεις ξεπερνούν ήδη το όριο από παλιά. Δεν τις πειράζουμε
  // — οι υπάρχουσες πινακίδες συνεχίζουν να λειτουργούν — αλλά δεν δεχόμαστε
  // νέες μέχρι να πέσουν κάτω από το όριο.
  const lines = await prisma.iNSTLINES.findMany({
    where: { INST: inst },
    select: { MTRL: true },
  });
  const declared = lines.filter((l) => !isEmptyMtrl(l.MTRL)).length;
  const pendingAdds = await prisma.contractChangeRequest.count({
    where: { inst, type: "ADD_PLATE", status: { in: ["PENDING", "APPROVED"] } },
  });
  const slots = owned.contract.NUM01 != null ? Number(owned.contract.NUM01) : null;
  const maxPlates = (slots ?? 1) * MAX_PLATES_PER_SLOT;

  if (declared + pendingAdds >= maxPlates) {
    return {
      error:
        `Η σύμβαση έχει ${declared} δηλωμένες πινακίδες` +
        (pendingAdds ? ` και ${pendingAdds} σε αναμονή` : "") +
        `, με όριο ${maxPlates} (${MAX_PLATES_PER_SLOT} ανά θέση για ${slots ?? 1} θέσεις). ` +
        "Αφαιρέστε μια πινακίδα πρώτα.",
    };
  }

  const allowance = await checkChangeAllowance(inst, slots);
  if ("error" in allowance) return { error: allowance.error };

  await prisma.contractChangeRequest.create({
    data: { userId: owned.userId, inst, type: "ADD_PLATE", plate },
  });
  revalidatePath("/client");
  return { success: true };
}

export async function requestRemovePlate(inst: number, plateInput: string): Promise<RequestResult> {
  const owned = await requireOwnedContract(inst);
  if ("error" in owned) return { error: owned.error };

  const plate = normalizePlate(plateInput);
  const duplicate = await prisma.contractChangeRequest.findFirst({
    where: { inst, plate, type: "REMOVE_PLATE", status: "PENDING" },
  });
  if (duplicate) return { error: `Υπάρχει ήδη εκκρεμές αίτημα αφαίρεσης για την ${plate}.` };

  const slots = owned.contract.NUM01 != null ? Number(owned.contract.NUM01) : null;
  const allowance = await checkChangeAllowance(inst, slots);
  if ("error" in allowance) return { error: allowance.error };

  await prisma.contractChangeRequest.create({
    data: { userId: owned.userId, inst, type: "REMOVE_PLATE", plate },
  });
  revalidatePath("/client");
  return { success: true };
}

/**
 * Αίτημα ανανέωσης.
 *
 * ΔΕΝ παρατείνει την υπάρχουσα σύμβαση: ζητά τη ΔΗΜΙΟΥΡΓΙΑ ΝΕΑΣ για τον επόμενο
 * μήνα, με αντιγραφή των πινακίδων. Έτσι δουλεύει το ERP στην πράξη — μία
 * σύμβαση ανά μήνα, με τον μήνα στην επωνυμία.
 *
 * Η περίοδος υπολογίζεται εδώ και αποθηκεύεται μαζί με το αίτημα, ώστε ο
 * εγκρίνων να βλέπει ακριβώς τι θα δημιουργηθεί αντί να το συμπεραίνει.
 */
export async function requestRenewal(inst: number, slots: number): Promise<RequestResult> {
  const owned = await requireOwnedContract(inst);
  if ("error" in owned) return { error: owned.error };

  if (!Number.isInteger(slots) || slots < 1 || slots > 200) {
    return { error: "Ο αριθμός θέσεων πρέπει να είναι από 1 έως 200." };
  }

  const contract = await prisma.iNST.findUnique({
    where: { INST: inst },
    select: { NAME: true, WDATEFROM: true, WDATETO: true },
  });
  const period = nextContractPeriod(contract?.WDATEFROM ?? null, contract?.WDATETO ?? null);

  // Δύο αιτήματα για την ΙΔΙΑ νέα περίοδο δεν έχουν νόημα· για διαφορετική
  // περίοδο έχουν, γι' αυτό ο έλεγχος κλειδώνει στην ημερομηνία έναρξης.
  const pendingRenewal = await prisma.contractChangeRequest.findFirst({
    where: { inst, type: "RENEW", status: "PENDING", newStartDate: period.from },
  });
  if (pendingRenewal) {
    return { error: `Υπάρχει ήδη εκκρεμές αίτημα ανανέωσης για ${formatPeriod(period)}.` };
  }

  await prisma.contractChangeRequest.create({
    data: {
      userId: owned.userId,
      inst,
      type: "RENEW",
      slots,
      newStartDate: period.from,
      newEndDate: period.to,
      newName: proposedContractName(contract?.NAME ?? owned.customer.name, period),
    },
  });
  revalidatePath("/client");
  return { success: true };
}

/** Τι θα δημιουργηθεί αν ζητηθεί ανανέωση — για προεπισκόπηση στο portal. */
export async function renewalPreview(inst: number) {
  const owned = await requireOwnedContract(inst);
  if ("error" in owned) return null;
  const contract = await prisma.iNST.findUnique({
    where: { INST: inst },
    select: { NAME: true, WDATEFROM: true, WDATETO: true },
  });
  const period = nextContractPeriod(contract?.WDATEFROM ?? null, contract?.WDATETO ?? null);
  return {
    label: formatPeriod(period),
    name: proposedContractName(contract?.NAME ?? owned.customer.name, period),
  };
}

/** Ο πελάτης ανακαλεί δικό του αίτημα, όσο δεν έχει κριθεί. */
export async function cancelRequest(requestId: string): Promise<RequestResult> {
  const session = await auth();
  if (!session?.user) return { error: "Απαιτείται σύνδεση." };

  const request = await prisma.contractChangeRequest.findUnique({ where: { id: requestId } });
  if (!request || request.userId !== session.user.id) return { error: "Το αίτημα δεν βρέθηκε." };
  if (request.status !== "PENDING") return { error: "Το αίτημα έχει ήδη κριθεί." };

  await prisma.contractChangeRequest.delete({ where: { id: requestId } });
  revalidatePath("/client");
  return { success: true };
}
