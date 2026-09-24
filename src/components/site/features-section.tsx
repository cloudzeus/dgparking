import { getTranslations } from "next-intl/server";
import { Camera, DoorOpen, FileText, LayoutDashboard, Database, BarChart3 } from "lucide-react";

/**
 * Οι δυνατότητες της πλατφόρμας.
 *
 * ΓΙΑΤΙ ΛΙΣΤΑ ΚΑΙ ΟΧΙ ΕΞΙ ΚΑΡΤΕΣ
 * Έξι κάρτες σε πλέγμα, αμέσως μετά από άλλες τέσσερις κάρτες σε πλέγμα,
 * διαβάζονται ως θόρυβος: ίδιο σχήμα, ίδιο μέγεθος, ίδιο βάρος. Η αριθμημένη
 * λίστα με γραμμές δίνει σειρά ανάγνωσης — υπάρχει πρώτο και τελευταίο — και
 * αφήνει το κείμενο να αναπνεύσει σε πλάτος που διαβάζεται.
 *
 * Ο τίτλος μένει κολλημένος αριστερά όσο κυλά η λίστα, ώστε ο επισκέπτης να
 * ξέρει πάντα τι διαβάζει χωρίς να γυρίσει πίσω.
 */
const FEATURES = [
  { key: "lpr", icon: Camera },
  { key: "access", icon: DoorOpen },
  { key: "contracts", icon: FileText },
  { key: "dashboard", icon: LayoutDashboard },
  { key: "erp", icon: Database },
  { key: "reports", icon: BarChart3 },
] as const;

export async function FeaturesSection() {
  const t = await getTranslations("features");

  return (
    <section id="services" className="scroll-mt-20 bg-muted/40">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mega-red)]">
            {t("eyebrow")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("description")}</p>
        </div>

        <ol className="divide-y divide-border border-t border-border">
          {FEATURES.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              className="group flex gap-4 py-6 transition-colors sm:gap-6 sm:py-7"
            >
              <span
                className="mt-0.5 w-8 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground/60 transition-colors group-hover:text-[var(--mega-red)]"
                aria-hidden
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-xl bg-background text-[var(--mega-blue)] shadow-sm transition-colors group-hover:bg-[var(--mega-blue)] group-hover:text-white sm:flex">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{t(`${key}.title`)}</h3>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {t(`${key}.description`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
