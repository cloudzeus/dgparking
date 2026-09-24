import { dataTable, escapeHtml, renderEmail, textVersion } from "../layout";
import { BRAND, FONT_STACK, MONO_STACK } from "../brand";
import {
  formatDateTime,
  formatEuro,
  heading,
  note,
  p,
  pText,
  RenderedEmail,
} from "./_shared";

export type DeviationKind =
  | "AMOUNT_DIFF"
  | "TIME_DIFF"
  | "EXIT_DIFF"
  | "MISSING_IN_ERP"
  | "MISSING_IN_CAMERAS";

export const DEVIATION_LABELS: Record<DeviationKind, string> = {
  AMOUNT_DIFF: "Διαφορά ποσού",
  TIME_DIFF: "Διαφορά ώρας",
  EXIT_DIFF: "Έξοδος που δεν έκλεισε",
  MISSING_IN_ERP: "Λείπει από το ψηφιακό πελατολόγιο",
  MISSING_IN_CAMERAS: "Λείπει από τις κάμερες",
};

export type DeviationItem = {
  plate: string;
  kind: DeviationKind;
  explanation: string;
  ourEntry?: Date | null;
  ourExit?: Date | null;
  ourAmount?: number | null;
  erpEntry?: Date | null;
  erpExit?: Date | null;
  erpAmount?: number | null;
  erpSoaction?: number | null;
};

const when = (d?: Date | null) => (d ? formatDateTime(d) : "—");
const money = (v?: number | null) => (v == null ? "—" : formatEuro(v));

/**
 * Η καρδιά και των δύο email: η σύγκριση των δύο πλευρών δίπλα-δίπλα.
 * Σε πλάτος κινητού οι δύο στήλες παραμένουν — είναι μόνο τέσσερις γραμμές και
 * η αξία τους είναι ακριβώς ότι διαβάζονται παράλληλα.
 */
function comparison(item: DeviationItem): string {
  const cell = (v: string, bold = false) =>
    `<td style="padding:6px 8px;border-bottom:1px solid ${BRAND.cloud};font-family:${MONO_STACK};font-size:13px;color:${BRAND.ink};${bold ? "font-weight:bold;" : ""}">${escapeHtml(v)}</td>`;
  const head = (v: string, color: string) =>
    `<th align="left" style="padding:6px 8px;border-bottom:2px solid ${color};font-family:${FONT_STACK};font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${color};">${escapeHtml(v)}</th>`;
  const label = (v: string) =>
    `<td style="padding:6px 8px;border-bottom:1px solid ${BRAND.cloud};font-family:${FONT_STACK};font-size:13px;color:${BRAND.steel};">${escapeHtml(v)}</td>`;

  const amountsDiffer =
    item.ourAmount != null &&
    item.erpAmount != null &&
    Math.abs(item.ourAmount - item.erpAmount) >= 0.005;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;border-collapse:collapse;">
    <tr>
      ${head("", BRAND.cloud)}
      ${head("Κάμερες", BRAND.navy)}
      ${head("SoftOne", BRAND.steel)}
    </tr>
    <tr>${label("Είσοδος")}${cell(when(item.ourEntry))}${cell(when(item.erpEntry))}</tr>
    <tr>${label("Έξοδος")}${cell(when(item.ourExit))}${cell(when(item.erpExit))}</tr>
    <tr>${label("Ποσό")}${cell(money(item.ourAmount), amountsDiffer)}${cell(money(item.erpAmount), amountsDiffer)}</tr>
  </table>`;
}

function comparisonText(item: DeviationItem): string[] {
  return [
    `  Είσοδος : κάμερες ${when(item.ourEntry)} | SoftOne ${when(item.erpEntry)}`,
    `  Έξοδος  : κάμερες ${when(item.ourExit)} | SoftOne ${when(item.erpExit)}`,
    `  Ποσό    : κάμερες ${money(item.ourAmount)} | SoftOne ${money(item.erpAmount)}`,
  ];
}

/** Άμεση ειδοποίηση για μία σοβαρή απόκλιση (διαφορά ποσού ή ώρας). */
export function parkingDeviationAlertEmail({
  item,
  detectedAt = new Date(),
  reviewUrl,
}: {
  item: DeviationItem;
  detectedAt?: Date;
  reviewUrl?: string;
}): RenderedEmail {
  const label = DEVIATION_LABELS[item.kind];
  const subject = `Απόκλιση παρκινγκ · ${item.plate} · ${label}`;

  const body = [
    heading(`${label} — ${item.plate}`),
    p(escapeHtml(item.explanation)),
    comparison(item),
    dataTable([
      ["Πινακίδα", item.plate],
      ["Είδος απόκλισης", label],
      ["Εγγραφή SoftOne", item.erpSoaction ? `#${item.erpSoaction}` : "δεν υπάρχει"],
      ["Εντοπίστηκε", formatDateTime(detectedAt)],
    ]),
    note(
      reviewUrl
        ? `Δες την πλήρη αντιπαραβολή στη σελίδα <a href="${escapeHtml(reviewUrl)}" style="color:${BRAND.red};">Αντιπαραβολή</a>.`
        : "Η πλήρης αντιπαραβολή βρίσκεται στη σελίδα «Αντιπαραβολή» της εφαρμογής."
    ),
  ].join("");

  const text = textVersion([
    `${label} — ${item.plate}`,
    "",
    item.explanation,
    "",
    ...comparisonText(item),
    "",
    `Εγγραφή SoftOne: ${item.erpSoaction ? `#${item.erpSoaction}` : "δεν υπάρχει"}`,
    `Εντοπίστηκε: ${formatDateTime(detectedAt)}`,
    ...(reviewUrl ? ["", `Αντιπαραβολή: ${reviewUrl}`] : []),
  ]);

  return {
    subject,
    html: renderEmail({
      title: "Απόκλιση παρκινγκ",
      preheader: `${item.plate} · ${label}`,
      masthead: "ΕΙΔΟΠΟΙΗΣΗ",
      body,
    }),
    text,
  };
}

export type DigestCounts = Record<DeviationKind, number>;

/** Ημερήσια σύνοψη: οι αριθμοί, και οι σημαντικότερες περιπτώσεις αναλυτικά. */
export function parkingDeviationDigestEmail({
  counts,
  highlights,
  periodLabel,
  amountDelta,
  reviewUrl,
}: {
  counts: DigestCounts;
  highlights: DeviationItem[];
  periodLabel: string;
  amountDelta: number;
  reviewUrl?: string;
}): RenderedEmail {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const subject = `Σύνοψη αποκλίσεων παρκινγκ · ${periodLabel} · ${total}`;

  const rows = (Object.keys(DEVIATION_LABELS) as DeviationKind[])
    .filter((k) => counts[k] > 0)
    .map((k): [string, string] => [DEVIATION_LABELS[k], String(counts[k])]);

  const body = [
    heading(`Αποκλίσεις ${periodLabel}`),
    p(
      total === 0
        ? "Καμία απόκλιση. Οι κάμερες και το ψηφιακό πελατολόγιο συμφωνούν."
        : `Εντοπίστηκαν <strong>${total}</strong> αποκλίσεις. Η συνολική διαφορά τζίρου είναι <strong>${formatEuro(amountDelta)}</strong>.`
    ),
    dataTable([...rows, ["Διαφορά τζίρου", formatEuro(amountDelta)]]),
    ...(highlights.length
      ? [
          heading("Σημαντικότερες περιπτώσεις"),
          highlights
            .map(
              (h) =>
                p(
                  `<strong style="font-family:${MONO_STACK};">${escapeHtml(h.plate)}</strong> — ${escapeHtml(DEVIATION_LABELS[h.kind])}<br>${escapeHtml(h.explanation)}`
                )
            )
            .join(""),
        ]
      : []),
    note(
      reviewUrl
        ? `Πλήρης λίστα στη σελίδα <a href="${escapeHtml(reviewUrl)}" style="color:${BRAND.red};">Αντιπαραβολή</a>.`
        : "Πλήρης λίστα στη σελίδα «Αντιπαραβολή» της εφαρμογής."
    ),
  ].join("");

  const text = textVersion([
    `Αποκλίσεις ${periodLabel}`,
    "",
    ...rows.map(([l, v]) => `${l}: ${v}`),
    `Διαφορά τζίρου: ${formatEuro(amountDelta)}`,
    ...(highlights.length
      ? ["", "Σημαντικότερες περιπτώσεις:", ...highlights.map((h) => `- ${h.plate} (${DEVIATION_LABELS[h.kind]}): ${h.explanation}`)]
      : []),
    ...(reviewUrl ? ["", `Αντιπαραβολή: ${reviewUrl}`] : []),
  ]);

  return {
    subject,
    html: renderEmail({
      title: "Σύνοψη αποκλίσεων",
      preheader: `${total} αποκλίσεις · ${formatEuro(amountDelta)} διαφορά`,
      masthead: "ΗΜΕΡΗΣΙΑ ΣΥΝΟΨΗ",
      body,
    }),
    text,
  };
}

export { pText };
