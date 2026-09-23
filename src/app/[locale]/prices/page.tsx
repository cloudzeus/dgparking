import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PricesHeader } from "@/components/site/prices/prices-header";
import { PricingSection } from "@/components/site/prices/pricing-section";
import { PricesFaq } from "@/components/site/prices/prices-faq";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("site.name")} — ${t("prices.meta.title")}`,
    description: t("prices.meta.description"),
  };
}

export default async function PricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <PricesHeader />
      <PricingSection />
      <PricesFaq />
    </>
  );
}
