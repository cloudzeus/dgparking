import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Τα μηνύματα ζουν ανά ενότητα: `src/messages/<γλώσσα>/<ενότητα>.json`.
 * Κάθε σελίδα έχει το δικό της αρχείο, ώστε οι αλλαγές να μην μπλέκονται.
 */
const NAMESPACES = [
  "common",
  "home",
  "prices",
  "contact",
  "legal",
  "gdpr",
  "news",
  "events",
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const loaded = await Promise.all(
    NAMESPACES.map((ns) => import(`../messages/${locale}/${ns}.json`).then((m) => m.default))
  );

  return {
    locale,
    messages: Object.assign({}, ...loaded),
    timeZone: "Europe/Athens",
  };
});
