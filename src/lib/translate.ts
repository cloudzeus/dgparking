import { routing, type Locale } from "@/i18n/routing";

/**
 * Αυτόματη μετάφραση περιεχομένου (σελίδες, νέα, δελτία).
 *
 * Χρησιμοποιεί το DeepSeek, που είναι ήδη ρυθμισμένο στο `.env`. Η μετάφραση
 * είναι ΠΡΟΣΧΕΔΙΟ: ό,τι παράγεται εδώ σημειώνεται `isMachineTranslated` και
 * περιμένει ανθρώπινο έλεγχο πριν δημοσιευτεί.
 *
 * Το HTML μεταφράζεται ως HTML — ζητάμε ρητά να μείνουν ανέπαφες οι ετικέτες,
 * τα `href`, τα `src` και οι κλάσεις, αλλιώς θα γύριζε σπασμένη δομή.
 */

/**
 * Ο πάροχος είναι όποιος μιλά OpenAI-συμβατά (DeepSeek, OpenAI, κ.ά.).
 * Προτεραιότητα: ρητές μεταβλητές TRANSLATE_*, μετά DeepSeek, μετά OpenAI.
 */
function provider(): { url: string; key: string; model: string; name: string } | null {
  if (process.env.TRANSLATE_API_KEY) {
    return {
      url: (process.env.TRANSLATE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
      key: process.env.TRANSLATE_API_KEY,
      model: process.env.TRANSLATE_MODEL || "gpt-4o-mini",
      name: "TRANSLATE_*",
    };
  }
  if (process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEKKEY) {
    return {
      url: (process.env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_API_URL || "https://api.deepseek.com")
        .replace(/\/+$/, ""),
      key: (process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEKKEY)!,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      name: "DeepSeek",
    };
  }
  if (process.env.OPENAI_API_KEY || process.env.OPENAIKEY) {
    return {
      url: "https://api.openai.com/v1",
      key: (process.env.OPENAI_API_KEY || process.env.OPENAIKEY)!,
      model: process.env.TRANSLATE_MODEL || "gpt-4o-mini",
      name: "OpenAI",
    };
  }
  return null;
}

/** Για τη διεπαφή: υπάρχει ρυθμισμένος πάροχος; */
export function translationProviderName(): string | null {
  return provider()?.name ?? null;
}

const LOCALE_NAMES: Record<Locale, string> = {
  el: "Greek (Ελληνικά)",
  en: "English",
  it: "Italian (Italiano)",
};

/** Ο τόνος της μάρκας — ώστε οι μεταφράσεις να μη βγαίνουν άχρωμες. */
const STYLE_GUIDE = `
Voice: a Greek parking company in Piraeus writing to its customers.
- Warm, direct, concrete. No marketing fluff, no exclamation marks.
- Greek uses the formal plural (πληθυντικός ευγενείας): «Συνδεθείτε», «τα στοιχεία σας».
- Keep brand names as they are: MEGA Parking, Πειραιάς/Piraeus, SoftOne.
- Keep prices, dates, times, phone numbers and addresses exactly as given.
- Never translate text inside HTML attributes, URLs, or code.
`.trim();

export type TranslateResult =
  | { success: true; text: string }
  | { success: false; error: string };

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(messages: ChatMessage[]): Promise<TranslateResult> {
  const p = provider();
  if (!p) {
    return {
      success: false,
      error:
        "Δεν έχει ρυθμιστεί υπηρεσία μετάφρασης. Όρισε TRANSLATE_API_KEY (και προαιρετικά TRANSLATE_BASE_URL, TRANSLATE_MODEL) ή έγκυρο DEEPSEEK_API_KEY.",
    };
  }

  try {
    const res = await fetch(`${p.url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: p.model,
        messages,
        // Χαμηλή θερμοκρασία: θέλουμε πιστή μετάφραση, όχι εκδοχές.
        temperature: 0.2,
        stream: false,
      }),
      cache: "no-store",
    });

    const raw = await res.text();

    if (!res.ok) {
      let detail = raw;
      try {
        detail = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? raw;
      } catch {
        // κρατάμε το raw
      }
      const hint = res.status === 401 ? ` (το κλειδί του παρόχου ${p.name} απορρίφθηκε)` : "";
      return { success: false, error: `Η υπηρεσία μετάφρασης απάντησε ${res.status}: ${detail}${hint}` };
    }

    const data = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) return { success: false, error: "Η υπηρεσία μετάφρασης δεν επέστρεψε κείμενο." };
    return { success: true, text };
  } catch (error) {
    console.error("[TRANSLATE] Request failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Άγνωστο σφάλμα" };
  }
}

/** Μετάφραση απλού κειμένου (τίτλος, περίληψη, SEO περιγραφή). */
export async function translateText(
  text: string,
  from: Locale,
  to: Locale
): Promise<TranslateResult> {
  if (!text.trim()) return { success: true, text: "" };

  return chat([
    {
      role: "system",
      content: `You are a professional translator from ${LOCALE_NAMES[from]} to ${LOCALE_NAMES[to]}.\n${STYLE_GUIDE}\nReturn ONLY the translation. No preamble, no quotes, no explanation.`,
    },
    { role: "user", content: text },
  ]);
}

/** Μετάφραση HTML — η δομή μένει ίδια, αλλάζει μόνο το κείμενο. */
export async function translateHtml(
  html: string,
  from: Locale,
  to: Locale
): Promise<TranslateResult> {
  if (!html.trim()) return { success: true, text: "" };

  return chat([
    {
      role: "system",
      content: `You are a professional translator from ${LOCALE_NAMES[from]} to ${LOCALE_NAMES[to]} working on HTML content.\n${STYLE_GUIDE}\n\nRules for HTML:\n- Translate ONLY the visible text between tags, and the values of alt and title attributes.\n- Keep every tag, attribute, href, src, class and id byte-for-byte identical.\n- Do not add, remove or reorder elements. Do not wrap the result in a code fence.\nReturn ONLY the translated HTML.`,
    },
    { role: "user", content: html },
  ]);
}

/**
 * Μεταφράζει όλα τα πεδία μιας μετάφρασης σελίδας/άρθρου με μία κλήση ανά πεδίο.
 * Το `slug` παράγεται από τον μεταφρασμένο τίτλο, δεν μεταφράζεται ως κείμενο.
 */
export type TranslatableFields = {
  title: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export async function translateFields(
  fields: TranslatableFields,
  from: Locale,
  to: Locale
): Promise<{ success: true; fields: TranslatableFields } | { success: false; error: string }> {
  const [title, excerpt, contentHtml, seoTitle, seoDescription] = await Promise.all([
    translateText(fields.title, from, to),
    translateText(fields.excerpt ?? "", from, to),
    translateHtml(fields.contentHtml ?? "", from, to),
    translateText(fields.seoTitle ?? "", from, to),
    translateText(fields.seoDescription ?? "", from, to),
  ]);

  const failed = [title, excerpt, contentHtml, seoTitle, seoDescription].find((r) => !r.success);
  if (failed && !failed.success) return { success: false, error: failed.error };

  return {
    success: true,
    fields: {
      title: title.success ? title.text : fields.title,
      excerpt: excerpt.success ? excerpt.text : null,
      contentHtml: contentHtml.success ? contentHtml.text : null,
      seoTitle: seoTitle.success ? seoTitle.text : null,
      seoDescription: seoDescription.success ? seoDescription.text : null,
    },
  };
}

/**
 * Slug από τίτλο: λατινικοί χαρακτήρες, παύλες, χωρίς τόνους.
 * Τα ελληνικά μεταγράφονται, ώστε οι διευθύνσεις να είναι αναγνώσιμες παντού.
 */
const GREEK_MAP: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // τόνοι και διαλυτικά
    .split("")
    .map((ch) => GREEK_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const TRANSLATABLE_LOCALES = routing.locales;
