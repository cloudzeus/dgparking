import { getTranslations } from "next-intl/server";
import { CircleParking, ShieldCheck, Ship, CalendarDays } from "lucide-react";

/**
 * Ζώνη αριθμών, αμέσως κάτω από το hero.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * Η αρχική είχε τέσσερις σερί ενότητες με το ΙΔΙΟ σχήμα: κεντραρισμένος
 * τίτλος και πλέγμα από καρτέλες με εικονίδιο. Αυτή η επανάληψη είναι που
 * κάνει μια σελίδα να μοιάζει με πρότυπο — το μάτι δεν βρίσκει πουθενά να
 * σταθεί. Μια σκούρα, χαμηλή ζώνη σπάει τον ρυθμό στο πρώτο κιόλας scroll.
 *
 * Και λέει κάτι που καμία κάρτα δεν λέει: συγκεκριμένα νούμερα. Το «ιδανική
 * τοποθεσία» το γράφει κάθε πάρκινγκ· το «5 λεπτά από το λιμάνι» όχι.
 */
export async function StatsBand() {
  const t = await getTranslations("stats");

  const items = [
    { key: "spaces", icon: CircleParking },
    { key: "hours", icon: ShieldCheck },
    { key: "port", icon: Ship },
    { key: "years", icon: CalendarDays },
  ] as const;

  return (
    <section className="bg-[var(--mega-blue)] text-white" aria-label={t("eyebrow")}>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-12">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          {t("eyebrow")}
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {items.map(({ key, icon: Icon }) => (
            <div key={key} className="border-l border-white/15 pl-4">
              <Icon className="mb-2 size-5 text-[var(--mega-red)]" aria-hidden />
              {/* tabular-nums: τα νούμερα δεν πρέπει να «χορεύουν» μεταξύ γλωσσών. */}
              <dd className="text-3xl font-bold tabular-nums leading-none sm:text-4xl">
                {t(`${key}.value`)}
              </dd>
              <dt className="mt-1.5 text-sm text-white/65">{t(`${key}.label`)}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
