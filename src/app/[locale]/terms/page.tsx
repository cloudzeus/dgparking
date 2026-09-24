import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LegalDocument } from "@/components/site/legal-document";
import { ControllerCard } from "@/components/site/legal-contact";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("gdpr.terms.meta.title")} — ${t("site.name")}`,
    description: t("gdpr.terms.meta.description"),
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("gdpr.terms");
  const tRights = await getTranslations("gdpr.privacy");
  const tLegal = await getTranslations("legal.termsOfService");

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">{tLegal("title")}</h1>
        <p className="text-sm text-muted-foreground">{tLegal("effectiveDate")}</p>
        <p className="text-base text-muted-foreground">{t("lead")}</p>
        <p className="text-base text-muted-foreground">{tLegal("intro")}</p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        <ControllerCard />

        <LegalDocument document="termsOfService" />

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/privacy">{tRights("meta.title")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/data-rights">{tRights("rightsCta")}</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
