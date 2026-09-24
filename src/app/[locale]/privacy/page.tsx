import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LegalDocument } from "@/components/site/legal-document";
import { AuthorityCard, ControllerCard } from "@/components/site/legal-contact";
import { RightsList } from "@/components/site/rights-list";
import { CookiePreferencesButton } from "@/components/site/cookie-preferences-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("gdpr.privacy.meta.title")} — ${t("site.name")}`,
    description: t("gdpr.privacy.meta.description"),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("gdpr.privacy");
  const tLegal = await getTranslations("legal.privacyPolicy");

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

        <LegalDocument document="privacyPolicy" />

        <section className="flex flex-col gap-4" aria-labelledby="rights-heading">
          <h2 id="rights-heading" className="text-lg font-semibold">
            {t("rightsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("rightsIntro")}</p>
          <RightsList linkTo="/data-rights" />
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-mega-red text-white hover:brightness-110">
              <Link href="/data-rights">{t("rightsCta")}</Link>
            </Button>
            <CookiePreferencesButton label={t("cookiesCta")} variant="outline" />
          </div>
        </section>

        <AuthorityCard />
      </div>
    </article>
  );
}
