import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check, Cookie, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CookiePreferencesButton } from "@/components/site/cookie-preferences-button";

const CATEGORIES = ["necessary", "analytics", "marketing"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("gdpr.cookies.meta.title")} — ${t("site.name")}`,
    description: t("gdpr.cookies.meta.description"),
  };
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("gdpr.cookies");
  const tPrivacy = await getTranslations("gdpr.privacy");

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-bold sm:text-4xl">
          <Cookie className="size-8 text-mega-red" aria-hidden />
          {t("meta.title")}
        </h1>
        <p className="text-base text-muted-foreground">{t("lead")}</p>
      </header>

      <section className="mt-10 flex flex-col gap-4" aria-labelledby="cookie-categories-heading">
        <h2 id="cookie-categories-heading" className="text-lg font-semibold">
          {t("whatTitle")}
        </h2>

        <ul className="flex flex-col gap-4">
          {CATEGORIES.map((category) => (
            <li key={category} className="rounded-lg border bg-card p-5">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold">{t(`categories.${category}.name`)}</h3>
                {category === "necessary" ? (
                  <Badge variant="success">
                    <Check aria-hidden />
                    {t("alwaysOn")}
                  </Badge>
                ) : (
                  <Badge variant="neutral">{t("optional")}</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`categories.${category}.description`)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`categories.${category}.examples`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="mt-10 rounded-lg border bg-muted/40 p-6"
        aria-labelledby="cookie-manage-heading"
      >
        <h2 id="cookie-manage-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Settings2 className="size-5 text-mega-red" aria-hidden />
          {t("manageTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("manageText")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <CookiePreferencesButton
            label={t("reopen")}
            variant="default"
            className="bg-mega-red text-white hover:brightness-110"
          />
          <Button asChild variant="outline">
            <Link href="/privacy">{tPrivacy("meta.title")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/data-rights">{tPrivacy("rightsCta")}</Link>
          </Button>
        </div>
      </section>
    </article>
  );
}
