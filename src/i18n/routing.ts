import { defineRouting } from "next-intl/routing";

/**
 * Γλώσσες του δημόσιου site (MEGA Parking): ελληνικά, αγγλικά, ιταλικά.
 *
 * Μόνο οι δημόσιες σελίδες έχουν πρόθεμα γλώσσας (`/el`, `/en`, `/it`).
 * Οι σελίδες διαχείρισης και σύνδεσης μένουν χωρίς πρόθεμα και στα ελληνικά.
 */
export const routing = defineRouting({
  locales: ["el", "en", "it"],
  defaultLocale: "el",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** Ετικέτες για τον επιλογέα γλώσσας — πάντα στη γλώσσα που δηλώνουν. */
export const localeNames: Record<Locale, { label: string; short: string }> = {
  el: { label: "Ελληνικά", short: "EL" },
  en: { label: "English", short: "EN" },
  it: { label: "Italiano", short: "IT" },
};
