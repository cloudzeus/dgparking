/**
 * Η δημόσια διεύθυνση του site, για απόλυτους συνδέσμους στα metadata.
 * Ίδια σειρά προτεραιότητας με το `lib/newsletter.ts`, ώστε να μη χρειάζεται
 * δεύτερη μεταβλητή περιβάλλοντος.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  return raw.replace(/\/+$/, "");
}
