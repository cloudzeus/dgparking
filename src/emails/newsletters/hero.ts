import { BRAND, FONT_STACK, MONO_STACK } from "../brand";
import { renderEmail } from "../layout";
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

/**
 * 2. Hero με φωτογραφία — εξώφυλλο τεύχους.
 *
 * Ρυθμός ζωνών: εικόνα από άκρη σε άκρη (κολλητά στην κόκκινη γραμμή του
 * masthead) → Cloud ταινία με τον τίτλο → λευκό κείμενο → πίνακας τιμών →
 * navy ταινία δράσης.
 *
 * Κείμενο πάνω στην εικόνα δεν μπαίνει: το `background-image` δεν αποδίδεται
 * σε Outlook και οι εικόνες μπλοκάρονται συχνά. Όταν λείπει η εικόνα, τη θέση
 * της παίρνει μπλε πεδίο με τον τίτλο — ποτέ σπασμένο κουτί εικόνας.
 */
export const heroTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  heroImageUrl,
  unsubscribeUrl,
}) => {
  const { lead, rest, rows } = splitLead(contentHtml);
  const hasImage = Boolean(heroImageUrl?.trim());

  // Με εικόνα: φωτογραφία → Cloud τίτλος.
  // Χωρίς εικόνα: μπλε πεδίο με τον τίτλο → Cloud εισαγωγή. Και στις δύο
  // περιπτώσεις ο τίτλος λέγεται μία φορά και υπάρχουν τρεις ζώνες.
  const opening = hasImage
    ? `${fullBleedImageRow(heroImageUrl!.trim(), title)}
       ${zone(
         `${eyebrowMono("Το θέμα του μήνα")}
          ${displayTitle(title, { size: 42, margin: "0 0 20px" })}
          ${standfirst(lead)}`,
         { background: BRAND.cloud, padding: "40px 32px 44px", className: "mp-air" }
       )}`
    : `${zone(
        `${eyebrowMono("Το θέμα του μήνα", "#E8657F")}
         ${displayTitle(title, { size: 42, color: BRAND.white, margin: "0 0 24px" })}
         ${redRule(72, "0")}`,
        { background: BRAND.navy, padding: "64px 32px 68px", className: "mp-air" }
      )}
      ${
        lead
          ? zone(standfirst(lead), {
              background: BRAND.cloud,
              padding: "36px 32px 40px",
            })
          : ""
      }`;

  const body = `
    ${opening}

    ${
      rest
        ? zone(richText(rest, { size: 17, lineHeight: 29 }), {
            padding: `44px 32px ${rows.length > 0 ? "12px" : "44px"}`,
          })
        : ""
    }

    ${tariffTable(rows)}

    ${ctaBand(ctaLabel, ctaUrl, "Δείτε τον χώρο και κλείστε τη θέση σας.")}

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
      { padding: "28px 32px 36px" }
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
