import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ContentEditor } from "@/components/cms/content-editor";
import { emptyTranslationDraft, type ContentDraft, type JsonLike } from "@/components/cms/types";
import { translationProviderName } from "@/lib/translate";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Επεξεργασία σελίδας. */
export default async function CmsPageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id }, include: { translations: true } });
  if (!page) notFound();

  const draft: ContentDraft = {
    id: page.id,
    status: page.status,
    key: page.key,
    showInMenu: page.showInMenu,
    menuOrder: page.menuOrder != null ? String(page.menuOrder) : "",
    coverImageUrl: "",
    publishedAt: "",
    translations: routing.locales.map((locale) => {
      const row = page.translations.find((item) => item.locale === locale);
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
        ogImageUrl: row.ogImageUrl ?? "",
        isMachineTranslated: row.isMachineTranslated,
        epoch: 0,
      };
    }),
  };

  return <ContentEditor entity="page" initial={draft} providerName={translationProviderName()} />;
}
