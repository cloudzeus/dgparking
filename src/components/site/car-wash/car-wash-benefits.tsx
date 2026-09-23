import { getTranslations } from "next-intl/server";
import { Clock, Leaf, Sparkles } from "lucide-react";

const BENEFITS = [
  { key: "time", icon: Clock },
  { key: "professional", icon: Sparkles },
  { key: "eco", icon: Leaf },
] as const;

/** «Γιατί να μας επιλέξετε»: τα τρία πλεονεκτήματα της υπηρεσίας. */
export async function CarWashBenefits() {
  const t = await getTranslations("carWash.benefits");

  return (
    <section className="border-y bg-muted/40" aria-labelledby="car-wash-benefits-heading">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <h2
          id="car-wash-benefits-heading"
          className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight"
        >
          {t("title")}
        </h2>

        <dl className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          {BENEFITS.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-lg border bg-card p-6 shadow-sm">
              <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-6" aria-hidden />
              </span>
              <dt className="mb-2 text-lg font-semibold">{t(`${key}.title`)}</dt>
              <dd className="text-sm text-muted-foreground">{t(`${key}.description`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
