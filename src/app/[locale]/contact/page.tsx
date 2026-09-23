import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactHero } from "@/components/site/contact/contact-hero";
import { ContactInfo } from "@/components/site/contact/contact-info";
import { ContactForm } from "@/components/site/contact/contact-form";
import { ContactMap } from "@/components/site/contact/contact-map";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("contact.meta.title")} — ${t("site.name")}`,
    description: t("contact.meta.description"),
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <ContactHero />

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20" aria-labelledby="contact-info-heading">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <ContactInfo />
            <ContactForm />
          </div>
          <ContactMap />
        </div>
      </section>
    </>
  );
}
