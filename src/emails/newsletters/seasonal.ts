import { BRAND, COMPANY, FONT_STACK, MONO_STACK } from "../brand";
import { button, renderEmail } from "../layout";
import {
  displayTitle,
  fullBleedImageRow,
  kicker,
  maybeCta,
  richText,
  splitLead,
  tariffTable,
  zone,
  type NewsletterRenderer,
} from "./shared";

/**
 * 7. Εποχιακή / γιορτινή — η ήσυχη σύνθεση.
 *
 * Ρυθμός ζωνών: ένα μεγάλο navy πεδίο με την ευχή κεντραρισμένη → λευκό με τις
 * τιμές, αν υπάρχουν → Cloud ταινία υπογραφής.
 *
 * Μία κοντή κόκκινη γραμμή είναι το μόνο στολίδι. Καμία γιρλάντα, κανένα
 * emoji: το γιορτινό το κάνει το κενό γύρω από τις λέξεις.
 */
export const seasonalTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  heroImageUrl,
  unsubscribeUrl,
}) => {
  const { lead, rest, rows } = splitLead(contentHtml);
  const message = [lead, rest].filter(Boolean).join("\n");

  // Η δράση μένει μέσα στο μπλε πεδίο: μία ήσυχη σύνθεση δεν χρειάζεται
  // δεύτερη ταινία για ένα κουμπί.
  const cta = maybeCta(ctaLabel, ctaUrl, (label, url) =>
    button(label, url, { margin: "0", align: "center" })
  );

  const field = zone(
    `${kicker(COMPANY.city, "#A9B1D0", "0 0 24px")}
     ${displayTitle(title, { size: 42, color: BRAND.white, margin: "0 0 28px", align: "center" })}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px;">
       <tr><td width="48" bgcolor="${BRAND.red}" style="width:48px;height:3px;line-height:3px;font-size:0;background-color:${BRAND.red};">&nbsp;</td></tr>
     </table>
     <div style="max-width:440px;margin:0 auto;">
       ${richText(message, {
         size: 17,
         lineHeight: 30,
         color: "#E4E7F2",
         headingColor: BRAND.white,
         linkColor: BRAND.white,
         align: "center",
       })}
     </div>
     ${
       cta
         ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:38px auto 0;"><tr><td align="center">${cta}</td></tr></table>`
         : ""
     }`,
    {
      background: BRAND.navy,
      padding: "68px 40px 72px",
      align: "center",
      className: "mp-air",
    }
  );

  const body = `
    ${field}

    ${heroImageUrl?.trim() ? fullBleedImageRow(heroImageUrl.trim(), title) : ""}

    ${tariffTable(rows, { padding: "40px 32px 40px" })}

    <!-- Υπογραφή: ήσυχη ταινία Cloud, χωρίς κουμπιά και χωρίς εικόνες. -->
    ${zone(
      `<p class="mp-navy-ink" style="margin:0 0 8px;text-align:center;font-family:${FONT_STACK};font-size:16px;line-height:24px;font-weight:bold;letter-spacing:-0.01em;color:${BRAND.navy};">
         Με εκτίμηση, η ομάδα της ${COMPANY.name}
       </p>
       <p class="mp-muted" style="margin:0;text-align:center;font-family:${MONO_STACK};font-size:11px;line-height:18px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND.steel};">
         ${COMPANY.hours[0]}
       </p>`,
      { background: BRAND.cloud, padding: "40px 32px 44px", align: "center" }
    )}`;

  return renderEmail({
    title,
    preheader,
    body,
    unsubscribeUrl,
    showTitle: false,
    bodyPadding: "0",
    bodyRows: true,
    masthead: "Ευχές",
  });
};
