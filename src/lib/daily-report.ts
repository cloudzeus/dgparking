/**
 * Ημερήσια συγκεντρωτική αναφορά σε PDF, με φωτογραφίες εισόδου και εξόδου.
 *
 * ΓΙΑΤΙ PDF ΚΑΙ ΟΧΙ ΣΕΛΙΔΑ
 * Η σελίδα αντιπαραβολής δείχνει την τρέχουσα κατάσταση· αλλάζει κάθε λεπτό.
 * Η αναφορά είναι αποτύπωμα της ημέρας, που μένει και προωθείται. Κυρίως
 * όμως έχει τις ΦΩΤΟΓΡΑΦΙΕΣ: μια απόκλιση χωρίς εικόνα είναι μια γραμμή που
 * κάποιος πρέπει να πιστέψει — με την εικόνα της εισόδου και της εξόδου
 * δίπλα, κρίνεται σε δύο δευτερόλεπτα.
 *
 * ΤΙ ΜΠΑΙΝΕΙ ΜΕΣΑ
 * Πρώτα οι αποκλίσεις, μετά η σύνοψη. Οι εκκρεμότητες κάτω των 15 λεπτών
 * ΔΕΝ είναι αποκλίσεις — είναι καθυστέρηση καταχώρησης — και μετριούνται
 * χωριστά, αλλιώς η αναφορά ουρλιάζει κάθε μέρα για το τίποτα.
 */

import PDFDocument from "pdfkit";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { reconcile, fetchErpStays, type ReconRow } from "@/lib/parking-reconcile";
import { getParkingSessions } from "@/lib/parking-sessions";
import { wallClockNow, formatWallClock } from "@/lib/parking-time";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const REGULAR = path.join(FONT_DIR, "NotoSans-Regular.ttf");
const BOLD = path.join(FONT_DIR, "NotoSans-Bold.ttf");

const MEGA_BLUE = "#17285B";
const MEGA_RED = "#E31E2A";
const INK = "#0F172A";
const MUTED = "#64748B";
const RULE = "#E2E8F0";

/** Οι καταστάσεις που θεωρούνται πραγματικό πρόβλημα, με σειρά σοβαρότητας. */
const PROBLEM_ORDER = [
  "MISSING_IN_ERP",
  "AMOUNT_DIFF",
  "EXIT_DIFF",
  "TIME_DIFF",
  "MISSING_IN_CAMERAS",
] as const;

const STATUS_LABEL: Record<string, string> = {
  MATCH: "Συμφωνούν",
  AMOUNT_DIFF: "Διαφορά ποσού",
  TIME_DIFF: "Διαφορά ώρας",
  EXIT_DIFF: "Διαφορά εξόδου",
  MISSING_IN_ERP: "Λείπει από ERP",
  MISSING_IN_CAMERAS: "Λείπει από κάμερες",
};

export type DailyReport = { pdf: Buffer; stats: ReportStats };

export type ReportStats = {
  date: string;
  total: number;
  matched: number;
  problems: number;
  pending: number;
  ourTotal: number;
  erpTotal: number;
  photos: number;
};

/** Η μέρα σε ώρα τοίχου — από τα μεσάνυχτα ως τώρα (ή ως το τέλος της). */
function dayBounds(day: Date): { from: Date; to: Date } {
  const from = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0)
  );
  const to = new Date(from.getTime() + 24 * 3600_000 - 1000);
  const now = wallClockNow();
  return { from, to: to > now ? now : to };
}

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

/**
 * Κατεβάζει μια εικόνα του CDN και τη γυρίζει σε JPEG.
 *
 * Οι εικόνες αποθηκεύονται σε WebP για να μη φουσκώνει το CDN, αλλά το PDF
 * δεν ξέρει WebP — χωρίς τη μετατροπή η αναφορά βγαίνει χωρίς φωτογραφίες.
 */
async function fetchThumb(url: string, width: number): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
  } catch {
    // Μια εικόνα που δεν κατέβηκε δεν ακυρώνει την αναφορά.
    return null;
  }
}

/** Οι φωτογραφίες εισόδου και εξόδου μιας πινακίδας μέσα στην ημέρα. */
async function photosFor(
  plate: string,
  from: Date,
  to: Date
): Promise<{ inUrl: string | null; outUrl: string | null }> {
  const events = await prisma.lprRecognitionEvent.findMany({
    where: { licensePlate: plate, recognitionTime: { gte: from, lte: to } },
    select: { id: true, direction: true, recognitionTime: true },
    orderBy: { recognitionTime: "asc" },
  });
  if (events.length === 0) return { inUrl: null, outUrl: null };

  const images = await prisma.lprImage.findMany({
    where: { eventType: "recognition", eventId: { in: events.map((e) => e.id) } },
    select: { eventId: true, url: true, imageType: true },
  });
  // Προτίμηση στη ΓΕΝΙΚΗ λήψη: το κόψιμο της πινακίδας επιβεβαιώνει τον
  // αριθμό, αλλά δεν δείχνει το όχημα — και η αναφορά υπάρχει για να κρίνει
  // κανείς με μια ματιά τι πέρασε από την μπάρα.
  const RANK: Record<string, number> = { FULL_IMAGE: 0, SNAPSHOT: 1, PLATE_IMAGE: 2 };
  const best = new Map<string, { url: string; rank: number }>();
  for (const img of images) {
    const rank = RANK[img.imageType] ?? 9;
    const current = best.get(img.eventId);
    if (!current || rank < current.rank) best.set(img.eventId, { url: img.url, rank });
  }
  const byEvent = new Map<string, string>([...best].map(([k, v]) => [k, v.url]));

  const firstIn = events.find((e) => e.direction === "IN" && byEvent.has(e.id));
  const lastOut = [...events].reverse().find((e) => e.direction === "OUT" && byEvent.has(e.id));

  return {
    inUrl: firstIn ? byEvent.get(firstIn.id)! : null,
    outUrl: lastOut ? byEvent.get(lastOut.id)! : null,
  };
}

/** Πόσο διαρκεί μια εκκρεμότητα, σε ανθρώπινη μορφή. */
function pendingLabel(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}′`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `${h}ω ${minutes % 60}′` : `${Math.floor(h / 24)} ημ.`;
}

export async function buildDailyReport(day: Date = wallClockNow()): Promise<DailyReport> {
  const { from, to } = dayBounds(day);

  const [sessions, erpStays] = await Promise.all([
    getParkingSessions(from, to),
    fetchErpStays(from, to),
  ]);
  const rows = reconcile(sessions, erpStays);

  const problems = rows
    .filter((r) => PROBLEM_ORDER.includes(r.status as (typeof PROBLEM_ORDER)[number]))
    // Η εκκρεμότητα κάτω των 15′ δεν είναι απόκλιση, είναι καθυστέρηση.
    .filter((r) => !(r.pendingMinutes != null && r.pendingMinutes < 15))
    .sort(
      (a, b) =>
        PROBLEM_ORDER.indexOf(a.status as (typeof PROBLEM_ORDER)[number]) -
          PROBLEM_ORDER.indexOf(b.status as (typeof PROBLEM_ORDER)[number]) ||
        (b.ourAmount ?? 0) - (a.ourAmount ?? 0)
    );

  const pending = rows.filter((r) => r.pendingMinutes != null && r.pendingMinutes < 15).length;

  const stats: ReportStats = {
    date: dmy(from),
    total: rows.length,
    matched: rows.filter((r) => r.status === "MATCH").length,
    problems: problems.length,
    pending,
    ourTotal: rows.reduce((s, r) => s + (r.ourAmount ?? 0), 0),
    erpTotal: rows.reduce((s, r) => s + (r.erpAmount ?? 0), 0),
    photos: 0,
  };

  // Οι φωτογραφίες κατεβαίνουν ΜΟΝΟ για τις αποκλίσεις, και με όριο: μια
  // μέρα με 200 προβλήματα θα έφτιαχνε αρχείο δεκάδων megabyte που κανένας
  // διακομιστής email δεν δέχεται.
  const withPhotos = problems.slice(0, 40);
  const shots = await Promise.all(
    withPhotos.map(async (r) => {
      const { inUrl, outUrl } = await photosFor(r.plate, from, to);
      const [inImg, outImg] = await Promise.all([
        inUrl ? fetchThumb(inUrl, 420) : null,
        outUrl ? fetchThumb(outUrl, 420) : null,
      ]);
      if (inImg) stats.photos++;
      if (outImg) stats.photos++;
      return { row: r, inImg, outImg };
    })
  );

  const pdf = await render(stats, problems, shots);
  return { pdf, stats };
}

function render(
  stats: ReportStats,
  problems: ReconRow[],
  shots: { row: ReconRow; inImg: Buffer | null; outImg: Buffer | null }[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("r", REGULAR);
    doc.registerFont("b", BOLD);

    const W = doc.page.width - 80;

    // ── Κεφαλίδα ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 92).fill(MEGA_BLUE);
    doc.font("b").fontSize(20).fillColor("#FFFFFF").text("MEGA Parking", 40, 26);
    doc
      .font("r")
      .fontSize(11)
      .fillColor("#B9C2DC")
      .text(`Ημερήσια αντιπαραβολή · ${stats.date}`, 40, 52);
    doc
      .fontSize(9)
      .fillColor("#8E99BC")
      .text(`Εκδόθηκε ${formatWallClock(wallClockNow())}`, 40, 70);

    doc.y = 116;

    // ── Σύνοψη ────────────────────────────────────────────────────────────
    const cards = [
      { label: "Στάσεις ημέρας", value: String(stats.total), color: INK },
      { label: "Συμφωνούν", value: String(stats.matched), color: "#16A34A" },
      { label: "Αποκλίσεις", value: String(stats.problems), color: stats.problems ? MEGA_RED : INK },
      { label: "Εκκρεμούν <15′", value: String(stats.pending), color: MUTED },
    ];
    const cw = W / 4;
    const top = doc.y;
    cards.forEach((c, i) => {
      const x = 40 + i * cw;
      doc.font("b").fontSize(19).fillColor(c.color).text(c.value, x, top, { width: cw - 8 });
      doc.font("r").fontSize(8.5).fillColor(MUTED).text(c.label, x, top + 23, { width: cw - 8 });
    });
    doc.y = top + 46;

    doc
      .font("r")
      .fontSize(9.5)
      .fillColor(INK)
      .text(
        `Δικός μας υπολογισμός: ${stats.ourTotal.toFixed(2)} €   ·   Ψηφιακό πελατολόγιο: ${stats.erpTotal.toFixed(2)} €   ·   ` +
          `Διαφορά: ${(stats.ourTotal - stats.erpTotal).toFixed(2)} €`,
        40,
        doc.y
      );

    doc.moveDown(0.8);
    doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).strokeColor(RULE).lineWidth(1).stroke();
    doc.moveDown(0.8);

    if (problems.length === 0) {
      doc
        .font("b")
        .fontSize(13)
        .fillColor("#16A34A")
        .text("Καμία απόκλιση σήμερα.", 40, doc.y);
      doc
        .font("r")
        .fontSize(10)
        .fillColor(MUTED)
        .text(
          "Όλες οι στάσεις των καμερών ταιριάζουν με το ψηφιακό πελατολόγιο.",
          { width: W }
        );
      doc.end();
      return;
    }

    doc.font("b").fontSize(13).fillColor(INK).text("Αποκλίσεις", 40, doc.y);
    doc
      .font("r")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `${problems.length} συνολικά. Οι φωτογραφίες είναι η πρώτη είσοδος και η τελευταία έξοδος της ημέρας.`,
        { width: W }
      );
    doc.moveDown(0.6);

    // ── Αποκλίσεις με φωτογραφίες ─────────────────────────────────────────
    const shotByPlate = new Map(shots.map((s) => [s.row.plate, s]));
    const IMG_W = 150;
    const IMG_H = 95;

    for (const row of problems) {
      const shot = shotByPlate.get(row.plate);
      const hasImages = !!(shot?.inImg || shot?.outImg);
      const blockH = hasImages ? IMG_H + 66 : 78;

      if (doc.y + blockH > doc.page.height - 50) {
        doc.addPage();
        doc.y = 44;
      }

      const y0 = doc.y;

      doc.font("b").fontSize(11).fillColor(INK).text(row.plate, 40, y0, { continued: false });
      if (row.ours?.contractInst) {
        doc
          .font("r")
          .fontSize(8)
          .fillColor(MUTED)
          .text(`σύμβαση ${row.ours.contractInst}`, 40, y0 + 14);
      }

      // Η κατάσταση, δεξιά, σε χρώμα που ξεχωρίζει χωρίς να κραυγάζει.
      doc
        .font("b")
        .fontSize(9)
        .fillColor(MEGA_RED)
        .text(STATUS_LABEL[row.status] ?? row.status, 40, y0, { width: W, align: "right" });

      // Το κείμενο σε ΜΙΑ στήλη, στοιβαγμένο. Δύο στήλες δεν χωρούν δίπλα σε
      // δύο φωτογραφίες: οι τιμές αναδιπλώνονταν και έπεφταν η μία πάνω
      // στην άλλη.
      const leftW = W - 2 * IMG_W - 16;
      const fmtSide = (
        entry: Date | null,
        exit: Date | null | undefined,
        minutes: number | null | undefined,
        amount: number,
        ref?: number | null,
        open?: boolean
      ) =>
        `${formatWallClock(entry)} – ${open ? "ανοιχτή" : formatWallClock(exit ?? null)}` +
        `${minutes != null ? `  ${minutes}′` : ""}  ·  ${amount.toFixed(2)} €` +
        `${ref ? `  #${ref}` : ""}`;

      let ty = y0 + (row.ours?.contractInst ? 28 : 22);
      const pair = (label: string, value: string) => {
        doc.font("r").fontSize(7.5).fillColor(MUTED).text(label, 40, ty, { width: leftW, lineBreak: false });
        doc.font("r").fontSize(8.5).fillColor(INK).text(value, 40, ty + 9, { width: leftW, lineBreak: false });
        ty += 23;
      };

      pair(
        "Εμείς (κάμερες)",
        fmtSide(
          row.ours?.entry ?? null,
          row.ours?.exit,
          row.ours?.durationMinutes,
          row.ourAmount ?? 0
        )
      );
      pair(
        "SoftOne (ψηφιακό πελατολόγιο)",
        fmtSide(
          row.erp?.entry ?? null,
          row.erp?.exit,
          null,
          row.erpAmount ?? 0,
          row.erp?.soaction,
          !!row.erp && row.erp.exit === null
        )
      );

      if (row.pendingMinutes != null) {
        doc
          .font("r")
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(`εκκρεμεί ${pendingLabel(row.pendingMinutes)}`, 40, ty, {
            width: leftW,
            lineBreak: false,
          });
        ty += 12;
      }

      if (hasImages) {
        const imgY = y0 + 52;
        const x1 = 40 + W - 2 * IMG_W - 8;
        const x2 = 40 + W - IMG_W;
        const slot = (buf: Buffer | null, x: number, caption: string) => {
          doc.font("r").fontSize(7.5).fillColor(MUTED).text(caption, x, imgY - 10, { width: IMG_W });
          if (buf) {
            doc.save().rect(x, imgY, IMG_W, IMG_H).clip();
            doc.image(buf, x, imgY, { cover: [IMG_W, IMG_H], align: "center", valign: "center" });
            doc.restore();
            doc.rect(x, imgY, IMG_W, IMG_H).strokeColor(RULE).lineWidth(0.5).stroke();
          } else {
            doc.rect(x, imgY, IMG_W, IMG_H).fillColor("#F1F5F9").fill();
            doc
              .font("r")
              .fontSize(8)
              .fillColor(MUTED)
              .text("χωρίς φωτογραφία", x, imgY + IMG_H / 2 - 5, { width: IMG_W, align: "center" });
          }
        };
        slot(shot?.inImg ?? null, x1, "Είσοδος");
        slot(shot?.outImg ?? null, x2, "Έξοδος");
        doc.y = imgY + IMG_H + 12;
      } else {
        doc.y = ty + 6;
      }

      doc.moveTo(40, doc.y - 4).lineTo(40 + W, doc.y - 4).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.moveDown(0.3);
    }

    if (problems.length > shots.length) {
      doc
        .font("r")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `Φωτογραφίες συμπεριλήφθηκαν για τις πρώτες ${shots.length} αποκλίσεις, ώστε το αρχείο να παραμείνει αποστέλλσιμο.`,
          40,
          doc.y,
          { width: W }
        );
    }

    // ── Αρίθμηση σελίδων ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .font("r")
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(
          `MEGA Parking · ${stats.date} · σελίδα ${i + 1} από ${range.count}`,
          40,
          doc.page.height - 32,
          { width: W, align: "center" }
        );
    }

    doc.end();
  });
}
