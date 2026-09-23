import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CarWashHero } from "@/components/site/car-wash/car-wash-hero";
import { CarWashPackages } from "@/components/site/car-wash/car-wash-packages";
import { CarWashBenefits } from "@/components/site/car-wash/car-wash-benefits";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("site.name")} — ${t("carWash.meta.title")}`,
    description: t("carWash.meta.description"),
  };
}

export default async function CarWashPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <CarWashHero />
      <CarWashPackages />
      <CarWashBenefits />
    </>
  );
}
