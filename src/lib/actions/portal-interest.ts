"use server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailgun";
import { getInterestProfile } from "@/lib/portal-interest";

/**
 * Υποβολή εκδήλωσης ενδιαφέροντος για την πύλη πελατών.
 *
 * Δημόσια ενέργεια χωρίς σύνδεση — η ταυτότητα προκύπτει από το token του
 * συνδρομητή, που ήρθε στο δικό του email. Δεν δίνει πρόσβαση σε τίποτα: μόνο
 * καταγράφει ότι ο πελάτης θέλει λογαριασμό. Η πρόσβαση δίνεται ονομαστικά
 * από εμάς, αφού επιβεβαιωθούν τα στοιχεία.
 */
export type InterestResult = { success?: true; error?: string };

/** Ένα αίτημα ανά συνδρομητή την ημέρα — αρκεί για να μη γεμίσει από διπλά κλικ. */
const COOLDOWN_MS = 24 * 3600 * 1000;

export async function submitPortalInterest(
  token: string,
  formData: FormData
): Promise<InterestResult> {
  const profile = await getInterestProfile(token);
  if (!profile) return { error: "Ο σύνδεσμος δεν είναι έγκυρος. Ζητήστε μας καινούριο." };

  const company = formData.get("company")?.toString().trim() || null;
  const contactName = formData.get("contactName")?.toString().trim() || null;
  const phone = formData.get("phone")?.toString().trim() || null;
  const note = formData.get("note")?.toString().trim() || null;

  if (!company) return { error: "Συμπληρώστε την επωνυμία." };
  if (!contactName) return { error: "Συμπληρώστε το όνομα επικοινωνίας." };

  const recent = await prisma.portalInterest.findFirst({
    where: { email: profile.email, createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) {
    return { error: "Έχουμε ήδη το αίτημά σας — θα επικοινωνήσουμε μαζί σας." };
  }

  // Κρατάμε τι ΕΙΔΕ ο πελάτης τη στιγμή της υποβολής: οι συμβάσεις αλλάζουν,
  // και σε έναν μήνα δεν θα ξέρουμε τι επιβεβαίωσε.
  const snapshot = {
    contracts: profile.contracts.map((c) => ({
      inst: c.inst,
      name: c.name,
      slots: c.slots,
      endsOn: c.endsOn?.toISOString() ?? null,
      plates: c.plates,
    })),
    plates: profile.plates,
  };

  await prisma.portalInterest.create({
    data: {
      subscriberId: profile.subscriberId,
      email: profile.email,
      trdr: profile.trdr,
      company,
      contactName,
      phone,
      note,
      snapshot,
    },
  });

  // Η ειδοποίηση είναι χρήσιμη αλλά δεν είναι το αίτημα: αν αποτύχει, το
  // αίτημα έχει ήδη καταγραφεί και φαίνεται στη σελίδα των αιτημάτων.
  try {
    const lines = [
      `Επωνυμία: ${company}`,
      `Επικοινωνία: ${contactName}`,
      `Email: ${profile.email}`,
      `Τηλέφωνο: ${phone ?? "—"}`,
      `Πελάτης ERP: ${profile.trdr ?? "δεν ταυτοποιήθηκε"}`,
      `Συμβάσεις: ${profile.contracts.map((c) => `#${c.inst}`).join(", ") || "καμία ενεργή"}`,
      `Πινακίδες: ${profile.plates.join(", ") || "—"}`,
      note ? `\nΣημείωση:\n${note}` : "",
    ].filter(Boolean);

    await sendEmail({
      subject: `Πύλη πελατών — αίτημα πρόσβασης: ${company}`,
      text: lines.join("\n"),
      replyTo: profile.email,
    });
  } catch (error) {
    console.error("[PORTAL-INTEREST] Η ειδοποίηση απέτυχε:", error);
  }

  return { success: true };
}
