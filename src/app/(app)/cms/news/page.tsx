import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewsClient, type NewsRow } from "@/components/cms/news-client";
import type { LocaleState } from "@/components/cms/locale-badges";
import { routing, type Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Λίστα άρθρων του CMS. */
export default async function CmsNewsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const posts = await prisma.newsPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    include: { translations: true },
  });

  const rows: NewsRow[] = posts.map((post) => {
    const greek = post.translations.find((item) => item.locale === routing.defaultLocale);
    const primary = greek ?? post.translations[0];
    const locales: LocaleState[] = post.translations
      .filter((item) => (routing.locales as readonly string[]).includes(item.locale))
      .map((item) => ({ locale: item.locale as Locale, machine: item.isMachineTranslated }));

    return {
      id: post.id,
      status: post.status,
      coverImageUrl: post.coverImageUrl,
      title: primary?.title ?? "",
      slug: primary?.slug ?? "",
      excerpt: primary?.excerpt ?? null,
      locales,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      updatedAt: post.updatedAt.toISOString(),
      createdAt: post.createdAt.toISOString(),
    };
  });

  return <NewsClient posts={rows} />;
}
