import { getTranslations } from "next-intl/server";

/**
 * Επικεφαλίδα της σελίδας τιμών — αντιστοιχεί στο `PricingHeader` του παλιού site,
 * με τα χρώματα της μάρκας αντί για gradient κείμενο.
 */
export async function PricesHeader() {
  const t = await getTranslations("prices.header");

  return (
    <section className="border-b bg-mega-blue text-white" aria-labelledby="prices-heading">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center sm:py-20">
        <h1 id="prices-heading" className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/85 sm:text-lg">{t("description")}</p>
      </div>
    </section>
  );
}
