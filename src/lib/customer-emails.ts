/**
 * Εξαγωγή διευθύνσεων email από τα πεδία του ERP.
 *
 * Τα `CUSTORMER.EMAIL` και `CUSTORMER.EMAILACC` είναι ελεύθερο κείμενο και στην
 * πράξη περιέχουν ό,τι πρόλαβε να γράψει ο χρήστης:
 *
 *   Sifakis Office <office@sifakisglass.gr>
 *   a@zim.com;b@zim.com;c@zim.com
 *   info@c-systems.gr / philippos <philippos@gmail.com>
 *   atzerefos@acepower.gr    Αλέξανδρος Τζερεφός
 *
 * Δεν έχει νόημα να «σπάσουμε στον διαχωριστή» — οι διαχωριστές είναι τέσσερις
 * διαφορετικοί και μπερδεύονται με ονόματα. Αντί γι' αυτό τραβάμε ό,τι ΜΟΙΑΖΕΙ
 * με διεύθυνση, όπου κι αν βρίσκεται μέσα στο κείμενο.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Όλες οι έγκυρες διευθύνσεις μέσα σε ένα πεδίο, πεζές και χωρίς διπλές. */
export function extractEmails(...fields: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const field of fields) {
    if (!field) continue;
    for (const match of field.match(EMAIL_RE) ?? []) {
      const email = match.toLowerCase().trim().replace(/[.,;]+$/, "");
      // Διευθύνσεις-σκουπίδια που συναντώνται σε ERP δεδομένα.
      if (email.endsWith("@example.com") || email.startsWith("noreply@")) continue;
      found.add(email);
    }
  }
  return [...found];
}

/** Η «κύρια» διεύθυνση: η πρώτη του `EMAIL`, αλλιώς η πρώτη οποιαδήποτε. */
export function primaryEmail(
  emailField: string | null | undefined,
  emailAccField?: string | null
): string | null {
  return extractEmails(emailField)[0] ?? extractEmails(emailAccField)[0] ?? null;
}
