import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroSection } from "@/components/site/hero-section";
import { StatsBand } from "@/components/site/stats-band";
import { WhyChooseUsSection } from "@/components/site/why-choose-us-section";
import { FeaturesSection } from "@/components/site/features-section";
import { BusinessSolutionsSection } from "@/components/site/business-solutions-section";
import { CtaSection } from "@/components/site/cta-section";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import { EuBanner } from "@/components/site/eu-banner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("site.name")} — ${t("hero.title")}`,
    description: t("hero.description"),
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <EuBanner />
      <HeroSection />
      <StatsBand />
      <WhyChooseUsSection />
      <FeaturesSection />
      <BusinessSolutionsSection />
      <CtaSection />
      <TestimonialsSection />
    </>
  );
}
