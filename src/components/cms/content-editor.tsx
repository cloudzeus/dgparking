"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ContentStatus } from "@prisma/client";
import { ArrowLeft, FileText, Languages, Newspaper, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/admin/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AutoTranslateButton } from "@/components/cms/auto-translate-button";
import { CmsRichTextEditor } from "@/components/cms/rich-text-editor";
import { ImageField } from "@/components/cms/image-field";
import {
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_VARIANT,
  LOCALE_LABEL,
  LOCALE_SHORT,
  type CmsEntity,
  type ContentDraft,
  type TranslationDraft,
  type TranslationInput,
} from "@/components/cms/types";
import { createPage, createPost, deletePage, deletePost, updatePage, updatePost } from "@/lib/actions/cms";
import { slugify } from "@/lib/translate";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Ο επεξεργαστής περιεχομένου — ίδιος για σελίδες και για νέα.
 *
 * Μία καρτέλα ανά γλώσσα. Κάθε καρτέλα κρατά τίτλο, slug, περίληψη, SEO και το
 * σώμα του κειμένου. Αποθηκεύουμε ΚΑΙ `contentJson` (η κατάσταση του Tiptap,
 * για να ξανανοίξει σωστά) ΚΑΙ `contentHtml` (αυτό αποδίδει το δημόσιο site).
 */

const STATUSES: ContentStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export function ContentEditor({
  entity,
  initial,
  providerName,
}: {
  entity: CmsEntity;
  initial: ContentDraft;
  /** Όνομα της υπηρεσίας μετάφρασης, ή κενό όταν δεν έχει ρυθμιστεί. */
  providerName: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ContentDraft>(initial);
  const [activeLocale, setActiveLocale] = useState<Locale>(routing.defaultLocale);
  const [saving, startSaving] = useTransition();
  const [removing, startRemoving] = useTransition();

  const isPage = entity === "page";
  const isNew = draft.id === null;
  const listHref = isPage ? "/cms/pages" : "/cms/news";

  function patch(locale: Locale, changes: Partial<TranslationDraft>) {
    setDraft((current) => ({
      ...current,
      translations: current.translations.map((item) =>
        item.locale === locale ? { ...item, ...changes } : item,
      ),
    }));
  }

  function setTitle(locale: Locale, title: string) {
    setDraft((current) => ({
      ...current,
      translations: current.translations.map((item) =>
        item.locale === locale
          ? { ...item, title, slug: item.slugTouched ? item.slug : slugify(title) }
          : item,
      ),
    }));
  }

  function toInput(item: TranslationDraft): TranslationInput {
    return {
      locale: item.locale,
      title: item.title,
      slug: item.slug || slugify(item.title),
      excerpt: item.excerpt,
      contentJson: item.contentJson,
      contentHtml: item.contentHtml,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      ogImageUrl: item.ogImageUrl,
      isMachineTranslated: item.isMachineTranslated,
    };
  }

  function save() {
    startSaving(async () => {
      const translations = draft.translations.map(toInput);

      const result = isPage
        ? draft.id
          ? await updatePage(draft.id, {
              key: draft.key,
              status: draft.status,
              showInMenu: draft.showInMenu,
              menuOrder: draft.menuOrder.trim() === "" ? null : Number(draft.menuOrder),
              translations,
            })
          : await createPage({
              key: draft.key,
              status: draft.status,
              showInMenu: draft.showInMenu,
              menuOrder: draft.menuOrder.trim() === "" ? null : Number(draft.menuOrder),
              translations,
            })
        : draft.id
          ? await updatePost(draft.id, {
              status: draft.status,
              coverImageUrl: draft.coverImageUrl,
              publishedAt: draft.publishedAt || null,
              translations,
            })
          : await createPost({
              status: draft.status,
              coverImageUrl: draft.coverImageUrl,
              publishedAt: draft.publishedAt || null,
              translations,
            });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message);

      // Τα slug μπορεί να άλλαξαν (μοναδικότητα ανά γλώσσα) — δείξε τα τελικά.
      const slugs = new Map(result.translations.map((row) => [row.locale, row.slug]));
      setDraft((current) => ({
        ...current,
        id: result.id,
        translations: current.translations.map((item) => ({
          ...item,
          slug: slugs.get(item.locale) ?? item.slug,
          isMachineTranslated: item.title.trim() ? item.isMachineTranslated : false,
        })),
      }));

      if (isNew) router.replace(`${listHref}/${result.id}`);
      router.refresh();
    });
  }

  function remove() {
    if (!draft.id) return;
    const id = draft.id;
    startRemoving(async () => {
      const result = isPage ? await deletePage(id) : await deletePost(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.push(listHref);
      router.refresh();
    });
  }

  const greekTitle = draft.translations.find((item) => item.locale === routing.defaultLocale)?.title ?? "";
  const headerTitle = isNew
    ? isPage
      ? "Νέα σελίδα"
      : "Νέο άρθρο"
    : greekTitle || (isPage ? "Σελίδα" : "Άρθρο");

  const busy = saving || removing;

  return (
    <div className="space-y-4">
      <PageHeader
        title={headerTitle}
        description={
          isPage
            ? "Περιεχόμενο σελίδας του δημόσιου site, σε τρεις γλώσσες."
            : "Άρθρο του δημόσιου site, σε τρεις γλώσσες."
        }
        icon={isPage ? FileText : Newspaper}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={listHref}>
                <ArrowLeft aria-hidden />
                Επιστροφή
              </Link>
            </Button>
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive" disabled={busy}>
                    <Trash2 aria-hidden />
                    Διαγραφή
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isPage ? "Διαγραφή της σελίδας;" : "Διαγραφή του άρθρου;"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      «{headerTitle}» θα διαγραφεί οριστικά σε όλες τις γλώσσες. Η ενέργεια δεν αναιρείται.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>Διαγραφή</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={save} disabled={busy}>
              {saving ? <Spinner data-icon="inline-start" /> : <Save aria-hidden />}
              Αποθήκευση
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Στοιχεία {isPage ? "σελίδας" : "άρθρου"}</CardTitle>
          <CardDescription>
            {isPage
              ? "Ισχύουν για όλες τις γλώσσες: κλειδί, κατάσταση και θέση στο μενού."
              : "Ισχύουν για όλες τις γλώσσες: κατάσταση, εξώφυλλο και ημερομηνία δημοσίευσης."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isPage && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cms-key">Κλειδί</Label>
              <Input
                id="cms-key"
                value={draft.key}
                placeholder="π.χ. about"
                className="font-mono"
                onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))}
              />
              <span className="text-xs text-muted-foreground">
                Σταθερό αναγνωριστικό για εσωτερική αναφορά — δεν αλλάζει με τη γλώσσα.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="cms-status">Κατάσταση</Label>
            <Select
              value={draft.status}
              onValueChange={(value) =>
                setDraft((current) => ({ ...current, status: value as ContentStatus }))
              }
            >
              <SelectTrigger id="cms-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CONTENT_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Μόνο οι δημοσιευμένες εγγραφές φαίνονται στο site.
            </span>
          </div>

          {isPage ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cms-menu">Εμφάνιση στο μενού</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    id="cms-menu"
                    checked={draft.showInMenu}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, showInMenu: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {draft.showInMenu ? "Ναι" : "Όχι"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cms-order">Σειρά στο μενού</Label>
                <Input
                  id="cms-order"
                  inputMode="numeric"
                  value={draft.menuOrder}
                  placeholder="π.χ. 10"
                  className="tabular-nums"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      menuOrder: event.target.value.replace(/[^0-9-]/g, ""),
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground">Μικρότερος αριθμός, πιο αριστερά.</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cms-published">Ημερομηνία δημοσίευσης</Label>
                <Input
                  id="cms-published"
                  type="datetime-local"
                  value={draft.publishedAt}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, publishedAt: event.target.value }))
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Κενό σημαίνει «τώρα», μόλις δημοσιευτεί.
                </span>
              </div>
              <div className="sm:col-span-2">
                <ImageField
                  label="Εικόνα εξωφύλλου"
                  description="Φαίνεται στη λίστα των νέων και στην κορυφή του άρθρου."
                  value={draft.coverImageUrl}
                  onChange={(url) => setDraft((current) => ({ ...current, coverImageUrl: url }))}
                  disabled={busy}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeLocale} onValueChange={(value) => setActiveLocale(value as Locale)}>
        <TabsList>
          {draft.translations.map((item) => (
            <TabsTrigger key={item.locale} value={item.locale}>
              {LOCALE_LABEL[item.locale]}
              {item.isMachineTranslated && (
                <Badge variant="warning" className="ml-2" title="Μηχανική μετάφραση χωρίς έλεγχο">
                  <Languages aria-hidden />
                  {LOCALE_SHORT[item.locale]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {draft.translations.map((item) => (
          <TabsContent key={item.locale} value={item.locale} className="mt-4 space-y-4">
            <LocaleTab
              entity={entity}
              draftId={draft.id}
              item={item}
              others={draft.translations.filter((other) => other.locale !== item.locale)}
              providerName={providerName}
              busy={busy}
              onTitleChange={(title) => setTitle(item.locale, title)}
              onPatch={(changes) => patch(item.locale, changes)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {!isNew && (
        <p className="text-xs text-muted-foreground">
          Κατάσταση: <StatusBadge status={draft.status} label={CONTENT_STATUS_LABEL[draft.status]} variant={CONTENT_STATUS_VARIANT[draft.status]} /> · Κωδικός{" "}
          <span className="font-mono">{draft.id}</span>
        </p>
      )}
    </div>
  );
}

function LocaleTab({
  entity,
  draftId,
  item,
  others,
  providerName,
  busy,
  onTitleChange,
  onPatch,
}: {
  entity: CmsEntity;
  draftId: string | null;
  item: TranslationDraft;
  others: TranslationDraft[];
  providerName: string | null;
  busy: boolean;
  onTitleChange: (title: string) => void;
  onPatch: (changes: Partial<TranslationDraft>) => void;
}) {
  const isPage = entity === "page";
  const sources = others.filter((other) => other.title.trim().length > 0);

  return (
    <>
      {item.isMachineTranslated && (
        <Alert>
          <Languages aria-hidden />
          <AlertTitle className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Χωρίς έλεγχο</Badge>
            Μηχανική μετάφραση
          </AlertTitle>
          <AlertDescription>
            <span>
              Το περιεχόμενο στα {LOCALE_LABEL[item.locale]} παρήχθη αυτόματα. Διάβασέ το, διόρθωσέ το και
              μετά δήλωσε ότι το έλεγξες — η επισήμανση φεύγει με την αποθήκευση.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={busy}
              onClick={() => onPatch({ isMachineTranslated: false })}
            >
              Το έλεγξα
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Κείμενο ({LOCALE_LABEL[item.locale]})</CardTitle>
          <CardDescription>
            Τίτλος, διεύθυνση και περίληψη για τη γλώσσα αυτή.
            {sources.length > 0 && " Μπορείς να ξεκινήσεις από αυτόματη μετάφραση και να τη διορθώσεις."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sources.length > 0 && (
            <div className="flex flex-wrap items-start gap-2">
              {sources.map((source) => (
                <AutoTranslateButton
                  key={source.locale}
                  entity={entity}
                  id={draftId}
                  from={source.locale}
                  to={item.locale}
                  providerName={providerName}
                  disabled={busy}
                  source={{
                    title: source.title,
                    excerpt: source.excerpt,
                    contentHtml: source.contentHtml,
                    seoTitle: source.seoTitle,
                    seoDescription: source.seoDescription,
                  }}
                  onTranslated={(fields) =>
                    onPatch({
                      title: fields.title,
                      slug: item.slugTouched && item.slug ? item.slug : fields.slug,
                      excerpt: fields.excerpt,
                      seoTitle: fields.seoTitle,
                      seoDescription: fields.seoDescription,
                      contentHtml: fields.contentHtml,
                      contentJson: null,
                      isMachineTranslated: true,
                      epoch: item.epoch + 1,
                    })
                  }
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`title-${item.locale}`}>Τίτλος</Label>
              <Input
                id={`title-${item.locale}`}
                value={item.title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={item.locale === "el" ? "Υποχρεωτικός" : "Προαιρετικός"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`slug-${item.locale}`}>Διεύθυνση (slug)</Label>
              <Input
                id={`slug-${item.locale}`}
                value={item.slug}
                className="font-mono"
                onChange={(event) =>
                  onPatch({ slug: event.target.value.toLowerCase(), slugTouched: true })
                }
              />
              <span className="truncate text-xs text-muted-foreground">
                /{item.locale}/{isPage ? "" : "news/"}
                {item.slug || "…"} — αν είναι πιασμένη, παίρνει κατάληξη -2, -3…
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`excerpt-${item.locale}`}>Περίληψη</Label>
            <Textarea
              id={`excerpt-${item.locale}`}
              value={item.excerpt}
              rows={2}
              onChange={(event) => onPatch({ excerpt: event.target.value })}
              placeholder="Δύο γραμμές που περιγράφουν το περιεχόμενο."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Περιεχόμενο ({LOCALE_LABEL[item.locale]})</CardTitle>
          <CardDescription>
            Επικεφαλίδες, λίστες, σύνδεσμοι, παραθέσεις και εικόνες από τη βιβλιοθήκη πολυμέσων.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CmsRichTextEditor
            key={`${item.locale}-${item.epoch}`}
            initialContent={
              item.contentJson && typeof item.contentJson === "object" && !Array.isArray(item.contentJson)
                ? (item.contentJson as Record<string, unknown>)
                : item.contentHtml
            }
            disabled={busy}
            onChange={(html, json) => onPatch({ contentHtml: html, contentJson: json })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO ({LOCALE_LABEL[item.locale]})</CardTitle>
          <CardDescription>Τι βλέπουν οι μηχανές αναζήτησης και τα μέσα κοινωνικής δικτύωσης.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`seo-title-${item.locale}`}>Τίτλος SEO</Label>
              <Input
                id={`seo-title-${item.locale}`}
                value={item.seoTitle}
                onChange={(event) => onPatch({ seoTitle: event.target.value })}
                placeholder="Κενό σημαίνει «ίδιος με τον τίτλο»."
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`seo-description-${item.locale}`}>Περιγραφή SEO</Label>
              <Textarea
                id={`seo-description-${item.locale}`}
                value={item.seoDescription}
                rows={2}
                onChange={(event) => onPatch({ seoDescription: event.target.value })}
                placeholder="Έως δύο προτάσεις."
              />
            </div>
          </div>

          {isPage && (
            <ImageField
              label="Εικόνα κοινοποίησης (OG)"
              description="Φαίνεται όταν η σελίδα μοιράζεται σε Facebook, LinkedIn ή Viber."
              value={item.ogImageUrl}
              onChange={(url) => onPatch({ ogImageUrl: url })}
              disabled={busy}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
