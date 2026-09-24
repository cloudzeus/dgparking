/**
 * Καθαρισμός HTML από τον επεξεργαστή του CMS, πριν φτάσει στο δημόσιο site.
 *
 * Το `contentHtml` γράφεται από τη διαχείριση, άρα δεν είναι έμπιστο: ένας
 * λογαριασμός που θα έγραφε `<script>` θα εκτελούσε κώδικα σε κάθε επισκέπτη.
 * Δουλεύουμε με λευκή λίστα — ό,τι δεν αναγνωρίζεται ρητά, φεύγει — και χωρίς
 * εξωτερική βιβλιοθήκη, ώστε ο κανόνας να διαβάζεται εδώ και μόνο εδώ.
 *
 * Τρέχει αποκλειστικά στον διακομιστή (server components), πριν το
 * `dangerouslySetInnerHTML`.
 */

/** Ετικέτες που επιτρέπονται, με τα γνωρίσματα που κρατούν. */
const ALLOWED_TAGS: Record<string, readonly string[]> = {
  p: [],
  h2: [],
  h3: [],
  h4: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  ul: [],
  ol: ["start"],
  li: [],
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  blockquote: ["cite"],
  br: [],
  hr: [],
  figure: [],
  figcaption: [],
  table: [],
  thead: [],
  tbody: [],
  tfoot: [],
  caption: [],
  tr: [],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  code: [],
  pre: [],
};

/** Ετικέτες χωρίς περιεχόμενο — δεν μπαίνουν στη στοίβα. */
const VOID_TAGS = new Set(["br", "hr", "img"]);

/**
 * Ετικέτες που φεύγουν μαζί με ό,τι περιέχουν. Το `<script>` είναι το προφανές·
 * το `<style>` και το `<svg>` μπορούν επίσης να φέρουν εκτελέσιμο περιεχόμενο,
 * και το `<iframe>` ανοίγει ξένη σελίδα μέσα στη δική μας.
 */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "noscript",
  "template",
  "svg",
  "math",
  "form",
  "input",
  "button",
  "select",
  "option",
  "textarea",
  "link",
  "meta",
  "base",
  "head",
  "title",
  "audio",
  "video",
  "source",
  "canvas",
]);

/** Μόνο αυτή η μορφή `style` περνά — η στοίχιση που ορίζει ο συντάκτης. */
const SAFE_STYLE = /^text-align:\s*(left|right|center|justify);?$/i;
const STYLE_TAGS = new Set(["p", "h2", "h3", "h4", "figcaption", "td", "th"]);

/** Γνωρίσματα που κουβαλούν διεύθυνση και θέλουν έλεγχο πρωτοκόλλου. */
const URL_ATTRS = new Set(["href", "src", "cite"]);

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g;
const ATTR_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function escapeText(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Δεκτές διευθύνσεις: σχετικές, `http(s)`, `mailto`, `tel` και — μόνο για
 * εικόνες — ενσωματωμένα raster data URI. Τα κενά και οι χαρακτήρες ελέγχου
 * αφαιρούνται πρώτα, γιατί το `java\nscript:` είναι έγκυρο για τον browser.
 */
function isSafeUrl(raw: string, tag: string): boolean {
  const value = raw.replace(/[\u0000- \u007f]/g, "").toLowerCase();
  if (value === "") return false;
  if (/^(#|\/|\.\/|\.\.\/)/.test(value)) return true;
  if (/^(https?:|mailto:|tel:)/.test(value)) return true;
  if (tag === "img" && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/.test(value)) return true;
  // Χωρίς διωνυμία `σχήμα:` θεωρείται σχετική διαδρομή.
  return !/^[a-z][a-z0-9+.-]*:/.test(value);
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED_TAGS[tag];
  const kept: string[] = [];
  let hasTarget = false;

  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    // Κάθε `on*` είναι κώδικας που τρέχει στον επισκέπτη.
    if (name.startsWith("on")) continue;

    if (name === "style") {
      if (STYLE_TAGS.has(tag) && SAFE_STYLE.test(value.trim())) {
        kept.push(`style="${escapeAttr(value.trim())}"`);
      }
      continue;
    }

    if (!allowed.includes(name)) continue;
    if (URL_ATTRS.has(name) && !isSafeUrl(value, tag)) continue;
    if (name === "target") {
      hasTarget = true;
      kept.push(`target="${escapeAttr(value === "_blank" ? "_blank" : "_self")}"`);
      continue;
    }
    if (name === "rel") continue; // το γράφουμε εμείς παρακάτω

    kept.push(`${name}="${escapeAttr(value)}"`);
  }

  // Σύνδεσμος που ανοίγει νέα καρτέλα δεν δανείζει τη σελίδα μας στον προορισμό.
  if (tag === "a" && hasTarget) kept.push('rel="noopener noreferrer"');

  return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

/**
 * Επιστρέφει HTML που περιέχει μόνο τις επιτρεπόμενες ετικέτες και γνωρίσματα,
 * με κλεισμένες όλες τις ετικέτες που άνοιξαν.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";

  // Σχόλια, CDATA, doctype και οδηγίες επεξεργασίας μπορούν να κρύψουν ετικέτες.
  const html = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "")
    .replace(/<![^>]*>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "");

  let out = "";
  const open: string[] = [];
  let skipTag: string | null = null;
  let skipDepth = 0;
  let cursor = 0;

  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(html)) !== null) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    const isClosing = raw.startsWith("</");
    const isSelfClosing = /\/>$/.test(raw);

    if (skipTag === null) out += escapeText(html.slice(cursor, match.index));
    cursor = match.index + raw.length;

    if (skipTag !== null) {
      if (tag === skipTag) {
        if (isClosing) {
          skipDepth -= 1;
          if (skipDepth <= 0) skipTag = null;
        } else if (!isSelfClosing) {
          skipDepth += 1;
        }
      }
      continue;
    }

    if (DROP_WITH_CONTENT.has(tag)) {
      if (!isClosing && !isSelfClosing) {
        skipTag = tag;
        skipDepth = 1;
      }
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_TAGS, tag)) continue;

    if (isClosing) {
      const index = open.lastIndexOf(tag);
      if (index === -1) continue;
      while (open.length > index) out += `</${open.pop()}>`;
      continue;
    }

    const attrs = sanitizeAttributes(tag, match[2] ?? "");
    if (VOID_TAGS.has(tag)) {
      out += `<${tag}${attrs} />`;
    } else {
      out += `<${tag}${attrs}>`;
      open.push(tag);
    }
  }

  if (skipTag === null) out += escapeText(html.slice(cursor));
  while (open.length > 0) out += `</${open.pop()}>`;

  return out;
}

/** Το κείμενο χωρίς ετικέτες — για μέτρημα λέξεων και για περιλήψεις. */
export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Εκτίμηση χρόνου ανάγνωσης σε λεπτά (≈200 λέξεις το λεπτό, ποτέ κάτω από 1). */
export function estimateReadingMinutes(input: string | null | undefined): number {
  const words = htmlToPlainText(input).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
