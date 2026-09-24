import { announcementTemplate } from "./announcement";
import { articlesTemplate } from "./articles";
import { heroTemplate } from "./hero";
import { offerTemplate } from "./offer";
import { priceListTemplate } from "./price-list";
import { seasonalTemplate } from "./seasonal";
import { twoColumnsTemplate } from "./two-columns";
import { htmlToText, type NewsletterRenderer, type NewsletterTemplateInput } from "./shared";

export type { NewsletterTemplateInput, NewsletterRenderer } from "./shared";
export { htmlToText, splitBlocks, stripTags } from "./shared";

export type NewsletterTemplateId =
  | "announcement"
  | "hero"
  | "two-columns"
  | "offer"
  | "articles"
  | "price-list"
  | "seasonal";

export type NewsletterTemplateMeta = {
  id: NewsletterTemplateId;
  /** Ελληνική ετικέτα για τον επιλογέα προτύπου. */
  label: string;
  /** Μία πρόταση: πότε το διαλέγεις. */
  description: string;
  /** Χρησιμοποιεί εικόνα hero; Ο επιλογέας κρύβει το πεδίο όταν δεν χρειάζεται. */
  usesHero: boolean;
  /** Χρησιμοποιεί τις ενότητες (`<hr>`) ως ξεχωριστά κουτιά; */
  usesBlocks: boolean;
  render: NewsletterRenderer;
};

/**
 * Τα διαθέσιμα πρότυπα ενημερωτικού δελτίου. Όλα χτισμένα πάνω στο
 * `renderEmail` — ίδια κεφαλίδα, ίδιο υποσέλιδο, ίδιος σύνδεσμος διαγραφής.
 */
export const NEWSLETTER_TEMPLATES: Record<NewsletterTemplateId, NewsletterTemplateMeta> = {
  announcement: {
    id: "announcement",
    label: "Απλή ανακοίνωση",
    description: "Ένας τεράστιος τίτλος, κόκκινη γραμμή, ένα κουμπί. Όταν μετράει μόνο η δήλωση.",
    usesHero: false,
    usesBlocks: false,
    render: announcementTemplate,
  },
  hero: {
    id: "hero",
    label: "Hero με φωτογραφία",
    description: "Φωτογραφία από άκρη σε άκρη και γκρι ταινία με τον τίτλο από κάτω. Χωρίς εικόνα, μπλε πεδίο.",
    usesHero: true,
    usesBlocks: false,
    render: heroTemplate,
  },
  "two-columns": {
    id: "two-columns",
    label: "Δύο στήλες υπηρεσιών",
    description: "Κάθε υπηρεσία με μεγάλο αριθμό, εναλλάξ αριστερά–δεξιά. Στο κινητό μία στήλη.",
    usesHero: false,
    usesBlocks: true,
    render: twoColumnsTemplate,
  },
  offer: {
    id: "offer",
    label: "Προσφορά με μεγάλο CTA",
    description: "Η τιμή ως ήρωας: τεράστιο νούμερο σε Courier και κόκκινη ταινία δράσης πλήρους πλάτους.",
    usesHero: true,
    usesBlocks: false,
    render: offerTemplate,
  },
  articles: {
    id: "articles",
    label: "Λίστα άρθρων / νέων",
    description: "Αριθμημένο ευρετήριο με λεπτές γραμμές, σαν σελίδα περιεχομένων περιοδικού.",
    usesHero: true,
    usesBlocks: true,
    render: articlesTemplate,
  },
  "price-list": {
    id: "price-list",
    label: "Τιμοκατάλογος",
    description: "Πίνακας με μπλε κεφαλίδα και τιμές δεξιά στοιχισμένες σε monospace.",
    usesHero: false,
    usesBlocks: true,
    render: priceListTemplate,
  },
  seasonal: {
    id: "seasonal",
    label: "Εποχιακή / γιορτινή",
    description: "Μπλε πεδίο, κεντραρισμένη ευχή, μία κοντή κόκκινη γραμμή. Ήσυχη και ζεστή.",
    usesHero: true,
    usesBlocks: false,
    render: seasonalTemplate,
  },
};

export const NEWSLETTER_TEMPLATE_LIST: NewsletterTemplateMeta[] = Object.values(NEWSLETTER_TEMPLATES);

export function isNewsletterTemplateId(value: string): value is NewsletterTemplateId {
  return Object.prototype.hasOwnProperty.call(NEWSLETTER_TEMPLATES, value);
}

export function newsletterTemplateLabel(id: string): string {
  return isNewsletterTemplateId(id) ? NEWSLETTER_TEMPLATES[id].label : id;
}

/** Το τελικό HTML ενός δελτίου. Άγνωστο πρότυπο → απλή ανακοίνωση. */
export function renderNewsletter(
  templateId: string,
  input: NewsletterTemplateInput,
): string {
  const template = isNewsletterTemplateId(templateId)
    ? NEWSLETTER_TEMPLATES[templateId]
    : NEWSLETTER_TEMPLATES.announcement;
  return template.render(input);
}

/** Το `text` μέρος — κάθε email πρέπει να έχει και εκδοχή χωρίς HTML. */
export function renderNewsletterText(input: NewsletterTemplateInput): string {
  const lines = [input.title, "", htmlToText(input.contentHtml)];
  if (input.ctaLabel && input.ctaUrl) lines.push("", `${input.ctaLabel}: ${input.ctaUrl}`);
  lines.push("", `Διαγραφή από το ενημερωτικό δελτίο: ${input.unsubscribeUrl}`);
  return lines.join("\n");
}
