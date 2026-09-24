import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentEditor } from "@/components/cms/content-editor";
import {
  emptyTranslationDraft,
  toDateTimeLocal,
  type ContentDraft,
  type JsonLike,
} from "@/components/cms/types";
import { translationProviderName } from "@/lib/translate";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Επεξεργασία άρθρου. */
export default async function CmsNewsEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const { id } = await params;
  const post = await prisma.newsPost.findUnique({ where: { id }, include: { translations: true } });
  if (!post) notFound();

  const draft: ContentDraft = {
    id: post.id,
    status: post.status,
    key: "",
    showInMenu: false,
    menuOrder: "",
    coverImageUrl: post.coverImageUrl ?? "",
    publishedAt: toDateTimeLocal(post.publishedAt),
    translations: routing.locales.map((locale) => {
      const row = post.translations.find((item) => item.locale === locale);
      if (!row) return emptyTranslationDraft(locale);
      return {
        locale,
        title: row.title,
        slug: row.slug,
        slugTouched: true,
        excerpt: row.excerpt ?? "",
        contentJson: (row.contentJson ?? null) as JsonLike,
        contentHtml: row.contentHtml ?? "",
        seoTitle: row.seoTitle ?? "",
        seoDescription: row.seoDescription ?? "",
        ogImageUrl: "",
        isMachineTranslated: row.isMachineTranslated,
        epoch: 0,
      };
    }),
  };

  return <ContentEditor entity="news" initial={draft} providerName={translationProviderName()} />;
}
