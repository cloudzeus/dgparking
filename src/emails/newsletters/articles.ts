import { BRAND, MONO_STACK } from "../brand";
import { renderEmail } from "../layout";
import {
  ctaBand,
  displayTitle,
  eyebrowMono,
  fullBleedImageRow,
  richText,
  splitLead,
  splitParagraphs,
  standfirst,
  tariffTable,
  zone,
  type NewsletterRenderer,
} from "./shared";

/**
 * 5. Ευρετήριο — σαν σελίδα περιεχομένων τεύχους.
 *
 * Ρυθμός ζωνών: Cloud (τίτλος τεύχους + εισαγωγή) → εικόνα → λευκό ευρετήριο →
 * πίνακας τιμών, αν υπάρχουν → navy ταινία δράσης.
 *
 * Καμία κάρτα, κανένα γκρι κουτί: αριθμός σε κόκκινο Courier, λεπτή γραμμή,
 * κείμενο με άνετο διάστιχο. Ό,τι κρατάει ένα περιοδικό ευανάγνωστο σε δύο
 * δευτερόλεπτα.
 */
export const articlesTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  heroImageUrl,
  unsubscribeUrl,
}) => {
  const { lead, rest, rows } = splitLead(contentHtml);
  const items = splitParagraphs(rest);

  /** Μία καταχώριση: κόκκινο νούμερο αριστερά, κείμενο δεξιά, λεπτή γραμμή. */
  const entry = (html: string, index: number) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td class="mp-stack" width="72" valign="top" style="width:72px;padding:0 20px 0 0;">
          <p class="mp-index" style="margin:0;font-family:${MONO_STACK};font-size:32px;line-height:32px;font-weight:bold;letter-spacing:-0.04em;color:${BRAND.red};">
            ${String(index + 1).padStart(2, "0")}
          </p>
        </td>
        <td class="mp-stack" valign="top" style="padding:0;">
          ${richText(html, { size: 17, lineHeight: 29 })}
        </td>
      </tr>
      <tr><td colspan="2" class="mp-stack-gap" style="height:2px;line-height:2px;font-size:0;">&nbsp;</td></tr>
    </table>
    ${
      index < items.length - 1
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:26px 0;"><tr><td class="mp-hair" style="height:1px;line-height:1px;font-size:0;background-color:#DCDCE2;">&nbsp;</td></tr></table>`
        : ""
    }`;

  const body = `
    ${zone(
      `${eyebrowMono("Τεύχος · Τα νέα μας")}
       ${displayTitle(title, { size: 42, margin: "0 0 20px" })}
       ${standfirst(lead)}
       <p class="mp-muted" style="margin:24px 0 0;font-family:${MONO_STACK};font-size:11px;line-height:18px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.steel};">
         ${items.length} ${items.length === 1 ? "θέμα" : "θέματα"} σε αυτή την αποστολή
       </p>`,
      { background: BRAND.cloud, padding: "44px 32px 44px", className: "mp-air" }
    )}

    ${heroImageUrl?.trim() ? fullBleedImageRow(heroImageUrl.trim(), title) : ""}

    ${
      items.length > 0
        ? zone(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;border-top:2px solid ${BRAND.navy};"><tr><td style="height:0;line-height:0;font-size:0;">&nbsp;</td></tr></table>
             ${items.map(entry).join("")}`,
            { padding: `44px 32px ${rows.length > 0 ? "16px" : "48px"}` }
          )
        : ""
    }

    ${tariffTable(rows)}

    ${ctaBand(ctaLabel, ctaUrl, "Όλα τα θέματα και στη σελίδα μας.")}`;

  return renderEmail({
    title,
    preheader,
    body,
    unsubscribeUrl,
    showTitle: false,
    bodyPadding: "0",
    bodyRows: true,
    masthead: "Τεύχος",
  });
};
