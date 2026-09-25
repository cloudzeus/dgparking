import { BRAND, FONT_STACK, MONO_STACK } from "../brand";
import { escapeHtml } from "../layout";

/**
 * Κοινά εργαλεία για τα πρότυπα ενημερωτικού δελτίου.
 *
 * Κάθε πρότυπο παίρνει ΤΑ ΙΔΙΑ στοιχεία και τα διατάσσει αλλιώς — έτσι ο
 * συντάκτης αλλάζει διάταξη χωρίς να ξαναγράψει το κείμενο.
 */

export type NewsletterTemplateInput = {
  /** Τίτλος στη μπλε κεφαλίδα και στο <title>. */
  title: string;
  /** Το κείμενο προεπισκόπησης του inbox. */
  preheader: string;
  /** Το HTML του επεξεργαστή. Οι ενότητες χωρίζονται με οριζόντια γραμμή (`<hr>`). */
  contentHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  heroImageUrl?: string;
  /**
   * Μία εικόνα ανά ενότητα, στη σειρά που εμφανίζονται.
   *
   * Κενό στοιχείο σημαίνει «αυτή η ενότητα χωρίς εικόνα» — έτσι μπορεί να
   * εικονογραφηθεί η τρίτη χωρίς να χρειάζεται εικόνα η πρώτη.
   */
  featureImageUrls?: (string | null)[];
  /** Υποχρεωτικός σε κάθε ενημερωτικό δελτίο (GDPR / CAN-SPAM). */
  unsubscribeUrl: string;
};

export type NewsletterRenderer = (input: NewsletterTemplateInput) => string;

/**
 * Χωρίζει το περιεχόμενο σε ενότητες στα `<hr>` του επεξεργαστή.
 * Τα πρότυπα με στήλες/κάρτες χτίζονται πάνω σε αυτές τις ενότητες.
 */
export function splitBlocks(html: string): string[] {
  return html
    .split(/<hr\s*\/?>(?:\s*)/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "<p></p>");
}

/** Η πρώτη «καθαρή» πρόταση μιας ενότητας — για τίτλους καρτών. */
export function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Απλό κείμενο για το `text` μέρος του email. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|li|div|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Εικόνα πλήρους πλάτους — πάντα `width:100%;height:auto` για τα κινητά.
 * Το `alt` δεν είναι προαιρετικό στην πράξη: οι μισοί παραλήπτες βλέπουν
 * πρώτα αυτό και μετά (ή ποτέ) την εικόνα.
 */
export function fullWidthImage(url: string, alt = "", width = 536): string {
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="${width}"
    style="display:block;width:100%;max-width:100%;height:auto;border:0;" />`;
}

/** Μικρή ετικέτα ενότητας (eyebrow) στο κόκκινο της μάρκας. */
export function eyebrow(text: string): string {
  return `<p style="margin:0 0 8px;font-family:${FONT_STACK};font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;color:${BRAND.red};">${escapeHtml(
    text,
  )}</p>`;
}

/** Τίτλος ενότητας μέσα στο σώμα. */
export function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 12px;font-family:${FONT_STACK};font-size:20px;line-height:26px;font-weight:bold;color:${BRAND.navy};">${escapeHtml(
    text,
  )}</h2>`;
}

/** Λεπτή γραμμή διαχωρισμού, ίδια σε όλα τα πρότυπα. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="height:1px;line-height:1px;font-size:0;background-color:${BRAND.cloud};">&nbsp;</td></tr>
  </table>`;
}

export type RichTextOptions = {
  size?: number;
  lineHeight?: number;
  color?: string;
  /** Χρώμα επικεφαλίδων μέσα στο κείμενο. */
  headingColor?: string;
  /** Χρώμα συνδέσμων — κόκκινο της μάρκας από προεπιλογή. */
  linkColor?: string;
  mono?: boolean;
  align?: "left" | "center";
};

/**
 * Το HTML του επεξεργαστή, με ρητά inline styles σε κάθε ετικέτα.
 *
 * Γιατί όχι σκέτη κληρονομικότητα: το Outlook (μηχανή του Word) δίνει δικά
 * του περιθώρια στα `<p>` και αγνοεί το `line-height` του γονέα. Ό,τι δεν
 * γραφτεί inline, δεν υπάρχει. Ετικέτες που έχουν ήδη `style` μένουν ως έχουν.
 */
export function styleRichText(html: string, options: RichTextOptions = {}): string {
  const {
    size = 16,
    lineHeight = 26,
    color = BRAND.ink,
    headingColor = BRAND.navy,
    linkColor = BRAND.red,
    mono = false,
    align = "left",
  } = options;
  const stack = mono ? MONO_STACK : FONT_STACK;
  const base = `font-family:${stack};font-size:${size}px;line-height:${lineHeight}px;color:${color};${
    align === "center" ? "text-align:center;" : ""
  }`;

  const inject = (input: string, tag: string, style: string) =>
    input.replace(new RegExp(`<${tag}(?![a-z0-9])(?![^>]*style=)([^>]*)>`, "gi"), `<${tag}$1 style="${style}">`);

  let out = html;
  out = inject(out, "p", `margin:0 0 ${Math.round(lineHeight * 0.7)}px;${base}`);
  out = inject(out, "div", base);
  out = inject(
    out,
    "h1",
    `margin:32px 0 12px;font-family:${stack};font-size:${size + 10}px;line-height:${size + 16}px;font-weight:bold;letter-spacing:-0.01em;color:${headingColor};`,
  );
  out = inject(
    out,
    "h2",
    `margin:32px 0 10px;font-family:${stack};font-size:${size + 6}px;line-height:${size + 12}px;font-weight:bold;letter-spacing:-0.01em;color:${headingColor};`,
  );
  out = inject(
    out,
    "h3",
    `margin:24px 0 8px;font-family:${stack};font-size:${size + 2}px;line-height:${size + 8}px;font-weight:bold;color:${headingColor};`,
  );
  out = inject(out, "ul", `margin:0 0 ${Math.round(lineHeight * 0.7)}px;padding-left:20px;${base}`);
  out = inject(out, "ol", `margin:0 0 ${Math.round(lineHeight * 0.7)}px;padding-left:22px;${base}`);
  out = inject(out, "li", `margin:0 0 6px;${base}`);
  out = inject(out, "a", `color:${linkColor};text-decoration:underline;`);
  out = inject(out, "strong", `font-weight:bold;color:${color};`);
  out = inject(out, "blockquote", `margin:24px 0;padding:0 0 0 20px;border-left:3px solid ${BRAND.red};${base}`);
  return out;
}

/**
 * Το περιεχόμενο του επεξεργαστή μέσα σε δοχείο με τη γραμματοσειρά της
 * μάρκας. Η κλάση `mp-ink` το γυρίζει σε ανοιχτό κείμενο στο σκοτεινό θέμα.
 */
export function contentBox(html: string, mono = false): string {
  return richText(html, { mono, size: mono ? 14 : 16, lineHeight: mono ? 22 : 26 });
}

/** Κείμενο σώματος: δοχείο + inline styles σε κάθε ετικέτα. */
export function richText(html: string, options: RichTextOptions = {}): string {
  const { size = 16, lineHeight = 26, color = BRAND.ink, mono = false, align = "left" } = options;
  return `<div class="${color === BRAND.white ? "mp-on-navy" : "mp-ink"}" style="font-family:${
    mono ? MONO_STACK : FONT_STACK
  };font-size:${size}px;line-height:${lineHeight}px;color:${color};${
    align === "center" ? "text-align:center;" : ""
  }">${styleRichText(html, options)}</div>`;
}

/** Οριζόντιο κενό ανάσας. Η τυπογραφία χρειάζεται χαρτί γύρω της. */
export function spacer(height: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr></table>`;
}

/** Η κόκκινη γραμμή ως τυπογραφικό σημείο — όχι διακόσμηση, στίξη. */
export function redRule(width = 64, margin = "0 0 28px"): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${margin};"><tr><td width="${width}" bgcolor="${BRAND.red}" style="width:${width}px;height:3px;line-height:3px;font-size:0;background-color:${BRAND.red};">&nbsp;</td></tr></table>`;
}

/** Λεπτή γκρι γραμμή ανάμεσα σε ενότητες. */
export function hairline(margin = "32px 0"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${margin};"><tr><td class="mp-hair" style="height:1px;line-height:1px;font-size:0;background-color:#DCDCE2;">&nbsp;</td></tr></table>`;
}

/** Ετικέτα ενότητας σε monospace με αραιά γράμματα. */
export function kicker(text: string, color: string = BRAND.red, margin = "0 0 20px"): string {
  return `<p style="margin:${margin};font-family:${MONO_STACK};font-size:12px;line-height:16px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:${color};">${escapeHtml(
    text,
  )}</p>`;
}

export type DisplayOptions = {
  size?: number;
  color?: string;
  margin?: string;
  align?: "left" | "center";
  /** `mp-display` = 30 px στο κινητό· `mp-display-sm` = 26 px. */
  className?: string;
};

/** Ο εκφωνητικός τίτλος: μεγάλος, σφιχτός, με αρνητικό letter-spacing. */
export function displayTitle(text: string, options: DisplayOptions = {}): string {
  const {
    size = 44,
    color = BRAND.navy,
    margin = "0 0 24px",
    align = "left",
    className = "mp-display",
  } = options;
  return `<h1 class="${className}" style="margin:${margin};font-family:${FONT_STACK};font-size:${size}px;line-height:${Math.round(
    size * 1.06,
  )}px;font-weight:bold;letter-spacing:-0.02em;text-align:${align};color:${color};">${escapeHtml(text)}</h1>`;
}

/** Full-bleed μπλε πεδίο — η φωνή της μάρκας όταν μιλάει δυνατά. */
export function navyPanel(inner: string, padding = "48px 32px", align: "left" | "center" = "left"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.navy}" style="background-color:${BRAND.navy};">
    <tr><td class="mp-pad" align="${align}" style="padding:${padding};background-color:${BRAND.navy};">${inner}</td></tr>
  </table>`;
}

/** Κελί με τα περιθώρια της σελίδας — για full-bleed σώματα (`bodyPadding:"0"`). */
export function padded(inner: string, padding = "48px 32px", background: string = BRAND.white): string {
  // `mp-ink`: βλ. σχόλιο στη `zone()` — η επιφάνεια που σκουραίνει πρέπει
  // να ανοίγει και το κείμενό της.
  const cls =
    background === BRAND.white ? "mp-pad mp-card mp-ink" : "mp-pad mp-cloud mp-ink";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${background}" style="background-color:${background};">
    <tr><td class="${cls}" style="padding:${padding};background-color:${background};">${inner}</td></tr>
  </table>`;
}

/** Κουμπί δράσης — εμφανίζεται μόνο όταν ο συντάκτης έδωσε και τα δύο πεδία. */
export function maybeCta(
  label: string | undefined,
  url: string | undefined,
  render: (label: string, url: string) => string,
): string {
  if (!label?.trim() || !url?.trim()) return "";
  return render(label.trim(), url.trim());
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Εργαλεία σύνθεσης «σε ζώνες».
 *
 * Το email διαβάζεται σαν έντυπο μόνο όταν εναλλάσσονται επιφάνειες: Cloud για
 * τον τίτλο, λευκό για το κείμενο, navy για τη δράση. Χωρίς αυτό, όσο καλή κι
 * αν είναι η τυπογραφία, το αποτέλεσμα μοιάζει με έγγραφο.
 * ───────────────────────────────────────────────────────────────────────────── */

/** Μικρή ετικέτα σε monospace με αραιά γράμματα — η «κορδέλα» του εντύπου. */
export function eyebrowMono(text: string, color: string = BRAND.red): string {
  // `mp-accent`: χωρίς αυτό, ο κανόνας `.mp-ink p` του σκοτεινού θέματος θα
  // έκανε γκρι και το κόκκινο της μάρκας. Κρατά ένα ανοιχτότερο κόκκινο, που
  // διαβάζεται πάνω στο σκούρο φόντο.
  return `<p class="mp-accent" style="margin:0 0 16px;font-family:${MONO_STACK};font-size:11px;line-height:16px;letter-spacing:0.2em;text-transform:uppercase;color:${color};">${escapeHtml(
    text
  )}</p>`;
}

/** Εισαγωγική παράγραφος: μεγαλύτερη και πιο ανοιχτή από το σώμα. */
export function standfirst(html: string): string {
  const text = html.trim();
  if (!text) return "";
  return `<div class="mp-muted" style="font-family:${FONT_STACK};font-size:19px;line-height:30px;color:${BRAND.steel};">${styleRichText(
    text,
    { size: 19, lineHeight: 30, color: BRAND.steel }
  )}</div>`;
}

/**
 * Ζώνη χρώματος πλήρους πλάτους — μία `<tr>` γραμμή του κελύφους.
 *
 * Τα πρότυπα του δελτίου χτίζονται από τέτοιες γραμμές (`bodyRows:true`),
 * ώστε το φόντο να πιάνει όλο το πλάτος του email και όχι μόνο το εσωτερικό
 * ενός ένθετου πίνακα. Πάντα `bgcolor` ΚΑΙ inline `background-color`: το
 * Outlook αγνοεί άλλοτε το ένα και άλλοτε το άλλο.
 */
export function zone(
  inner: string,
  options: {
    background?: string;
    padding?: string;
    align?: "left" | "center";
    /** Επιπλέον κλάσεις — π.χ. `mp-air` για περισσότερο αέρα στο κινητό. */
    className?: string;
  } = {}
): string {
  const {
    background = BRAND.white,
    padding = "40px 32px",
    align = "left",
    className = "",
  } = options;
  // ΣΚΟΤΕΙΝΟ ΘΕΜΑ: όποια επιφάνεια σκουραίνει, ΠΡΕΠΕΙ να ανοίγει και το
  // κείμενό της. Το `mp-cloud` γινόταν #22222E ενώ ο τίτλος έμενε στο inline
  // σκούρο μπλε — σκούρο σε σκούρο, δηλαδή αόρατο. Οι ίδιοι οι τίτλοι δεν
  // μπορούν να το λύσουν: τα inline χρώματα δεν αλλάζουν με media query, γι'
  // αυτό η διόρθωση ανήκει στο περιβάλλον.
  const theme =
    background === BRAND.white ? "mp-card" : background === BRAND.cloud ? "mp-cloud" : "";
  const cls = ["mp-pad", theme, theme ? "mp-ink" : "", className].filter(Boolean).join(" ");
  return `
    <tr>
      <td class="${cls}" align="${align}" bgcolor="${background}" style="padding:${padding};background-color:${background};">
        ${inner}
      </td>
    </tr>`;
}

/** Εικόνα από άκρη σε άκρη ως δική της γραμμή — χωρίς κενό γύρω της. */
export function fullBleedImageRow(url: string, alt: string): string {
  return `
    <tr>
      <td bgcolor="${BRAND.navy}" style="font-size:0;line-height:0;background-color:${BRAND.navy};">
        ${fullWidthImage(url, alt, 600)}
      </td>
    </tr>`;
}

/**
 * Πίνακας τιμών: ετικέτα αριστερά, ποσό δεξιά σε monospace, εναλλαγή φόντου.
 * Τα ποσά στοιχίζονται κάθετα — αυτό είναι που κάνει έναν τιμοκατάλογο να
 * δείχνει τιμοκατάλογος και όχι λίστα με παύλες.
 */
export function tariffTable(
  rows: { label: string; value: string }[],
  options: {
    /** Μπλε κεφαλίδα δύο στηλών, π.χ. `["ΥΠΗΡΕΣΙΑ", "ΤΙΜΗ"]`. */
    header?: [string, string];
    padding?: string;
    /** Φόντο της ζώνης γύρω από τον πίνακα. */
    background?: string;
  } = {}
): string {
  if (rows.length === 0) return "";
  const { header, padding = "24px 32px 36px", background = BRAND.white } = options;
  const body = rows
    .map((row, i) => {
      const zebra = i % 2 === 1;
      return `
        <tr>
          <td class="mp-ink" bgcolor="${zebra ? BRAND.cloud : BRAND.white}" style="padding:15px 20px;background-color:${
            zebra ? BRAND.cloud : BRAND.white
          };border-bottom:1px solid ${BRAND.cloud};font-family:${FONT_STACK};font-size:16px;line-height:22px;color:${BRAND.ink};">
            ${escapeHtml(row.label)}
          </td>
          <td align="right" bgcolor="${zebra ? BRAND.cloud : BRAND.white}" style="padding:15px 20px;background-color:${
            zebra ? BRAND.cloud : BRAND.white
          };border-bottom:1px solid ${BRAND.cloud};font-family:${MONO_STACK};font-size:17px;line-height:22px;font-weight:bold;white-space:nowrap;color:${BRAND.navy};">
            ${escapeHtml(row.value)}
          </td>
        </tr>`;
    })
    .join("");

  const headerRow = header
    ? `<tr>
          <td bgcolor="${BRAND.navy}" style="padding:13px 20px;background-color:${BRAND.navy};font-family:${MONO_STACK};font-size:11px;line-height:16px;font-weight:bold;letter-spacing:0.18em;color:${BRAND.white};">
            ${escapeHtml(header[0])}
          </td>
          <td align="right" bgcolor="${BRAND.navy}" style="padding:13px 20px;background-color:${BRAND.navy};font-family:${MONO_STACK};font-size:11px;line-height:16px;font-weight:bold;letter-spacing:0.18em;text-align:right;color:${BRAND.white};">
            ${escapeHtml(header[1])}
          </td>
        </tr>`
    : "";

  return zone(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;${
      header ? "" : `border-top:2px solid ${BRAND.navy};`
    }">
          ${headerRow}
          ${body}
        </table>`,
    { background, padding }
  );
}

/**
 * Ζώνη δράσης: navy ταινία πλήρους πλάτους με ένα μεγάλο κόκκινο κουμπί.
 * Το κουμπί δεν αιωρείται μέσα στο λευκό — έχει δικό του χώρο και βάρος.
 */
export function ctaBand(
  label: string | undefined,
  url: string | undefined,
  caption?: string,
  options: {
    /** Το φόντο της ταινίας — navy από προεπιλογή, κόκκινο στις προσφορές. */
    background?: string;
    /** Το φόντο του κουμπιού — κόκκινο πάνω σε navy, λευκό πάνω σε κόκκινο. */
    buttonBackground?: string;
    buttonColor?: string;
    captionColor?: string;
    padding?: string;
  } = {}
): string {
  if (!label || !url) return "";
  const {
    background = BRAND.navy,
    buttonBackground = BRAND.red,
    buttonColor = BRAND.white,
    captionColor = "rgba(255,255,255,0.82)",
    padding = "44px 32px 48px",
  } = options;
  return `
    <tr>
      <td class="mp-pad" bgcolor="${background}" style="padding:${padding};background-color:${background};" align="center">
        ${
          caption
            ? `<p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:17px;line-height:26px;color:${captionColor};">${escapeHtml(
                caption
              )}</p>`
            : ""
        }
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td align="center" bgcolor="${buttonBackground}" style="border-radius:4px;background-color:${buttonBackground};">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                href="${escapeHtml(url)}" style="height:56px;v-text-anchor:middle;width:300px;" arcsize="7%" stroke="f" fillcolor="${buttonBackground}">
                <w:anchorlock/>
                <center style="color:${buttonColor};font-family:${FONT_STACK};font-size:17px;font-weight:bold;">${escapeHtml(
                  label
                )}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${escapeHtml(url)}"
                 style="display:block;padding:18px 44px;font-family:${FONT_STACK};font-size:17px;line-height:22px;font-weight:bold;letter-spacing:0.01em;color:${buttonColor};text-decoration:none;">
                ${escapeHtml(label)}
              </a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Χωρίζει το περιεχόμενο σε: πρώτη παράγραφο (standfirst), υπόλοιπο κείμενο,
 * και γραμμές «ετικέτα — ποσό» που γίνονται πίνακας τιμών.
 *
 * Ο συντάκτης γράφει φυσικά («Ωριαία στάθμευση — 5 €») και το πρότυπο
 * αναγνωρίζει τη δομή, αντί να του ζητάμε να μάθει σήμανση.
 */
/**
 * Χωρίζει το HTML σε επιμέρους μπλοκ επιπέδου (παράγραφοι, επικεφαλίδες,
 * λίστες). Το `splitBlocks` κόβει μόνο στα `<hr>`, που δεν αρκεί για να
 * αναγνωρίσουμε ποια γραμμή είναι τιμή και ποια κείμενο.
 */
export function splitParagraphs(html: string): string[] {
  return html
    .replace(/<hr\s*\/?>/gi, "")
    .split(/(?<=<\/(?:p|h[1-6]|ul|ol|blockquote)>)/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && stripTags(part).trim().length > 0);
}

export function splitLead(html: string): {
  lead: string;
  rest: string;
  rows: { label: string; value: string }[];
} {
  const blocks = splitParagraphs(html);
  const rows: { label: string; value: string }[] = [];
  const prose: string[] = [];

  // «Κάτι — 12 €» ή «Κάτι: 12,50€» στο τέλος της γραμμής.
  const priceLine = /^(.{2,60}?)\s*[—–:-]\s*([€$]?\s*[\d.,]+\s*[€$]?)$/;

  for (const block of blocks) {
    const text = stripTags(block).replace(/\s+/g, " ").trim();
    const m = text.match(priceLine);
    if (m && /[€$\d]/.test(m[2])) {
      rows.push({ label: m[1].trim(), value: m[2].replace(/\s+/g, " ").trim() });
    } else if (text) {
      prose.push(block);
    }
  }

  const lead = prose.length > 0 ? prose[0] : "";
  const rest = prose.slice(1).join("\n");
  return { lead, rest, rows };
}
