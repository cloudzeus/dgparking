import { BRAND, FONT_STACK, MONO_STACK } from "../brand";
import { renderEmail } from "../layout";
import {
  ctaBand,
  displayTitle,
  eyebrowMono,
  richText,
  standfirst,
  tariffTable,
  splitLead,
  type NewsletterRenderer,
} from "./shared";

/**
 * 1. Ανακοίνωση — μία δήλωση, δυνατά.
 *
 * Ρυθμός ζωνών: Cloud (τίτλος) → λευκό (κείμενο) → πίνακας τιμών → navy (CTA).
 * Χωρίς αυτή την εναλλαγή το email διαβάζεται σαν έγγραφο Word: ένα ατέλειωτο
 * λευκό με μαύρα γράμματα.
 */
export const announcementTemplate: NewsletterRenderer = ({
  title,
  preheader,
  contentHtml,
  ctaLabel,
  ctaUrl,
  unsubscribeUrl,
}) => {
  // Η πρώτη παράγραφος γίνεται standfirst — μεγαλύτερη, πιο ανοιχτή, σαν εισαγωγή.
  const { lead, rest, rows } = splitLead(contentHtml);

  const body = `
    <!-- Ζώνη 1: ο τίτλος ως γεγονός, πάνω σε Cloud -->
    <tr>
      <td class="mp-pad mp-cloud mp-ink" bgcolor="${BRAND.cloud}" style="padding:44px 32px 40px;background-color:${BRAND.cloud};">
        ${eyebrowMono("Ανακοίνωση")}
        ${displayTitle(title, { size: 44, margin: "0 0 18px" })}
        ${standfirst(lead)}
      </td>
    </tr>

    <!-- Ζώνη 2: το κείμενο, σε λευκό, με άνεση -->
    ${
      rest
        ? `<tr>
      <td class="mp-pad mp-card mp-ink" bgcolor="${BRAND.white}" style="padding:40px 32px 8px;background-color:${BRAND.white};">
        ${richText(rest, { size: 17, lineHeight: 29 })}
      </td>
    </tr>`
        : ""
    }

    <!-- Ζώνη 3: οι τιμές ως πίνακας, όχι ως παράγραφοι -->
    ${rows.length > 0 ? tariffTable(rows) : ""}

    <!-- Ζώνη 4: το CTA σε δική του navy ταινία — δεν χάνεται -->
    ${ctaBand(ctaLabel, ctaUrl, "Κλείστε τη θέση σας σε ένα λεπτό.")}

    <!-- Επικοινωνία, διακριτικά -->
    <tr>
      <td class="mp-pad mp-card mp-ink" bgcolor="${BRAND.white}" style="padding:28px 32px 36px;background-color:${BRAND.white};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top" width="108" class="mp-stack" style="width:108px;padding:0 16px 0 0;font-family:${MONO_STACK};font-size:11px;line-height:18px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.steel};">
              Απορίες
            </td>
            <td valign="top" class="mp-stack mp-ink" style="font-family:${FONT_STACK};font-size:15px;line-height:24px;color:${BRAND.ink};">
              Απαντήστε σε αυτό το μήνυμα ή τηλεφωνήστε μας — απαντάμε την ίδια μέρα.
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return renderEmail({
    title,
    preheader,
    body,
    unsubscribeUrl,
    showTitle: false,
    bodyPadding: "0",
    // Το σώμα είναι γραμμές πίνακα: χωρίς αυτό οι ζώνες πέφτουν έξω από τον
    // πίνακα και το CTA με το υποσέλιδο χάνονται.
    bodyRows: true,
    masthead: "Ενημερωτικό δελτίο",
  });
};
