import type { Metadata } from "next";
import { ContentStatus } from "@prisma/client";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PageBand } from "@/components/site/cms/page-band";
import { NewsCard } from "@/components/site/cms/news-card";
import { NewsPagination } from "@/components/site/cms/news-pagination";

/** Τα νέα αλλάζουν από τη διαχείριση — η σελίδα χτίζεται σε κάθε αίτημα. */
export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: `${t("site.name")} — ${t("news.meta.title")}`,
    description: t("news.meta.description"),
  };
}

export default async function NewsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("news.index");
  const format = await getFormatter({ locale });

  const where = {
    locale,
    post: { status: ContentStatus.PUBLISHED },
  };

  const total = await prisma.newsTranslation.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const requested = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), totalPages) : 1;

  const translations = await prisma.newsTranslation.findMany({
    where,
    orderBy: [{ post: { publishedAt: "desc" } }, { post: { createdAt: "desc" } }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      post: { select: { coverImageUrl: true, publishedAt: true, createdAt: true } },
    },
  });

  return (
    <>
      <PageBand title={t("title")} description={t("description")} headingId="news-heading" />

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:py-16">
        {translations.length === 0 ? (
          // Ένας κατάλογος χωρίς νέα δεν είναι σφάλμα — είναι μια σελίδα που
          // περιμένει το πρώτο της κείμενο.
          <p className="mx-auto max-w-xl py-16 text-center text-base text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {translations.map((item, index) => {
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
                    readMoreLabel={t("readMore")}
                    priority={index === 0}
                  />
                );
              })}
            </div>

            <NewsPagination
              page={page}
              totalPages={totalPages}
              labels={{
                previous: t("previous"),
                next: t("next"),
                status: t("pageStatus", { page, total: totalPages }),
                navigation: t("paginationNav"),
              }}
            />
          </>
        )}
      </section>
    </>
  );
}
