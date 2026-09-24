import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { ContentBody } from "@/components/site/cms/content-body";
import { MachineTranslationNotice } from "@/components/site/cms/machine-translation-notice";
import { PageBand } from "@/components/site/cms/page-band";
import { siteUrl } from "@/lib/site-url";

/** Οι σελίδες γράφονται από τη διαχείριση — απόδοση στο αίτημα. */
export const dynamic = "force-dynamic";

/**
 * Οι πραγματικές διαδρομές κάτω από `src/app/[locale]/`. Το Next δίνει ούτως ή
 * άλλως προτεραιότητα στα στατικά τμήματα έναντι του `[slug]`, οπότε το `/prices`
 * δεν φτάνει ποτέ εδώ. Ο κατάλογος υπάρχει ως δεύτερο δίχτυ: αν κάποιος
 * αποθηκεύσει στο CMS μια σελίδα με slug `prices`, δεν θα υπόσχεται μια
 * διεύθυνση που δεν πρόκειται να την εμφανίσει ποτέ.
 *
 * Κράτα τον συγχρονισμένο με τους φακέλους του `src/app/[locale]/`.
 */
const RESERVED_SLUGS = new Set([
  "contact",
  "cookies",
  "data-rights",
  "news",
  "prices",
  "privacy",
  "terms",
]);

type RouteParams = { locale: string; slug: string };

async function loadPage(locale: string, slug: string) {
  if (RESERVED_SLUGS.has(slug)) return null;

  const translation = await prisma.pageTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      page: {
        include: { translations: { select: { locale: true, slug: true } } },
      },
    },
  });

  if (!translation || translation.page.status !== ContentStatus.PUBLISHED) return null;
  return translation;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await loadPage(locale, slug);
  if (!page) return {};

  const t = await getTranslations({ locale });

  const languages: Record<string, string> = {};
  for (const other of page.page.translations) {
    if (!routing.locales.includes(other.locale as (typeof routing.locales)[number])) continue;
    languages[other.locale] = `/${other.locale}/${other.slug}`;
  }

  const title = page.seoTitle ?? page.title;
  const description = page.seoDescription ?? page.excerpt ?? undefined;

  return {
    metadataBase: new URL(siteUrl()),
    title: `${t("site.name")} — ${title}`,
    description,
    alternates: {
      canonical: `/${locale}/${page.slug}`,
      languages,
    },
    openGraph: {
      type: "website",
      title,
      description,
      locale,
      url: `/${locale}/${page.slug}`,
      images: page.ogImageUrl ? [{ url: page.ogImageUrl }] : undefined,
    },
  };
}

export default async function CmsPage({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const page = await loadPage(locale, slug);
  if (!page) notFound();

  return (
    <>
      <PageBand title={page.title} description={page.excerpt} headingId="cms-page-heading" />

      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        {page.isMachineTranslated ? (
          <div className="mb-8 rounded-md border border-dashed bg-secondary/60 px-4 py-3">
            <MachineTranslationNotice />
          </div>
        ) : null}

        <ContentBody html={page.contentHtml} />
      </div>
    </>
  );
}
