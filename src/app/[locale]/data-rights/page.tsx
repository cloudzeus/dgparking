import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Clock, Euro, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthorityCard, ControllerCard } from "@/components/site/legal-contact";
import { RightsList } from "@/components/site/rights-list";
import { DataRightsForm } from "@/components/site/data-rights-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("gdpr.dataRights.meta.title")} — ${t("site.name")}`,
    description: t("gdpr.dataRights.meta.description"),
  };
}

export default async function DataRightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ verified?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { verified } = await searchParams;
  const t = await getTranslations("gdpr.dataRights");

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("meta.title")}</h1>
        <p className="text-base text-muted-foreground">{t("lead")}</p>
      </header>

      {verified === "1" && (
        <div
          role="status"
          className="mt-8 flex items-start gap-3 rounded-lg border border-green-600/30 bg-green-600/10 p-4"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-700" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("verified.title")}</p>
            <p className="text-sm text-muted-foreground">{t("verified.description")}</p>
          </div>
        </div>
      )}

      {verified === "0" && (
        <div
          role="status"
          className="mt-8 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("verifyFailed.title")}</p>
            <p className="text-sm text-muted-foreground">{t("verifyFailed.description")}</p>
          </div>
        </div>
      )}

      <div className="mt-10 flex flex-col gap-10">
        <section className="flex flex-col gap-4" aria-labelledby="rights-heading">
          <h2 id="rights-heading" className="text-lg font-semibold">
            {t("rightsTitle")}
          </h2>
          <RightsList />
        </section>

        <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
          <DataRightsForm />
        </Suspense>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-lg border bg-muted/40 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Clock className="size-5 text-mega-red" aria-hidden />
              {t("deadlineTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("deadlineText")}</p>
          </section>

          <section className="rounded-lg border bg-muted/40 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Euro className="size-5 text-mega-red" aria-hidden />
              {t("freeTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("freeText")}</p>
          </section>
        </div>

        <ControllerCard />
        <AuthorityCard />
      </div>
    </article>
  );
}
