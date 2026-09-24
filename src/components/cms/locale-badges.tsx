import { Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LOCALE_LABEL, LOCALE_SHORT } from "@/components/cms/types";
import { routing, type Locale } from "@/i18n/routing";

export type LocaleState = { locale: Locale; machine: boolean };

/**
 * Ποιες γλώσσες έχει η εγγραφή: πράσινο = ελεγμένη μετάφραση, κίτρινο =
 * μηχανική που περιμένει έλεγχο, γκρι περίγραμμα = λείπει.
 */
export function LocaleBadges({ locales }: { locales: LocaleState[] }) {
  const byLocale = new Map(locales.map((item) => [item.locale, item]));

  return (
    <div className="flex flex-wrap items-center gap-1">
      {routing.locales.map((locale) => {
        const state = byLocale.get(locale);
        const title = !state
          ? `${LOCALE_LABEL[locale]}: δεν υπάρχει μετάφραση`
          : state.machine
            ? `${LOCALE_LABEL[locale]}: μηχανική μετάφραση χωρίς έλεγχο`
            : `${LOCALE_LABEL[locale]}: έτοιμη`;

        return (
          <Badge
            key={locale}
            variant={!state ? "outline" : state.machine ? "warning" : "success"}
            className={!state ? "text-muted-foreground" : undefined}
            title={title}
          >
            {state?.machine && <Languages aria-hidden />}
            {LOCALE_SHORT[locale]}
          </Badge>
        );
      })}
    </div>
  );
}
