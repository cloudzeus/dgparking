import { BRAND, FONT_STACK, MONO_STACK } from "../brand";
import { renderEmail } from "../layout";
import {
  fullBleedImageRow,
  redRule,
  richText,
  splitBlocks,
  zone,
  type NewsletterRenderer,
} from "./shared";

/**
 * 8. Spotlight — παρουσίαση νέας υπηρεσίας.
 *
 * ΓΙΑΤΙ ΑΛΛΟ ΠΡΟΤΥΠΟ
 * Τα υπόλοιπα πρότυπα λένε μια είδηση. Αυτό παρουσιάζει κάτι που ο
 * παραλήπτης δεν έχει δει ποτέ, οπότε πρέπει πρώτα να τον σταματήσει και
 * μετά να εξηγήσει. Η λογική είναι «υπερβολικός μινιμαλισμός»: τεράστια
 * τυπογραφία, σκληρές αντιθέσεις, άφθονο κενό, ΕΝΑ χρώμα τόνου.
 *
 * ΡΥΘΜΟΣ ΖΩΝΩΝ
 * navy πεδίο με τεράστιο τίτλο → φωτογραφία από άκρη σε άκρη → εισαγωγή →
 * αριθμημένες λειτουργίες με πελώρια νούμερα → κόκκινη ταινία ανακοίνωσης →
 * κλείσιμο. Καμία ζώνη δεν μοιάζει με τη διπλανή της.
 *
 * ΓΙΑΤΙ ΠΙΝΑΚΕΣ ΚΑΙ ΟΧΙ ΜΟΝΤΕΡΝΟ CSS
 * Το Outlook αγνοεί flexbox, grid, border-radius σε πίνακες και background
 * images. Ό,τι εντυπωσιακό υπάρχει εδώ γίνεται με χρώμα, μέγεθος και κενό —
 * τα μόνα εργαλεία που αποδίδονται παντού ίδια.
 */

/** Το «σκληρό» πλαίσιο του Bauhaus: συμπαγές χρώμα, μηδέν στρογγυλότητα. */
function hardBlock(inner: string, background: string, padding = "44px 32px"): string {
  return `
    <tr>
      <td class="mp-pad" bgcolor="${background}" style="padding:${padding};background-color:${background};">
        ${inner}
      </td>
    </tr>`;
}

/**
 * Μια λειτουργία, με πελώριο αριθμό αριστερά.
 *
 * Ο αριθμός είναι ο ρυθμός της σελίδας: ο αναγνώστης καταλαβαίνει με μια
 * ματιά ότι υπάρχουν τέσσερα πράγματα και πού βρίσκεται. Στο κινητό οι δύο
 * στήλες γίνονται μία (`mp-stack`), με τον αριθμό από πάνω.
 */
function featureRow(index: number, html: string, last: boolean): string {
  const blocks = splitBlocks(html);
  const heading = blocks[0] ?? "";
  const body = blocks.slice(1).join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="top" width="92" class="mp-stack" style="width:92px;padding:0 20px 0 0;">
          <div class="mp-figure" style="font-family:${MONO_STACK};font-size:52px;line-height:52px;font-weight:bold;letter-spacing:-0.04em;color:${BRAND.red};">
            ${String(index).padStart(2, "0")}
          </div>
        </td>
        <td valign="top" class="mp-stack mp-ink" style="font-family:${FONT_STACK};color:${BRAND.ink};">
          <h3 class="mp-display-sm" style="margin:0 0 8px;font-family:${FONT_STACK};font-size:21px;line-height:26px;font-weight:bold;letter-spacing:-0.01em;color:${BRAND.navy};">
            ${heading.replace(/<\/?(h[1-6]|p|strong)[^>]*>/g, "")}
          </h3>
          ${richText(body, { size: 15, lineHeight: 25 })}
        </td>
      </tr>
    </table>
    ${
      last
        ? ""
        : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
             <tr><td class="mp-hair" height="1" style="height:1px;line-height:1px;font-size:0;background-color:${BRAND.cloud};">&nbsp;</td></tr>
           </table>
           <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>`
    }`;
}

export const spotlightTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  heroImageUrl,
  unsubscribeUrl,
}) => {
  // Ο ΔΙΑΧΩΡΙΣΜΟΣ ΓΙΝΕΤΑΙ ΠΡΩΤΟΣ, πάνω στο ακατέργαστο κείμενο: η `splitLead`
  // περνά από τη `splitParagraphs`, που ΑΦΑΙΡΕΙ τα `<hr>` — αν καλούνταν
  // πρώτη, οι τομές είχαν ήδη χαθεί και όλο το δελτίο κατέρρεε σε μία ζώνη.
  //
  // Σύμβαση συντάκτη: πρώτο κομμάτι = εισαγωγή, ενδιάμεσα = οι λειτουργίες,
  // τελευταίο = η ανακοίνωση που κλείνει.
  const chunks = splitBlocks(contentHtml);
  const lead = chunks.length > 0 ? chunks[0] : "";
  const features = chunks.length > 2 ? chunks.slice(1, -1) : chunks.slice(1);
  const closing = chunks.length > 2 ? chunks[chunks.length - 1] : "";

  const body = `
    ${hardBlock(
      `<p class="mp-accent" style="margin:0 0 22px;font-family:${MONO_STACK};font-size:11px;line-height:16px;letter-spacing:0.28em;text-transform:uppercase;color:#E8657F;">
         Νέο · Πύλη πελατών
       </p>
       <h1 class="mp-display" style="margin:0 0 26px;font-family:${FONT_STACK};font-size:52px;line-height:53px;font-weight:bold;letter-spacing:-0.035em;color:${BRAND.white};">
         ${title}
       </h1>
       ${redRule(96, "0")}`,
      BRAND.navy,
      "64px 32px 68px"
    )}

    ${heroImageUrl?.trim() ? fullBleedImageRow(heroImageUrl.trim(), title) : ""}

    ${
      lead
        ? zone(
            `<div class="mp-ink" style="font-family:${FONT_STACK};font-size:21px;line-height:33px;color:${BRAND.ink};">
               ${richText(lead, { size: 21, lineHeight: 33, color: BRAND.ink })}
             </div>`,
            { background: BRAND.cloud, padding: "44px 32px 48px", className: "mp-air" }
          )
        : ""
    }

    ${
      features.length > 0
        ? zone(
            `<p class="mp-accent" style="margin:0 0 30px;font-family:${MONO_STACK};font-size:11px;line-height:16px;letter-spacing:0.28em;text-transform:uppercase;color:${BRAND.red};">
               Τι θα μπορείτε να κάνετε
             </p>
             ${features
               .map((f, i) => featureRow(i + 1, f, i === features.length - 1))
               .join("")}`,
            { padding: "48px 32px 52px", className: "mp-air" }
          )
        : ""
    }

    ${
      closing
        ? hardBlock(
            `<p style="margin:0 0 14px;font-family:${MONO_STACK};font-size:11px;line-height:16px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,255,255,0.72);">
               Τι ακολουθεί
             </p>
             <div style="font-family:${FONT_STACK};font-size:19px;line-height:30px;color:${BRAND.white};">
               ${richText(closing, { size: 19, lineHeight: 30, color: BRAND.white })}
             </div>`,
            BRAND.red,
            "44px 32px 48px"
          )
        : ""
    }

    ${
      ctaLabel && ctaUrl
        ? zone(
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
               <tr>
                 <td bgcolor="${BRAND.navy}" style="background-color:${BRAND.navy};">
                   <a href="${ctaUrl}" style="display:inline-block;padding:16px 34px;font-family:${FONT_STACK};font-size:15px;font-weight:bold;letter-spacing:0.02em;color:${BRAND.white};text-decoration:none;">
                     ${ctaLabel}
                   </a>
                 </td>
               </tr>
             </table>`,
            { background: BRAND.white, padding: "40px 32px 44px" }
          )
        : ""
    }

    ${zone(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td valign="top" width="108" class="mp-stack" style="width:108px;padding:0 16px 0 0;font-family:${MONO_STACK};font-size:11px;line-height:18px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.steel};">
             Απορίες
           </td>
           <td valign="top" class="mp-stack mp-ink" style="font-family:${FONT_STACK};font-size:15px;line-height:24px;color:${BRAND.ink};">
             Απαντήστε σε αυτό το μήνυμα ή τηλεφωνήστε μας — απαντάμε την ίδια μέρα.
           </td>
         </tr>
       </table>`,
      { background: BRAND.cloud, padding: "28px 32px 34px" }
    )}`;

  return renderEmail({
    title,
    preheader,
    body,
    unsubscribeUrl,
    showTitle: false,
    bodyPadding: "0",
    bodyRows: true,
    masthead: "Ενημερωτικό δελτίο",
  });
};
