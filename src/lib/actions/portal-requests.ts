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
import { nextContractPeriod, proposedContractName, formatPeriod } from "@/lib/contract-period";

export type RequestResult = { success?: boolean; error?: string };

/** Κανονικοποίηση πινακίδας στη μορφή που κρατά το ERP (λατινικά, κεφαλαία). */
function normalizePlate(input: string): string {
  return (input ?? "")
    .toUpperCase()
    .replace(/[\s.\-_]/g, "")
    // Ο ίδιος χάρτης με το `renameCarPlate` του ERP, ώστε οι πινακίδες να
    // ταιριάζουν. Προσοχή: Ρ και R καταλήγουν και τα δύο σε P.
    .replace(/Α/g, "A").replace(/Β/g, "B").replace(/Γ/g, "G").replace(/Δ/g, "D")
    .replace(/Ε/g, "E").replace(/Ζ/g, "Z").replace(/Η/g, "H").replace(/Θ/g, "U")
    .replace(/Ι/g, "I").replace(/Κ/g, "K").replace(/Λ/g, "L").replace(/Μ/g, "M")
    .replace(/Ν/g, "N").replace(/Ξ/g, "J").replace(/Ο/g, "O").replace(/Π/g, "P")
    .replace(/Ρ/g, "P").replace(/Σ/g, "S").replace(/Τ/g, "T").replace(/Υ/g, "Y")
    .replace(/Φ/g, "F").replace(/Χ/g, "X").replace(/Ψ/g, "C").replace(/Ω/g, "V")
    .replace(/R/g, "P");
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
