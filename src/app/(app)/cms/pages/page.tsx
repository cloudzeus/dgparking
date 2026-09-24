import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PagesClient, type PageRow } from "@/components/cms/pages-client";
import type { LocaleState } from "@/components/cms/locale-badges";
import { routing, type Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Λίστα σελίδων του CMS. */
export default async function CmsPagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const pages = await prisma.page.findMany({
    orderBy: [{ menuOrder: "asc" }, { updatedAt: "desc" }],
    include: { translations: true },
  });

  const rows: PageRow[] = pages.map((page) => {
    const greek = page.translations.find((item) => item.locale === routing.defaultLocale);
    const primary = greek ?? page.translations[0];
    const locales: LocaleState[] = page.translations
      .filter((item) => (routing.locales as readonly string[]).includes(item.locale))
      .map((item) => ({ locale: item.locale as Locale, machine: item.isMachineTranslated }));

    return {
      id: page.id,
      key: page.key,
      status: page.status,
      showInMenu: page.showInMenu,
      menuOrder: page.menuOrder,
      title: primary?.title ?? "",
      slug: primary?.slug ?? "",
      locales,
      updatedAt: page.updatedAt.toISOString(),
      createdAt: page.createdAt.toISOString(),
      publishedAt: page.publishedAt?.toISOString() ?? null,
    };
  });

  return <PagesClient pages={rows} />;
}
