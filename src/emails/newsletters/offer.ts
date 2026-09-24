import { BRAND, FONT_STACK, MONO_STACK } from "../brand";
import { escapeHtml, renderEmail } from "../layout";
import {
  ctaBand,
  displayTitle,
  eyebrowMono,
  fullBleedImageRow,
  redRule,
  richText,
  splitLead,
  standfirst,
  tariffTable,
  zone,
  type NewsletterRenderer,
} from "./shared";

/** Βρίσκει ένα ποσό μέσα σε κείμενο: «45 €», «€45», «45,50€». */
const PRICE_RE = /(€\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?€)/;

/**
 * 4. Προσφορά — η τιμή ως ήρωας.
 *
 * Ρυθμός ζωνών: Cloud με το τεράστιο νούμερο → λευκό με τους όρους →
 * πίνακας με τις υπόλοιπες τιμές → κόκκινη ταινία δράσης πλήρους πλάτους.
 *
 * Η πρώτη γραμμή τιμής γίνεται το νούμερο-ήρωας και η ετικέτα της η λεζάντα
 * από κάτω· οι υπόλοιπες μένουν στον πίνακα, ώστε η τιμή να μη λέγεται δύο
 * φορές.
 */
export const offerTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  heroImageUrl,
  unsubscribeUrl,
}) => {
  const { lead, rest, rows } = splitLead(contentHtml);

  const heroRow = rows[0];
  const tariffRows = rows.slice(1);
  const fallback = heroRow ? null : stripPrice(contentHtml);
  const figure = heroRow?.value ?? fallback;
  const caption = heroRow?.label ?? title;

  const figureBlock = figure
    ? // Ο τίτλος πρώτος: δίνει το νόημα. Το νούμερο μετά: δίνει το χτύπημα.
      // Χωρίς αυτόν ο αναγνώστης βλέπει μια τιμή και δεν ξέρει για τι πράγμα.
      `${eyebrowMono("Προσφορά")}
       ${displayTitle(title, { size: 30, margin: "0 0 26px" })}
       <p class="mp-figure" style="margin:0;font-family:${MONO_STACK};font-size:80px;line-height:80px;font-weight:bold;letter-spacing:-0.04em;color:${BRAND.navy};">
         ${escapeHtml(figure)}
       </p>
       <p class="mp-navy-ink" style="margin:18px 0 0;font-family:${FONT_STACK};font-size:20px;line-height:28px;font-weight:bold;letter-spacing:-0.01em;color:${BRAND.navy};">
         ${escapeHtml(caption)}
       </p>
       <div style="margin:26px 0 0;">${redRule(88, "0")}</div>`
    : `${eyebrowMono("Προσφορά")}
       ${displayTitle(title, { size: 40, margin: "0 0 24px" })}
       ${redRule(88, "0")}`;

  const body = `
    ${zone(figureBlock, {
      background: BRAND.cloud,
      padding: "52px 32px 48px",
      className: "mp-air",
    })}

    ${heroImageUrl?.trim() ? fullBleedImageRow(heroImageUrl.trim(), title) : ""}

    ${
      lead || rest
        ? zone(
            `${standfirst(lead)}
             ${
               rest
                 ? `<div style="margin:${lead ? "26px" : "0"} 0 0;">${richText(rest, {
                     size: 17,
                     lineHeight: 29,
                   })}</div>`
                 : ""
             }`,
            { padding: `44px 32px ${tariffRows.length > 0 ? "12px" : "44px"}` }
          )
        : ""
    }

    ${tariffTable(tariffRows)}

    <!-- Η δράση σε κόκκινη ταινία πλήρους πλάτους: λευκό κουμπί πάνω της. -->
    ${ctaBand(ctaLabel, ctaUrl, "Η προσφορά ισχύει μέχρι εξαντλήσεως των θέσεων.", {
      background: BRAND.red,
      buttonBackground: BRAND.white,
      buttonColor: BRAND.red,
      captionColor: "rgba(255,255,255,0.9)",
    })}

    ${zone(
      `<p class="mp-muted" style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:19px;color:${BRAND.steel};">
         Οι τιμές περιλαμβάνουν ΦΠΑ. Δεν συνδυάζεται με άλλη προσφορά.
       </p>`,
      { background: BRAND.cloud, padding: "28px 32px 32px" }
    )}`;

  return renderEmail({
    title,
    preheader,
    body,
    unsubscribeUrl,
    showTitle: false,
    bodyPadding: "0",
    bodyRows: true,
    masthead: "Προσφορά",
  });
};

/** Τελευταία διέξοδος: ψάχνει ένα ποσό οπουδήποτε μέσα στο κείμενο. */
function stripPrice(html: string): string | null {
  const match = html.replace(/<[^>]*>/g, " ").match(PRICE_RE);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}
