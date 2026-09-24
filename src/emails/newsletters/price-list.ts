import { BRAND, FONT_STACK } from "../brand";
import { renderEmail } from "../layout";
import {
  ctaBand,
  displayTitle,
  eyebrowMono,
  richText,
  splitLead,
  standfirst,
  tariffTable,
  zone,
  type NewsletterRenderer,
} from "./shared";

/**
 * 6. Τιμοκατάλογος — ο πίνακας είναι το θέμα.
 *
 * Ρυθμός ζωνών: Cloud (τίτλος + εισαγωγή) → ο πίνακας με μπλε κεφαλίδα
 * (ΥΠΗΡΕΣΙΑ / ΤΙΜΗ) → λευκό με τους όρους → navy ταινία δράσης.
 *
 * Τα ποσά δεξιά στοιχισμένα σε Courier ώστε τα ψηφία να πέφτουν σε κολόνα και
 * να συγκρίνονται με τη ματιά. Η υπηρεσία σε Arial γιατί είναι κείμενο· η τιμή
 * σε monospace γιατί είναι δεδομένο.
 */
export const priceListTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  unsubscribeUrl,
}) => {
  const { lead, rest, rows } = splitLead(contentHtml);

  const body = `
    ${zone(
      `${eyebrowMono("Τιμοκατάλογος")}
       ${displayTitle(title, { size: 40, margin: "0 0 20px" })}
       ${standfirst(lead)}`,
      { background: BRAND.cloud, padding: "44px 32px 44px", className: "mp-air" }
    )}

    <!-- Το κυρίως θέμα: ο πίνακας, με μπλε κεφαλίδα δύο στηλών. -->
    ${tariffTable(rows, {
      header: ["ΥΠΗΡΕΣΙΑ", "ΤΙΜΗ"],
      padding: "40px 32px 16px",
    })}

    ${zone(
      `${rest ? richText(rest, { size: 16, lineHeight: 27 }) : ""}
       <p class="mp-muted" style="margin:${rest ? "22px" : "0"} 0 0;font-family:${FONT_STACK};font-size:12px;line-height:19px;color:${BRAND.steel};">
         Οι τιμές περιλαμβάνουν ΦΠΑ και ισχύουν έως νεότερη ενημέρωση.
       </p>`,
      { padding: `${rows.length > 0 ? "12px" : "40px"} 32px 40px` }
    )}

    ${ctaBand(ctaLabel, ctaUrl, "Κλείστε θέση με την τιμή που βλέπετε.")}`;

  return renderEmail({
    title,
    preheader,
    body,
    unsubscribeUrl,
    showTitle: false,
    bodyPadding: "0",
    bodyRows: true,
    masthead: "Τιμοκατάλογος",
  });
};
