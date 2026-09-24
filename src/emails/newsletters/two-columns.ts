import { BRAND, MONO_STACK } from "../brand";
import { renderEmail } from "../layout";
import {
  ctaBand,
  displayTitle,
  eyebrowMono,
  hairline,
  richText,
  splitLead,
  splitParagraphs,
  standfirst,
  tariffTable,
  zone,
  type NewsletterRenderer,
} from "./shared";

/**
 * 3. Ζευγάρωμα υπηρεσιών — συντακτική διάταξη.
 *
 * Ρυθμός ζωνών: Cloud (τίτλος + εισαγωγή) → λευκό με τις υπηρεσίες σε σειρές →
 * πίνακας τιμών → navy ταινία δράσης.
 *
 * Όχι δύο πανομοιότυπα γκρι κουτιά: κάθε υπηρεσία είναι μια σειρά με έναν
 * μεγάλο αριθμό σε Courier από τη μία πλευρά και το κείμενο από την άλλη, και
 * η πλευρά εναλλάσσεται. Η ασυμμετρία κρατάει το μάτι σε κίνηση· η λεπτή
 * γραμμή ανάμεσα κρατάει τη σειρά.
 */
export const twoColumnsTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  unsubscribeUrl,
}) => {
  const { lead, rest, rows } = splitLead(contentHtml);
  const items = splitParagraphs(rest);

  /**
   * Η εναλλαγή πλευράς γίνεται με `direction:rtl` στη σειρά και `direction:ltr`
   * στα κελιά: η σειρά του DOM μένει «αριθμός, κείμενο», οπότε όταν οι στήλες
   * πέφτουν η μία κάτω από την άλλη στο κινητό (`mp-stack`), ο αριθμός έρχεται
   * πάντα πρώτος.
   */
  const numberCell = (index: number, flipped: boolean) => `
    <td class="mp-stack" width="108" valign="top" style="width:108px;padding:${
      flipped ? "0 0 0 28px" : "0 28px 0 0"
    };direction:ltr;text-align:left;">
      <p class="mp-index" style="margin:0;font-family:${MONO_STACK};font-size:42px;line-height:42px;font-weight:bold;letter-spacing:-0.04em;color:${BRAND.navy};">
        ${String(index + 1).padStart(2, "0")}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0;">
        <tr><td width="40" bgcolor="${BRAND.red}" style="width:40px;height:3px;line-height:3px;font-size:0;background-color:${BRAND.red};">&nbsp;</td></tr>
      </table>
    </td>`;

  const textCell = (html: string) => `
    <td class="mp-stack" valign="top" style="padding:0;direction:ltr;text-align:left;">
      ${richText(html, { size: 16, lineHeight: 26 })}
    </td>`;

  const gap = `<tr><td colspan="2" class="mp-stack-gap" style="height:2px;line-height:2px;font-size:0;">&nbsp;</td></tr>`;

  const row = (html: string, index: number) => {
    const flipped = index % 2 === 1;
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${
        flipped ? 'dir="rtl" ' : ""
      }style="width:100%;margin:0;${flipped ? "direction:rtl;" : ""}">
        <tr>${numberCell(index, flipped)}${textCell(html)}</tr>
        ${gap}
      </table>
      ${index < items.length - 1 ? hairline("32px 0") : ""}`;
  };

  const body = `
    ${zone(
      `${eyebrowMono("Οι υπηρεσίες μας")}
       ${displayTitle(title, { size: 40, margin: "0 0 20px" })}
       ${standfirst(lead)}`,
      { background: BRAND.cloud, padding: "44px 32px 44px", className: "mp-air" }
    )}

    ${
      items.length > 0
        ? zone(items.map(row).join(""), {
            padding: `48px 32px ${rows.length > 0 ? "20px" : "48px"}`,
          })
        : ""
    }

    ${tariffTable(rows)}

    ${ctaBand(ctaLabel, ctaUrl, "Μία θέση, όλες οι υπηρεσίες.")}`;

  return renderEmail({
    title,
    preheader,
    body,
    unsubscribeUrl,
    showTitle: false,
    bodyPadding: "0",
    bodyRows: true,
    masthead: "Υπηρεσίες",
  });
};
