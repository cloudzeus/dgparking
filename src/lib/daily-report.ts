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
import { fetchDailyRevenue, type DailyRevenue } from "@/lib/daily-revenue";
import { fetchOpenErpStays } from "@/lib/parking-reconcile";
import { getInventory } from "@/lib/parking-inventory";

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
  revenue: DailyRevenue;
  /** Πλήθος ανά κατάσταση αντιπαραβολής — η πρώτη καρτέλα της σελίδας. */
  byStatus: { status: string; count: number }[];
  /** Ποια οχήματα είναι μέσα — η δεύτερη καρτέλα. */
  gate: { both: number; onlyOurs: number; onlyErp: number; inventory: number; erpOpen: number };
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

/**
 * Η επωνυμία του πελάτη πίσω από κάθε σύμβαση.
 *
 * Ο αριθμός σύμβασης δεν λέει τίποτα σε όποιον διαβάζει την αναφορά το
 * βράδυ: για να καταλάβει ποιον αφορά η απόκλιση πρέπει να ανοίξει το ERP.
 * Με την επωνιμία από κάτω, η γραμμή στέκεται μόνη της.
 */
async function customerNames(insts: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(insts)].filter((n) => Number.isFinite(n));
  if (unique.length === 0) return new Map();

  const contracts = await prisma.iNST.findMany({
    where: { INST: { in: unique } },
    select: { INST: true, TRDR: true, NAME: true },
  });

  const trdrs = [...new Set(contracts.map((c) => c.TRDR).filter(Boolean))] as string[];
  const customers = trdrs.length
    ? await prisma.cUSTORMER.findMany({
        where: { TRDR: { in: trdrs } },
        select: { TRDR: true, NAME: true },
      })
    : [];
  const byTrdr = new Map(customers.map((c) => [c.TRDR, (c.NAME ?? "").trim()]));

  const out = new Map<number, string>();
  for (const c of contracts) {
    // Πρώτα η επωνυμία του πελάτη· αν λείπει, η ονομασία της σύμβασης, που
    // συνήθως περιέχει το όνομα μαζί με τον μήνα.
    const name = (c.TRDR ? byTrdr.get(c.TRDR) : "") || (c.NAME ?? "").trim();
    if (name) out.set(c.INST, name);
  }
  return out;
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

  const [sessions, erpStays, revenue, inventory, erpOpen] = await Promise.all([
    getParkingSessions(from, to),
    fetchErpStays(from, to),
    // Μια αποτυχία στα παραστατικά δεν πρέπει να ακυρώσει ολόκληρη την
    // αναφορά — η αντιπαραβολή είναι ο λόγος που υπάρχει.
    fetchDailyRevenue(from).catch(
      (e): DailyRevenue => ({
        income: [],
        credits: [],
        collections: [],
        incomeTotal: 0,
        creditsTotal: 0,
        collectionsTotal: 0,
        unclassified: [],
        error: e instanceof Error ? e.message : "Τα παραστατικά δεν διαβάστηκαν.",
      })
    ),
    getInventory(),
    // Χωρίς φίλτρο ημέρας: ένα όχημα που μπήκε χθες και είναι ακόμα μέσα
    // πρέπει να μετρηθεί, αλλιώς φαίνεται ψευδώς ότι λείπει από το ERP.
    fetchOpenErpStays().catch(() => []),
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
    revenue,
    byStatus: (() => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.status, (m.get(r.status) ?? 0) + 1);
      return [...m.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);
    })(),
    gate: (() => {
      const ours = new Set(inventory.map((i) => i.plate));
      const erp = new Set(erpOpen.map((e) => e.plate));
      let both = 0;
      for (const p of ours) if (erp.has(p)) both++;
      return {
        both,
        onlyOurs: ours.size - both,
        onlyErp: erp.size - both,
        inventory: ours.size,
        erpOpen: erp.size,
      };
    })(),
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

  const names = await customerNames(
    problems.map((r) => r.ours?.contractInst ?? r.erp?.inst ?? NaN).filter(Number.isFinite) as number[]
  );

  const pdf = await render(stats, problems, shots, names);
  return { pdf, stats };
}

function render(
  stats: ReportStats,
  problems: ReconRow[],
  shots: { row: ReconRow; inImg: Buffer | null; outImg: Buffer | null }[],
  names: Map<number, string>
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
      const blockH = hasImages ? IMG_H + 78 : 92;

      if (doc.y + blockH > doc.page.height - 50) {
        doc.addPage();
        doc.y = 44;
      }

      const y0 = doc.y;

      doc.font("b").fontSize(11).fillColor(INK).text(row.plate, 40, y0, { continued: false });
      const inst = row.ours?.contractInst ?? row.erp?.inst ?? null;
      const customer = inst != null ? names.get(inst) : undefined;
      if (inst != null) {
        doc
          .font("r")
          .fontSize(8)
          .fillColor(MUTED)
          .text(`σύμβαση ${inst}`, 40, y0 + 13, { width: 200, lineBreak: false });
        if (customer) {
          // Η επωνυμία κόβεται ΜΕ ΜΕΤΡΗΣΗ και όχι με `ellipsis`: το τελευταίο
          // δεν εμποδίζει την αναδίπλωση, και οι μακριές εταιρικές επωνυμίες
          // έπεφταν σε τρεις σειρές πάνω στα στοιχεία από κάτω.
          doc.font("b").fontSize(8);
          const maxW = W - 2 * IMG_W - 16;
          let label = customer;
          if (doc.widthOfString(label) > maxW) {
            while (label.length > 1 && doc.widthOfString(`${label}…`) > maxW) {
              label = label.slice(0, -1);
            }
            label = `${label.trimEnd()}…`;
          }
          doc.fillColor(MEGA_BLUE).text(label, 40, y0 + 23, { lineBreak: false });
        }
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

      let ty = y0 + (inst != null ? (customer ? 38 : 28) : 22);
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

    // ── Τελική σύνοψη ─────────────────────────────────────────────────────
    //
    // Είναι η ίδια εικόνα με τη σελίδα αντιπαραβολής, και οι δύο καρτέλες
    // της: «Εμείς έναντι SoftOne» και «Ποια οχήματα είναι μέσα». Μπαίνει στο
    // ΤΕΛΟΣ και όχι στην αρχή, γιατί στην αρχή θέλει κανείς να δει αμέσως τι
    // πήγε στραβά· τα σύνολα τα διαβάζει αφού τα δει.
    doc.addPage();
    doc.y = 44;

    const h2 = (title: string, sub?: string) => {
      doc.font("b").fontSize(13).fillColor(INK).text(title, 40, doc.y, { width: W });
      if (sub) doc.font("r").fontSize(8.5).fillColor(MUTED).text(sub, 40, doc.y + 1, { width: W });
      doc.moveDown(0.5);
    };

    const money = (n: number) => `${n.toFixed(2)} €`;

    /** Γραμμή πίνακα: ετικέτα αριστερά, πλήθος και ποσό δεξιά. */
    const row3 = (label: string, mid: string, right: string, bold = false, color = INK) => {
      const y = doc.y;
      doc.font(bold ? "b" : "r").fontSize(9).fillColor(color);
      doc.text(label, 40, y, { width: W - 180, lineBreak: false });
      doc.text(mid, 40 + W - 180, y, { width: 70, align: "right", lineBreak: false });
      doc.text(right, 40 + W - 105, y, { width: 105, align: "right", lineBreak: false });
      doc.y = y + 15;
    };

    const rule = () => {
      doc.moveTo(40, doc.y + 2).lineTo(40 + W, doc.y + 2).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.y += 8;
    };

    h2("Σύνοψη ημέρας", stats.date);
    rule();

    // ── Καρτέλα 1: Εμείς έναντι SoftOne ───────────────────────────────────
    h2("Εμείς έναντι SoftOne", "Αντιπαραβολή των στάσεων των καμερών με το ψηφιακό πελατολόγιο.");
    row3("Κατάσταση", "Στάσεις", "", true, MUTED);
    for (const { status, count } of stats.byStatus) {
      const isProblem = PROBLEM_ORDER.includes(status as (typeof PROBLEM_ORDER)[number]);
      row3(STATUS_LABEL[status] ?? status, String(count), "", false, isProblem ? MEGA_RED : INK);
    }
    rule();
    row3("Σύνολο στάσεων", String(stats.total), "", true);
    row3("Δικός μας υπολογισμός", "", money(stats.ourTotal));
    row3("Ψηφιακό πελατολόγιο", "", money(stats.erpTotal));
    row3("Διαφορά", "", money(stats.ourTotal - stats.erpTotal), true, MEGA_RED);
    doc.moveDown(1);

    // ── Καρτέλα 2: Ποια οχήματα είναι μέσα ────────────────────────────────
    h2(
      "Ποια οχήματα είναι μέσα",
      "Η απογραφή μας έναντι των ανοιχτών εγγραφών του ψηφιακού πελατολογίου."
    );
    row3("Συμφωνούν και οι δύο πλευρές", String(stats.gate.both), "", true);
    row3("Μόνο στη δική μας απογραφή", String(stats.gate.onlyOurs), "", false, stats.gate.onlyOurs ? MEGA_RED : INK);
    row3("Μόνο ανοιχτά στο SoftOne", String(stats.gate.onlyErp), "", false, stats.gate.onlyErp ? MEGA_RED : INK);
    rule();
    row3("Απογραφή μας", String(stats.gate.inventory), "");
    row3("Ανοιχτά στο SoftOne", String(stats.gate.erpOpen), "");
    doc.moveDown(1);

    // ── Παραστατικά και εισπράξεις ────────────────────────────────────────
    const rev = stats.revenue;
    h2("Παραστατικά και εισπράξεις", "Ό,τι εκδόθηκε και ό,τι εισπράχθηκε την ίδια ημέρα.");

    if (rev.error) {
      doc.font("r").fontSize(9).fillColor(MEGA_RED).text(`Δεν διαβάστηκαν: ${rev.error}`, 40, doc.y, { width: W });
      doc.moveDown(1);
    } else {
      row3("Παραστατικό", "Πλήθος", "Αξία", true, MUTED);
      if (rev.income.length === 0 && rev.credits.length === 0) {
        row3("Κανένα παραστατικό εσόδου", "0", money(0), false, MUTED);
      }
      for (const g of rev.income) row3(`${g.code} — ${g.label}`, String(g.count), money(g.total));
      for (const g of rev.credits)
        row3(`${g.code} — ${g.label}`, String(g.count), `−${money(g.total)}`, false, MEGA_RED);
      rule();
      row3("Σύνολο εσόδων", "", money(rev.incomeTotal), true);
      doc.moveDown(0.6);

      row3("Είσπραξη", "Πλήθος", "Ποσό", true, MUTED);
      if (rev.collections.length === 0) row3("Καμία είσπραξη", "0", money(0), false, MUTED);
      for (const g of rev.collections) row3(`${g.code} — ${g.label}`, String(g.count), money(g.total));
      rule();
      row3("Σύνολο εισπράξεων", "", money(rev.collectionsTotal), true);

      if (rev.unclassified.length > 0) {
        doc.moveDown(0.6);
        doc
          .font("r")
          .fontSize(7.5)
          .fillColor(MUTED)
          .text(
            "Δεν προσμετρήθηκαν (σειρές εκτός εσόδων/εισπράξεων, π.χ. εμβάσματα): " +
              rev.unclassified
                .map((u) => `${u.code || `σειρά ${u.series}`} ${u.total.toFixed(2)} €`)
                .join(" · "),
            40,
            doc.y,
            { width: W }
          );
      }
    }

    // ── Αρίθμηση σελίδων ──────────────────────────────────────────────────
    //
    // ΠΡΟΣΟΧΗ: το υποσέλιδο γράφεται ΚΑΤΩ από το κάτω περιθώριο. Το pdfkit,
    // όταν δει κείμενο πέρα από το περιθώριο, προσθέτει αυτόματα νέα σελίδα
    // και το γράφει εκεί — έτσι κάθε αρίθμηση δημιουργούσε μια κενή σελίδα,
    // και η αναφορά έβγαινε 42 σελίδες με τις μισές άδειες. Μηδενίζοντας το
    // περιθώριο για όσο γράφουμε, το κείμενο μένει στη σελίδα του.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const keep = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("r")
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(
          `MEGA Parking · ${stats.date} · σελίδα ${i + 1} από ${range.count}`,
          40,
          doc.page.height - 30,
          { width: W, align: "center", lineBreak: false }
        );
      doc.page.margins.bottom = keep;
    }

    doc.end();
  });
}
