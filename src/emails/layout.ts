import { BRAND, COMPANY, CONTENT_WIDTH, FONT_STACK, LOGO_URL, MONO_STACK } from "./brand";

/**
 * Το κέλυφος κάθε email: πίνακες, inline styles, χωρίς webfonts και χωρίς
 * flexbox/grid. Ό,τι χρειάζεται για να διαβάζεται σωστά από Outlook μέχρι
 * Gmail σε κινητό.
 *
 * Responsive χωρίς media queries όπου γίνεται: πίνακας 100% με `max-width`
 * και εικόνες `width:100%;height:auto`. Τα media queries που υπάρχουν είναι
 * μπόνους για όσους clients τα υποστηρίζουν — τίποτα δεν σπάει χωρίς αυτά.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ButtonOptions = {
  /** Πλήρες πλάτος (προσφορές) ή inline (προεπιλογή). */
  full?: boolean;
  /** Χρώμα φόντου — κόκκινο της μάρκας από προεπιλογή. */
  background?: string;
  /** Περιθώριο γύρω από το κουμπί. */
  margin?: string;
  /** Στοίχιση όταν δεν είναι πλήρους πλάτους. */
  align?: "left" | "center";
};

/**
 * Κουμπί δράσης — «bulletproof». Στο Outlook (Word engine) το φόντο το
 * ζωγραφίζει VML roundrect· παντού αλλού ένα κελί πίνακα με bgcolor +
 * inline background-color. Ύψος ≥ 44 px για να πατιέται με τον αντίχειρα.
 */
export function button(label: string, href: string, options: ButtonOptions = {}): string {
  const { full = false, background = BRAND.red, margin = "24px 0", align = "left" } = options;
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  const width = full ? 536 : Math.max(180, Math.min(536, label.length * 11 + 60));

  return `
  <table role="presentation" ${full ? 'width="100%" ' : ""}cellpadding="0" cellspacing="0" border="0" style="${
    full ? "width:100%;" : ""
  }margin:${margin};${align === "center" && !full ? "margin-left:auto;margin-right:auto;" : ""}">
    <tr>
      <td align="center" bgcolor="${background}" style="border-radius:2px;background-color:${background};">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${safeHref}" style="height:52px;v-text-anchor:middle;width:${width}px;" arcsize="4%" stroke="f" fillcolor="${background}">
          <w:anchorlock/>
          <center style="color:${BRAND.white};font-family:${FONT_STACK};font-size:16px;font-weight:bold;">${safeLabel}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${safeHref}"
           style="display:${full ? "block" : "inline-block"};padding:16px 32px;font-family:${FONT_STACK};font-size:16px;line-height:20px;font-weight:bold;letter-spacing:0.02em;color:${BRAND.white};text-decoration:none;border-radius:2px;text-align:center;">
          ${safeLabel}
        </a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;
}

/** Γραμμή δεδομένων (πινακίδα, ώρα, ποσό) σε monospace, όπως στα παραστατικά. */
export function dataRow(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:1px solid ${BRAND.cloud};font-family:${FONT_STACK};font-size:14px;color:${BRAND.steel};">
      ${escapeHtml(label)}
    </td>
    <td align="right" style="padding:8px 0;border-bottom:1px solid ${BRAND.cloud};font-family:${MONO_STACK};font-size:14px;color:${BRAND.ink};font-weight:bold;">
      ${escapeHtml(value)}
    </td>
  </tr>`;
}

export function dataTable(rows: Array<[string, string]>): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;">
    ${rows.map(([label, value]) => dataRow(label, value)).join("")}
  </table>`;
}

export type EmailLayoutOptions = {
  /** Τίτλος στην μπλε κεφαλίδα. Έως έξι λέξεις, όπως λέει ο οδηγός. */
  title: string;
  /** Το κείμενο που βλέπει ο παραλήπτης στην προεπισκόπηση του inbox. */
  preheader?: string;
  body: string;
  /** Σύνδεσμος διαγραφής — υποχρεωτικός στα ενημερωτικά δελτία. */
  unsubscribeUrl?: string;
  /**
   * Ο τίτλος μέσα στην μπλε κεφαλίδα. Τα συντακτικά πρότυπα τον σβήνουν και
   * τον ξαναγράφουν μόνα τους σε μεγάλο μέγεθος μέσα στο σώμα.
   * Προεπιλογή: `true` — τα συναλλακτικά email μένουν όπως ήταν.
   */
  showTitle?: boolean;
  /** Padding του κελιού περιεχομένου. `"0"` για full-bleed συνθέσεις. */
  bodyPadding?: string;
  /** Φόντο του κελιού περιεχομένου. */
  bodyBackground?: string;
  /** Σήμανση δεξιά στο masthead — π.χ. «ΕΝΗΜΕΡΩΤΙΚΟ ΔΕΛΤΙΟ · ΟΚΤ 2026». */
  masthead?: string;
  /** Το `body` είναι `<tr>` γραμμές, για ζώνες χρώματος σε πλήρες πλάτος. */
  bodyRows?: boolean;
};

export function renderEmail({
  title,
  preheader,
  body,
  unsubscribeUrl,
  showTitle = true,
  masthead,
  bodyRows = false,
  bodyPadding = "32px",
  bodyBackground = BRAND.white,
}: EmailLayoutOptions): string {
  const fullBleed = bodyPadding === "0";
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="el">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${escapeHtml(title)}</title>
<!--[if mso]>
<style type="text/css">body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style>
<![endif]-->
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<style type="text/css">
  body{margin:0;padding:0;width:100% !important;background-color:${BRAND.cloud};}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
  a{color:${BRAND.red};}
  table{border-collapse:collapse;}
  /* Κινητό: μία στήλη, μικρότεροι τίτλοι, μικρότερα περιθώρια. */
  @media only screen and (max-width:620px){
    .mp-container{width:100% !important;}
    .mp-pad{padding-left:20px !important;padding-right:20px !important;}
    .mp-pad-lg{padding-left:24px !important;padding-right:24px !important;}
    .mp-title{font-size:24px !important;line-height:30px !important;}
    /* Οι εκφωνητικοί τίτλοι: 44–52 px στην οθόνη, 30 px στο κινητό. */
    .mp-display{font-size:30px !important;line-height:34px !important;}
    .mp-display-sm{font-size:26px !important;line-height:30px !important;}
    /* Το μεγάλο νούμερο (τιμή) δεν χωράει στα 320 px στο αρχικό του μέγεθος. */
    .mp-figure{font-size:52px !important;line-height:56px !important;}
    .mp-index{font-size:28px !important;line-height:30px !important;}
    .mp-hide-sm{display:none !important;}
    .mp-stack{display:block !important;width:100% !important;max-width:100% !important;padding-left:0 !important;padding-right:0 !important;direction:ltr !important;text-align:left !important;}
    .mp-stack-gap{height:16px !important;line-height:16px !important;}
    .mp-hide-sm{display:none !important;}
    .mp-air{padding-top:36px !important;padding-bottom:36px !important;}
  }
  /* Σκοτεινό θέμα: το λευκό χαρτί γίνεται ανθρακί, το κείμενο ανοίγει.
     Το μπλε και το κόκκινο της μάρκας μένουν όπως είναι. */
  @media (prefers-color-scheme: dark){
    body, .mp-canvas{background-color:#12121A !important;}
    .mp-card{background-color:#1B1B26 !important;}
    .mp-ink, .mp-ink p, .mp-ink li, .mp-ink h1, .mp-ink h2, .mp-ink h3, .mp-ink strong, .mp-ink td{color:#E7E7EE !important;}
    .mp-navy-ink, .mp-navy-ink p, .mp-navy-ink h2{color:#C9CEE6 !important;}
    .mp-cloud{background-color:#22222E !important;}
    .mp-cloud-alt{background-color:#1B1B26 !important;}
    .mp-hair{border-color:#343446 !important;background-color:#343446 !important;}
    .mp-muted, .mp-muted p, .mp-muted a{color:#9B9BAA !important;}
    /* Το κόκκινο της μάρκας: ανοίγει αντί να γκριζάρει από τον κανόνα του
       mp-ink, ώστε ο τόνος να επιβιώνει και στο σκοτεινό θέμα. */
    .mp-accent, .mp-accent p{color:#E8657F !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.cloud};">
  <!-- Προεπισκόπηση inbox: κρυφό κείμενο, δεν εμφανίζεται στο σώμα. -->
  <div style="display:none;font-size:1px;color:${BRAND.cloud};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(preheader ?? "")}
    ${"&#847;&zwnj;&nbsp;".repeat(60)}
  </div>

  <table role="presentation" class="mp-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.cloud}" style="background-color:${BRAND.cloud};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <table role="presentation" class="mp-container mp-card" width="${CONTENT_WIDTH}" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.white}" style="width:${CONTENT_WIDTH}px;max-width:${CONTENT_WIDTH}px;background-color:${BRAND.white};border-radius:2px;overflow:hidden;">

          <!--
            Masthead: λογότυπο αριστερά, σήμανση έκδοσης δεξιά, κόκκινη γραμμή
            από κάτω. Δίνει την αίσθηση εντύπου αντί για λογότυπο σε άδεια ταινία.
          -->
          <tr>
            <td class="mp-pad" bgcolor="${BRAND.navy}" style="padding:24px 32px 20px;background-color:${BRAND.navy};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle" style="width:60%;">
                    <img src="${LOGO_URL}" width="190" alt="${COMPANY.name}"
                         style="display:block;width:190px;max-width:190px;height:auto;border:0;" />
                  </td>
                  <td class="mp-hide-sm" align="right" valign="middle" style="width:40%;font-family:${MONO_STACK};font-size:11px;line-height:16px;letter-spacing:0.14em;color:rgba(255,255,255,0.62);text-transform:uppercase;">
                    ${escapeHtml(masthead ?? COMPANY.city)}
                  </td>
                </tr>
              </table>
              ${
                showTitle
                  ? `<h1 class="mp-title" style="margin:22px 0 0;font-family:${FONT_STACK};font-size:30px;line-height:36px;font-weight:bold;letter-spacing:-0.02em;color:${BRAND.white};">
                ${escapeHtml(title)}
              </h1>`
                  : ""
              }
            </td>
          </tr>

          <!-- Κόκκινη γραμμή της μάρκας -->
          <tr><td bgcolor="${BRAND.red}" style="height:4px;line-height:4px;font-size:0;background-color:${BRAND.red};">&nbsp;</td></tr>

          <!-- Περιεχόμενο -->
          ${
            bodyRows
              ? // Το σώμα είναι ήδη γραμμές πίνακα: μπαίνουν αυτούσιες, ώστε οι
                // ζώνες χρώματος να πιάνουν όλο το πλάτος του email.
                body
              : `<tr>
            <td ${fullBleed ? "" : 'class="mp-pad" '}bgcolor="${bodyBackground}" style="padding:${bodyPadding};background-color:${bodyBackground};font-family:${FONT_STACK};font-size:16px;line-height:24px;color:${BRAND.ink};">
              ${body}
            </td>
          </tr>`
          }

          <!-- Υποσέλιδο: navy πλακέτα, κλείνει τη σύνθεση αντί να ξεθωριάζει -->
          <tr>
            <td class="mp-pad" bgcolor="${BRAND.navy}" style="padding:32px;background-color:${BRAND.navy};font-family:${FONT_STACK};font-size:13px;line-height:21px;color:rgba(255,255,255,0.72);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="mp-stack" valign="top" style="width:55%;padding-right:16px;">
                    <p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:${BRAND.white};letter-spacing:-0.01em;">
                      ${COMPANY.name} — ${COMPANY.city}
                    </p>
                    <p style="margin:0 0 4px;">${COMPANY.address}</p>
                    <p style="margin:0;">
                      <a href="tel:${COMPANY.phoneHref}" style="color:rgba(255,255,255,0.72);text-decoration:none;">${COMPANY.phone}</a>
                      &nbsp;·&nbsp;
                      <a href="${COMPANY.site}" style="color:${BRAND.white};text-decoration:underline;">megaparking.gr</a>
                    </p>
                  </td>
                  <td class="mp-stack" valign="top" style="width:45%;font-family:${MONO_STACK};font-size:12px;line-height:20px;color:rgba(255,255,255,0.58);">
                    ${COMPANY.hours.join("<br />")}
                  </td>
                </tr>
              </table>
              ${
                unsubscribeUrl
                  ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid rgba(255,255,255,0.16);font-size:12px;line-height:18px;color:rgba(255,255,255,0.5);">
                       Λαμβάνετε αυτό το μήνυμα επειδή έχετε εγγραφεί στο ενημερωτικό δελτίο μας.
                       <a href="${escapeHtml(unsubscribeUrl)}" style="color:rgba(255,255,255,0.72);text-decoration:underline;">Διαγραφή</a>.
                     </p>`
                  : ""
              }
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Απλή εκδοχή κειμένου — κάθε email πρέπει να έχει και text μέρος. */
export function textVersion(lines: string[]): string {
  return [...lines, "", `${COMPANY.name} — ${COMPANY.address}`, COMPANY.phone, COMPANY.site].join("\n");
}
