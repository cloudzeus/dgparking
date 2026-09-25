import { prisma } from "@/lib/prisma";
import { getPortalContracts, type PortalContract } from "@/lib/portal-data";

/**
 * Η φόρμα εκδήλωσης ενδιαφέροντος για την πύλη πελατών.
 *
 * Ο σύνδεσμος στο δελτίο φέρει το token του συνδρομητή. Από το email του
 * βρίσκουμε τον πελάτη στο ERP, και η φόρμα ανοίγει ήδη συμπληρωμένη: την
 * επωνυμία, τις συμβάσεις και τις πινακίδες του τις ξέρουμε ήδη.
 *
 * Το token ΔΕΝ δίνει πρόσβαση σε τίποτα — δείχνει μόνο όσα θα δει ούτως ή
 * άλλως ο ίδιος ο πελάτης για τον εαυτό του, και δεν επιτρέπει καμία αλλαγή.
 * Η πραγματική πρόσβαση στην πύλη δίνεται ονομαστικά, αφού επιβεβαιωθούν τα
 * στοιχεία.
 */
export type InterestProfile = {
  subscriberId: string;
  email: string;
  /** Το όνομα όπως το έχει ο συνδρομητής, αν υπάρχει. */
  contactName: string | null;
  /** Ο πελάτης του ERP, αν το email ταυτοποιήθηκε. */
  trdr: string | null;
  company: string | null;
  phone: string | null;
  contracts: PortalContract[];
  /** Όλες οι πινακίδες όλων των συμβάσεων, χωρίς διπλές. */
  plates: string[];
};

/** Το προφίλ πίσω από ένα token συνδρομητή — `null` αν το token δεν υπάρχει. */
export async function getInterestProfile(token: string): Promise<InterestProfile | null> {
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { token },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!subscriber) return null;

  const contactName =
    [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ").trim() || null;

  const base: InterestProfile = {
    subscriberId: subscriber.id,
    email: subscriber.email,
    contactName,
    trdr: null,
    company: null,
    phone: null,
    contracts: [],
    plates: [],
  };

  // Το ίδιο email μπορεί να ανήκει σε περισσότερους από έναν πελάτες: λογιστής
  // με πολλές εταιρείες, ή παλιά και νέα καρτέλα του ίδιου πελάτη.
  //
  // Η σημαία `isPrimary` ΔΕΝ λύνει το ζήτημα — σημαίνει «πρώτη διεύθυνση του
  // κύριου πεδίου ΕΚΕΙΝΗΣ της καρτέλας», όχι «η σωστή καρτέλα». Στην πράξη η
  // «κύρια» έδειχνε άδεια καρτέλα και η σύμβαση ήταν στην άλλη, οπότε η σελίδα
  // έλεγε «δεν βρήκαμε ενεργή σύμβαση» σε πελάτη που είχε.
  //
  // Κριτήριο είναι η ΕΝΕΡΓΗ ΣΥΜΒΑΣΗ. Αν τη βρει σε μία καρτέλα, αυτή είναι.
  // Αν σε καμία, πέφτουμε στην κύρια για να ξέρουμε τουλάχιστον επωνυμία. Αν
  // σε περισσότερες από μία, δεν μαντεύουμε.
  const links = await prisma.customerEmail.findMany({
    where: { email: subscriber.email.toLowerCase() },
    orderBy: { isPrimary: "desc" },
    select: { trdr: true, isPrimary: true },
  });
  if (links.length === 0) return base;

  const candidates = await Promise.all(
    links.map(async (l) => ({
      trdr: l.trdr,
      contracts: (await getPortalContracts(l.trdr)).filter((c) => c.isActive),
    }))
  );

  const withContracts = candidates.filter((c) => c.contracts.length > 0);
  if (withContracts.length > 1) return base;

  const chosen = withContracts[0] ?? candidates.find((c) => c.trdr === links[0].trdr) ?? null;
  if (!chosen) return base;

  const customer = await prisma.cUSTORMER.findFirst({
    where: { TRDR: chosen.trdr },
    select: { NAME: true, PHONE01: true },
  });

  const company = customer?.NAME?.trim() || null;
  const plates = [...new Set(chosen.contracts.flatMap((c) => c.plates))].sort();

  return {
    ...base,
    trdr: chosen.trdr,
    company,
    // Η εισαγωγή συνδρομητών έβαλε την επωνυμία στο όνομα. Αν ταυτίζονται, το
    // αφήνουμε κενό: το πεδίο ζητά άνθρωπο, όχι εταιρεία ξανά.
    contactName: contactName && contactName !== company ? contactName : null,
    phone: customer?.PHONE01?.trim() || null,
    contracts: chosen.contracts,
    plates,
  };
}
