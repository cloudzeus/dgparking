import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { ArrowLeft, Clock } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { estimateReadingMinutes } from "@/lib/sanitize-html";
import { ContentBody } from "@/components/site/cms/content-body";
import { MachineTranslationNotice } from "@/components/site/cms/machine-translation-notice";
import { NewsCard } from "@/components/site/cms/news-card";
import { siteUrl } from "@/lib/site-url";

/**
 * Το περιεχόμενο αλλάζει από τη διαχείριση, άρα δεν προ-χτίζουμε διαδρομές:
 * χωρίς `generateStaticParams`, με απόδοση στο αίτημα.
 */
export const dynamic = "force-dynamic";

type RouteParams = { locale: string; slug: string };

/** Το άρθρο στη ζητούμενη γλώσσα — μόνο αν η δημοσίευση είναι ενεργή. */
async function loadArticle(locale: string, slug: string) {
  const translation = await prisma.newsTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      post: {
        include: {
          translations: { select: { locale: true, slug: true } },
        },
      },
    },
  });

  if (!translation || translation.post.status !== ContentStatus.PUBLISHED) return null;
  return translation;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await loadArticle(locale, slug);
  if (!article) return {};

  const t = await getTranslations({ locale });

  // Η ίδια είδηση έχει διαφορετικό slug ανά γλώσσα — τα ζευγάρια βγαίνουν
  // από τις μεταφράσεις της δημοσίευσης, όχι από μετάφραση της διαδρομής.
  const languages: Record<string, string> = {};
  for (const other of article.post.translations) {
    if (!routing.locales.includes(other.locale as (typeof routing.locales)[number])) continue;
    languages[other.locale] = `/${other.locale}/news/${other.slug}`;
  }

  const title = article.seoTitle ?? article.title;
  const description = article.seoDescription ?? article.excerpt ?? undefined;
  const cover = article.post.coverImageUrl ?? undefined;

  return {
    metadataBase: new URL(siteUrl()),
    title: `${t("site.name")} — ${title}`,
    description,
    alternates: {
      canonical: `/${locale}/news/${article.slug}`,
      languages,
    },
    openGraph: {
      type: "article",
      title,
      description,
      locale,
      url: `/${locale}/news/${article.slug}`,
      publishedTime: (article.post.publishedAt ?? article.post.createdAt).toISOString(),
      images: cover ? [{ url: cover }] : undefined,
    },
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<RouteParams> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = await loadArticle(locale, slug);
  if (!article) notFound();

  const t = await getTranslations("news.article");
  const tIndex = await getTranslations("news.index");
  const format = await getFormatter({ locale });

  const publishedAt = article.post.publishedAt ?? article.post.createdAt;
  const minutes = estimateReadingMinutes(article.contentHtml);

  const related = await prisma.newsTranslation.findMany({
    where: {
      locale,
      post: { status: ContentStatus.PUBLISHED },
      postId: { not: article.postId },
    },
    orderBy: [{ post: { publishedAt: "desc" } }, { post: { createdAt: "desc" } }],
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      post: { select: { coverImageUrl: true, publishedAt: true, createdAt: true } },
    },
  });

  return (
    <article className="pb-4">
      {article.post.coverImageUrl ? (
        <div className="relative aspect-[21/9] w-full bg-secondary">
          <Image
            src={article.post.coverImageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {article.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm text-muted-foreground">
          <time dateTime={publishedAt.toISOString()}>
            {format.dateTime(publishedAt, { dateStyle: "long" })}
          </time>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            {t("readingTime", { minutes })}
          </span>
        </div>

        {article.isMachineTranslated ? (
          <div className="mt-6 rounded-md border border-dashed bg-secondary/60 px-4 py-3">
            <MachineTranslationNotice />
          </div>
        ) : null}

        {article.excerpt ? (
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{article.excerpt}</p>
        ) : null}

        <ContentBody html={article.contentHtml} className="mt-8" />
      </div>

      {related.length > 0 ? (
        <section className="border-t bg-secondary/40" aria-labelledby="related-heading">
          <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:py-16">
            <h2 id="related-heading" className="text-xl font-semibold text-foreground">
              {t("related")}
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => {
                const date = item.post.publishedAt ?? item.post.createdAt;

                return (
                  <NewsCard
                    key={item.id}
                    slug={item.slug}
                    title={item.title}
                    excerpt={item.excerpt}
                    coverImageUrl={item.post.coverImageUrl}
                    dateLabel={format.dateTime(date, { dateStyle: "long" })}
                    dateTime={date.toISOString()}
                    readMoreLabel={tIndex("readMore")}
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
