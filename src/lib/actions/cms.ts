"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type ContentStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify, translateFields, translationProviderName } from "@/lib/translate";
import { routing, type Locale } from "@/i18n/routing";
import type {
  AutoTranslateResult,
  CmsEntity,
  CmsResult,
  JsonLike,
  PageInput,
  PostInput,
  SavedTranslation,
  TranslationInput,
} from "@/components/cms/types";

/**
 * Ενέργειες του CMS: σελίδες και νέα.
 *
 * Κάθε ενέργεια ελέγχει μόνη της τη συνεδρία — δεν εμπιστευόμαστε ότι η σελίδα
 * που την κάλεσε είχε ήδη ελέγξει τον ρόλο.
 */

const EDITOR_ROLES = ["ADMIN", "MANAGER"];

async function requireEditor() {
  const session = await auth();
  if (!session?.user) throw new Error("Χρειάζεται σύνδεση.");
  if (!EDITOR_ROLES.includes(session.user.role)) {
    throw new Error("Δεν έχεις δικαίωμα σε αυτή την ενέργεια.");
  }
  return session.user;
}

function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

function toJsonInput(value: JsonLike): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

/**
 * Μοναδικό slug ανά γλώσσα: αν το ζητούμενο είναι πιασμένο, δοκιμάζουμε
 * `-2`, `-3`… αντί να χαλάσει η αποθήκευση.
 */
async function uniqueSlug(
  entity: CmsEntity,
  locale: Locale,
  desired: string,
  keepTranslationId: string | null,
): Promise<string> {
  const base = slugify(desired) || "selida";
  let candidate = base;

  for (let attempt = 2; attempt < 200; attempt += 1) {
    const taken =
      entity === "page"
        ? await prisma.pageTranslation.findFirst({
            where: { locale, slug: candidate, ...(keepTranslationId ? { NOT: { id: keepTranslationId } } : {}) },
            select: { id: true },
          })
        : await prisma.newsTranslation.findFirst({
            where: { locale, slug: candidate, ...(keepTranslationId ? { NOT: { id: keepTranslationId } } : {}) },
            select: { id: true },
          });

    if (!taken) return candidate;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now()}`;
}

/** Κρατάμε μόνο τις γλώσσες που έχουν πράγματι τίτλο. */
function usableTranslations(translations: TranslationInput[]): TranslationInput[] {
  return translations.filter((item) => isLocale(item.locale) && item.title.trim().length > 0);
}

function validate(translations: TranslationInput[]): string | null {
  if (translations.length === 0) {
    return "Συμπλήρωσε τουλάχιστον τον τίτλο στα ελληνικά.";
  }
  if (!translations.some((item) => item.locale === routing.defaultLocale)) {
    return "Η ελληνική γλώσσα είναι υποχρεωτική — συμπλήρωσε τον τίτλο στην καρτέλα «Ελληνικά».";
  }
  return null;
}

function machineStamp(input: TranslationInput) {
  return {
    isMachineTranslated: input.isMachineTranslated,
    translatedAt: input.isMachineTranslated ? new Date() : null,
  };
}

// ── Σελίδες ────────────────────────────────────────────────────────────────

async function writePageTranslations(pageId: string, translations: TranslationInput[]): Promise<SavedTranslation[]> {
  const existing = await prisma.pageTranslation.findMany({ where: { pageId }, select: { id: true, locale: true } });
  const existingByLocale = new Map(existing.map((row) => [row.locale, row.id]));
  const saved: SavedTranslation[] = [];

  for (const item of translations) {
    const locale = item.locale;
    const currentId = existingByLocale.get(locale) ?? null;
    const slug = await uniqueSlug("page", locale, item.slug || item.title, currentId);

    const data = {
      title: item.title.trim(),
      slug,
      excerpt: clean(item.excerpt),
      contentJson: toJsonInput(item.contentJson),
      contentHtml: clean(item.contentHtml),
      seoTitle: clean(item.seoTitle),
      seoDescription: clean(item.seoDescription),
      ogImageUrl: clean(item.ogImageUrl),
      ...machineStamp(item),
    };

    if (currentId) {
      await prisma.pageTranslation.update({ where: { id: currentId }, data });
    } else {
      await prisma.pageTranslation.create({ data: { ...data, pageId, locale } });
    }
    saved.push({ locale, slug });
  }

  // Γλώσσες που άδειασαν φεύγουν, ώστε να μη μείνουν ορφανές διαδρομές.
  const keep = new Set<string>(translations.map((item) => item.locale));
  const remove = existing.filter((row) => !keep.has(row.locale)).map((row) => row.id);
  if (remove.length > 0) {
    await prisma.pageTranslation.deleteMany({ where: { id: { in: remove } } });
  }

  return saved;
}

function pageRevalidate() {
  revalidatePath("/cms/pages");
}

export async function createPage(input: PageInput): Promise<CmsResult> {
  let user;
  try {
    user = await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const key = input.key.trim();
  if (!key) return { success: false, error: "Συμπλήρωσε το κλειδί της σελίδας." };

  const translations = usableTranslations(input.translations);
  const problem = validate(translations);
  if (problem) return { success: false, error: problem };

  const duplicate = await prisma.page.findUnique({ where: { key }, select: { id: true } });
  if (duplicate) return { success: false, error: `Υπάρχει ήδη σελίδα με κλειδί «${key}».` };

  try {
    const page = await prisma.page.create({
      data: {
        key,
        status: input.status,
        showInMenu: input.showInMenu,
        menuOrder: input.menuOrder,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
        createdById: user.id,
      },
    });

    const saved = await writePageTranslations(page.id, translations);
    pageRevalidate();
    return { success: true, id: page.id, message: "Η σελίδα δημιουργήθηκε.", translations: saved };
  } catch (error) {
    console.error("[CMS] createPage:", error);
    return { success: false, error: "Η σελίδα δεν αποθηκεύτηκε." };
  }
}

export async function updatePage(id: string, input: PageInput): Promise<CmsResult> {
  try {
    await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const key = input.key.trim();
  if (!key) return { success: false, error: "Συμπλήρωσε το κλειδί της σελίδας." };

  const translations = usableTranslations(input.translations);
  const problem = validate(translations);
  if (problem) return { success: false, error: problem };

  const current = await prisma.page.findUnique({ where: { id } });
  if (!current) return { success: false, error: "Η σελίδα δεν βρέθηκε." };

  const duplicate = await prisma.page.findFirst({ where: { key, NOT: { id } }, select: { id: true } });
  if (duplicate) return { success: false, error: `Υπάρχει ήδη άλλη σελίδα με κλειδί «${key}».` };

  try {
    await prisma.page.update({
      where: { id },
      data: {
        key,
        status: input.status,
        showInMenu: input.showInMenu,
        menuOrder: input.menuOrder,
        publishedAt:
          input.status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
      },
    });

    const saved = await writePageTranslations(id, translations);
    pageRevalidate();
    revalidatePath(`/cms/pages/${id}`);
    return { success: true, id, message: "Η σελίδα αποθηκεύτηκε.", translations: saved };
  } catch (error) {
    console.error("[CMS] updatePage:", error);
    return { success: false, error: "Η σελίδα δεν αποθηκεύτηκε." };
  }
}

export async function deletePage(id: string): Promise<CmsResult> {
  try {
    await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  try {
    await prisma.page.delete({ where: { id } });
    pageRevalidate();
    return { success: true, id, message: "Η σελίδα διαγράφηκε.", translations: [] };
  } catch (error) {
    console.error("[CMS] deletePage:", error);
    return { success: false, error: "Η σελίδα δεν διαγράφηκε." };
  }
}

// ── Νέα ────────────────────────────────────────────────────────────────────

async function writeNewsTranslations(postId: string, translations: TranslationInput[]): Promise<SavedTranslation[]> {
  const existing = await prisma.newsTranslation.findMany({ where: { postId }, select: { id: true, locale: true } });
  const existingByLocale = new Map(existing.map((row) => [row.locale, row.id]));
  const saved: SavedTranslation[] = [];

  for (const item of translations) {
    const locale = item.locale;
    const currentId = existingByLocale.get(locale) ?? null;
    const slug = await uniqueSlug("news", locale, item.slug || item.title, currentId);

    const data = {
      title: item.title.trim(),
      slug,
      excerpt: clean(item.excerpt),
      contentJson: toJsonInput(item.contentJson),
      contentHtml: clean(item.contentHtml),
      seoTitle: clean(item.seoTitle),
      seoDescription: clean(item.seoDescription),
      ...machineStamp(item),
    };

    if (currentId) {
      await prisma.newsTranslation.update({ where: { id: currentId }, data });
    } else {
      await prisma.newsTranslation.create({ data: { ...data, postId, locale } });
    }
    saved.push({ locale, slug });
  }

  const keep = new Set<string>(translations.map((item) => item.locale));
  const remove = existing.filter((row) => !keep.has(row.locale)).map((row) => row.id);
  if (remove.length > 0) {
    await prisma.newsTranslation.deleteMany({ where: { id: { in: remove } } });
  }

  return saved;
}

function newsRevalidate() {
  revalidatePath("/cms/news");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createPost(input: PostInput): Promise<CmsResult> {
  let user;
  try {
    user = await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const translations = usableTranslations(input.translations);
  const problem = validate(translations);
  if (problem) return { success: false, error: problem };

  const publishedAt = parseDate(input.publishedAt) ?? (input.status === "PUBLISHED" ? new Date() : null);

  try {
    const post = await prisma.newsPost.create({
      data: {
        status: input.status,
        coverImageUrl: clean(input.coverImageUrl),
        publishedAt,
        createdById: user.id,
      },
    });

    const saved = await writeNewsTranslations(post.id, translations);
    newsRevalidate();
    return { success: true, id: post.id, message: "Το άρθρο δημιουργήθηκε.", translations: saved };
  } catch (error) {
    console.error("[CMS] createPost:", error);
    return { success: false, error: "Το άρθρο δεν αποθηκεύτηκε." };
  }
}

export async function updatePost(id: string, input: PostInput): Promise<CmsResult> {
  try {
    await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const translations = usableTranslations(input.translations);
  const problem = validate(translations);
  if (problem) return { success: false, error: problem };

  const current = await prisma.newsPost.findUnique({ where: { id } });
  if (!current) return { success: false, error: "Το άρθρο δεν βρέθηκε." };

  const publishedAt =
    parseDate(input.publishedAt) ??
    (input.status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt);

  try {
    await prisma.newsPost.update({
      where: { id },
      data: {
        status: input.status,
        coverImageUrl: clean(input.coverImageUrl),
        publishedAt,
      },
    });

    const saved = await writeNewsTranslations(id, translations);
    newsRevalidate();
    revalidatePath(`/cms/news/${id}`);
    return { success: true, id, message: "Το άρθρο αποθηκεύτηκε.", translations: saved };
  } catch (error) {
    console.error("[CMS] updatePost:", error);
    return { success: false, error: "Το άρθρο δεν αποθηκεύτηκε." };
  }
}

export async function deletePost(id: string): Promise<CmsResult> {
  try {
    await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  try {
    await prisma.newsPost.delete({ where: { id } });
    newsRevalidate();
    return { success: true, id, message: "Το άρθρο διαγράφηκε.", translations: [] };
  } catch (error) {
    console.error("[CMS] deletePost:", error);
    return { success: false, error: "Το άρθρο δεν διαγράφηκε." };
  }
}

// ── Δημοσίευση ─────────────────────────────────────────────────────────────

/** Δημοσίευση ή απόσυρση, χωρίς να ανοίξει ο χρήστης τον επεξεργαστή. */
export async function setPublished({
  entity,
  id,
  published,
}: {
  entity: CmsEntity;
  id: string;
  published: boolean;
}): Promise<CmsResult> {
  try {
    await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  const status: ContentStatus = published ? "PUBLISHED" : "DRAFT";

  try {
    if (entity === "page") {
      const current = await prisma.page.findUnique({ where: { id }, select: { publishedAt: true } });
      if (!current) return { success: false, error: "Η σελίδα δεν βρέθηκε." };
      await prisma.page.update({
        where: { id },
        data: { status, publishedAt: published ? (current.publishedAt ?? new Date()) : current.publishedAt },
      });
      pageRevalidate();
    } else {
      const current = await prisma.newsPost.findUnique({ where: { id }, select: { publishedAt: true } });
      if (!current) return { success: false, error: "Το άρθρο δεν βρέθηκε." };
      await prisma.newsPost.update({
        where: { id },
        data: { status, publishedAt: published ? (current.publishedAt ?? new Date()) : current.publishedAt },
      });
      newsRevalidate();
    }

    return {
      success: true,
      id,
      message: published ? "Δημοσιεύτηκε." : "Αποσύρθηκε από το site.",
      translations: [],
    };
  } catch (error) {
    console.error("[CMS] setPublished:", error);
    return { success: false, error: "Η κατάσταση δεν άλλαξε." };
  }
}

// ── Αυτόματη μετάφραση ─────────────────────────────────────────────────────

/**
 * Μεταφράζει το περιεχόμενο μιας γλώσσας σε μία άλλη και το επιστρέφει στον
 * επεξεργαστή — δεν αποθηκεύει τίποτα. Ο συντάκτης βλέπει το αποτέλεσμα,
 * το ελέγχει και μετά πατά «Αποθήκευση».
 *
 * Το `source` επιτρέπει μετάφραση ακόμη και σε προσχέδιο που δεν έχει σωθεί.
 */
export async function autoTranslate({
  entity,
  id,
  from,
  to,
  source,
}: {
  entity: CmsEntity;
  id: string | null;
  from: Locale;
  to: Locale;
  source?: {
    title: string;
    excerpt: string;
    contentHtml: string;
    seoTitle: string;
    seoDescription: string;
  };
}): Promise<AutoTranslateResult> {
  try {
    await requireEditor();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Σφάλμα" };
  }

  if (!translationProviderName()) {
    return { success: false, error: "Δεν έχει ρυθμιστεί υπηρεσία αυτόματης μετάφρασης." };
  }
  if (from === to) {
    return { success: false, error: "Η γλώσσα προέλευσης και ο προορισμός είναι ίδιοι." };
  }

  let origin = source;

  if (!origin && id) {
    const row =
      entity === "page"
        ? await prisma.pageTranslation.findFirst({ where: { pageId: id, locale: from } })
        : await prisma.newsTranslation.findFirst({ where: { postId: id, locale: from } });

    if (!row) return { success: false, error: "Δεν υπάρχει περιεχόμενο στη γλώσσα προέλευσης." };

    origin = {
      title: row.title,
      excerpt: row.excerpt ?? "",
      contentHtml: row.contentHtml ?? "",
      seoTitle: row.seoTitle ?? "",
      seoDescription: row.seoDescription ?? "",
    };
  }

  if (!origin || !origin.title.trim()) {
    return { success: false, error: "Δεν υπάρχει περιεχόμενο στη γλώσσα προέλευσης." };
  }

  const result = await translateFields(origin, from, to);
  if (!result.success) return { success: false, error: result.error };

  return {
    success: true,
    fields: {
      title: result.fields.title,
      slug: slugify(result.fields.title),
      excerpt: result.fields.excerpt ?? "",
      contentHtml: result.fields.contentHtml ?? "",
      seoTitle: result.fields.seoTitle ?? "",
      seoDescription: result.fields.seoDescription ?? "",
    },
  };
}
