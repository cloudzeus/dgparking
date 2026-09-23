import { getFormatter, getTranslations } from "next-intl/server";
import { PricingCards, type PricingPackage } from "./pricing-cards";

/** Τα πακέτα όπως στο megaparking.gr — η σειρά και οι τιμές μένουν ίδιες. */
const PACKAGES = [
  { key: "hourly", amount: 5, unit: null, icon: "clock" },
  { key: "allDay", amount: 12, unit: "perDay", icon: "sun", popular: true },
  { key: "dayNight", amount: 18, unit: "perDay", icon: "moon" },
  { key: "monthlyCar", amount: 120, unit: "perMonth", icon: "car" },
  { key: "monthlyMotorbike", amount: 60, unit: "perMonth", icon: "bike" },
] as const;

export async function PricingSection() {
  const t = await getTranslations("prices.packages");
  const format = await getFormatter();

  const packages: PricingPackage[] = PACKAGES.map((pkg) => ({
    key: pkg.key,
    icon: pkg.icon,
    title: t(`${pkg.key}.title`),
    description: t(`${pkg.key}.description`),
    features: t.raw(`${pkg.key}.features`) as string[],
    // Η τιμή μορφοποιείται με τη γλώσσα που είναι ενεργή (5 € / €5).
    price: format.number(pkg.amount, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }),
    unit: pkg.unit ? t(pkg.unit) : null,
    popular: "popular" in pkg && pkg.popular === true,
  }));

  return (
    <section
      id="packages"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:py-20"
      aria-labelledby="pricing-packages-heading"
    >
      <h2 id="pricing-packages-heading" className="text-center text-3xl font-bold tracking-tight">
        {t("title")}
      </h2>

      <PricingCards packages={packages} popularLabel={t("popular")} />
    </section>
  );
}
