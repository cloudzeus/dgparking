import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ContentEditor } from "@/components/cms/content-editor";
import { emptyTranslationDraft, type ContentDraft } from "@/components/cms/types";
import { translationProviderName } from "@/lib/translate";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Νέο άρθρο — κενό προσχέδιο σε τρεις γλώσσες. */
export default async function NewCmsPostPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const draft: ContentDraft = {
    id: null,
    status: "DRAFT",
    key: "",
    showInMenu: false,
    menuOrder: "",
    coverImageUrl: "",
    publishedAt: "",
    translations: routing.locales.map((locale) => emptyTranslationDraft(locale)),
  };

  return <ContentEditor entity="news" initial={draft} providerName={translationProviderName()} />;
}
