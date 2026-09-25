/**
 * Αποδεικτικό υπέρβασης σύμβασης, σε PDF.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * Χωρίς αποδεικτικό, η χρέωση πέραν της σύμβασης είναι ισχυρισμός. Ο πελάτης
 * θα ρωτήσει «ποια αυτοκίνητα, πότε, πόση ώρα» — και η απάντηση πρέπει να
 * υπάρχει σε ένα αρχείο που προωθείται, όχι σε μια οθόνη που αλλάζει.
 *
 * ΤΙ ΠΕΡΙΕΧΕΙ
 * Τη σύμβαση και τις θέσεις της, το παράθυρο της υπέρβασης, κάθε όχημα με
 * ώρα εισόδου και εξόδου, τον χρεώσιμο χρόνο ανά όχημα, και ΦΩΤΟΓΡΑΦΙΕΣ
 * εισόδου και εξόδου. Η φωτογραφία είναι ο λόγος που το έγγραφο πείθει: μια
 * γραμμή με ώρες αμφισβητείται, μια λήψη του οχήματος στην είσοδο όχι.
 */

import PDFDocument from "pdfkit";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { formatWallClock, wallClockNow } from "@/lib/parking-time";
import {
  buildOverrunReport,
  type ContractOverrun,
  type OverrunWindow,
} from "@/lib/contract-overruns";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const REGULAR = path.join(FONT_DIR, "NotoSans-Regular.ttf");
const BOLD = path.join(FONT_DIR, "NotoSans-Bold.ttf");

const MEGA_BLUE = "#17285B";
const MEGA_RED = "#E31E2A";
const INK = "#0F172A";
const MUTED = "#64748B";
const RULE = "#E2E8F0";

const hhmm = (d: Date | null) => (d ? formatWallClock(d).slice(6) : "—");

function span(minutes: number): string {
  if (minutes < 60) return `${minutes} λεπτά`;
  const h = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${h} ώρες` : `${h}ω ${minutes % 60}′`;
}

/** Η γενική λήψη του οχήματος, σε JPEG — το PDF δεν ξέρει WebP. */
async function photo(
  plate: string,
  at: Date,
  direction: "IN" | "OUT",
  width = 260
): Promise<Buffer | null> {
  try {
    const event = await prisma.lprRecognitionEvent.findFirst({
      where: {
        licensePlate: plate,
        direction,
        recognitionTime: {
          gte: new Date(at.getTime() - 15 * 60_000),
          lte: new Date(at.getTime() + 15 * 60_000),
        },
      },
      orderBy: { recognitionTime: "asc" },
      select: { id: true },
    });
    if (!event) return null;

    const images = await prisma.lprImage.findMany({
      where: { eventType: "recognition", eventId: event.id },
      select: { url: true, imageType: true },
    });
    const RANK: Record<string, number> = { FULL_IMAGE: 0, SNAPSHOT: 1, PLATE_IMAGE: 2 };
    const best = images.sort(
      (a, b) => (RANK[a.imageType] ?? 9) - (RANK[b.imageType] ?? 9)
    )[0];
    if (!best) return null;

    const res = await fetch(best.url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 74 })
      .toBuffer();
  } catch {
    // Μια φωτογραφία που λείπει δεν ακυρώνει το αποδεικτικό — οι ώρες μένουν.
    return null;
  }
}

export type EvidenceVehicle = {
  plate: string;
  entry: Date;
  exit: Date | null;
  chargeableMinutes: number;
  amount: number;
  inPhoto: Buffer | null;
  outPhoto: Buffer | null;
};

/** Βρίσκει τη σύμβαση και συγκεντρώνει ό,τι χρειάζεται το έγγραφο. */
export async function buildOverrunEvidence(
  inst: number,
  days = 7
): Promise<{ pdf: Buffer; contract: ContractOverrun } | { error: string }> {
  const report = await buildOverrunReport(days);
  if (report.error) return { error: report.error };

  const contract = report.contracts.find((c) => c.inst === inst);
  if (!contract) return { error: `Η σύμβαση ${inst} δεν έχει υπερβάσεις στην περίοδο.` };

  // Τα οχήματα που εμπλέκονται, με τις ώρες τους από το βιβλίο πόρτας.
  const plates = [...new Set(contract.windows.flatMap((w) => w.plates))];
  const chargeByPlate = new Map(contract.chargeable.map((c) => [c.plate, c]));

  // Το αποδεικτικό αφορά ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, όχι το όχημα γενικά: μας ενδιαφέρει η
  // παρουσία που συνέπεσε με την υπέρβαση. Ένα όχημα που μπήκε ξανά σήμερα έχει
  // και χθεσινές κλειστές στάσεις — αν πάρουμε την τελευταία κλειστή, το έγγραφο
  // δείχνει ώρες και φωτογραφίες άλλης ημέρας, και μια έξοδο που δεν έγινε.
  const periodStart = contract.windows[0].start;
  const periodEnd = contract.windows.reduce<Date>(
    (latest, w) => (w.end && w.end > latest ? w.end : latest),
    contract.windows[contract.windows.length - 1].start
  );

  const vehicles: EvidenceVehicle[] = [];
  for (const plate of plates) {
    // Πρώτα το όχημα που είναι ΑΚΟΜΑ μέσα και μπήκε πριν τελειώσει η υπέρβαση.
    const inv = await prisma.parkingInventory.findUnique({ where: { plate } });
    const insideNow = inv && inv.enteredAt <= periodEnd ? inv : null;

    // Αλλιώς η κλειστή στάση που επικαλύπτει το διάστημα της υπέρβασης.
    const stay = insideNow
      ? null
      : ((await prisma.parkingStay.findFirst({
          where: {
            plate,
            contractInst: inst,
            enteredAt: { lte: periodEnd },
            exitedAt: { gte: periodStart },
          },
          orderBy: { enteredAt: "desc" },
        })) ??
        (await prisma.parkingStay.findFirst({
          where: { plate, contractInst: inst },
          orderBy: { exitedAt: "desc" },
        })));

    const entry = insideNow?.enteredAt ?? stay?.enteredAt ?? contract.windows[0].start;
    const exit = insideNow ? null : (stay?.exitedAt ?? null);
    const ch = chargeByPlate.get(plate);

    vehicles.push({
      plate,
      entry,
      exit,
      chargeableMinutes: ch?.minutes ?? 0,
      amount: ch?.amount ?? 0,
      inPhoto: await photo(plate, entry, "IN"),
      outPhoto: exit ? await photo(plate, exit, "OUT") : null,
    });
  }

  return { pdf: await render(contract, vehicles), contract };
}

function render(contract: ContractOverrun, vehicles: EvidenceVehicle[]): Promise<Buffer> {
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
    doc.rect(0, 0, doc.page.width, 96).fill(MEGA_BLUE);
    doc.font("b").fontSize(19).fillColor("#FFFFFF").text("Αποδεικτικό υπέρβασης σύμβασης", 40, 26);
    doc
      .font("r")
      .fontSize(11)
      .fillColor("#B9C2DC")
      .text(`Σύμβαση ${contract.inst} · ${contract.name}`, 40, 52, { width: W });
    doc
      .fontSize(9)
      .fillColor("#8E99BC")
      .text(`Εκδόθηκε ${formatWallClock(wallClockNow())}`, 40, 74);

    doc.y = 120;

    // ── Σύνοψη ────────────────────────────────────────────────────────────
    const cards: [string, string, string][] = [
      ["Θέσεις σύμβασης", String(contract.slots), INK],
      ["Κορύφωση", `${contract.worstPeak}`, MEGA_RED],
      ["Περιστατικά", String(contract.windows.length), INK],
      ["Χρεώσιμο", `${contract.chargeableAmount.toFixed(2)} €`, MEGA_RED],
    ];
    const cw = W / 4;
    const top = doc.y;
    cards.forEach(([label, value, color], i) => {
      const x = 40 + i * cw;
      doc.font("b").fontSize(18).fillColor(color).text(value, x, top, { width: cw - 8 });
      doc.font("r").fontSize(8.5).fillColor(MUTED).text(label, x, top + 22, { width: cw - 8 });
    });
    doc.y = top + 48;

    doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).strokeColor(RULE).lineWidth(1).stroke();
    doc.moveDown(0.8);

    // ── Τα περιστατικά ────────────────────────────────────────────────────
    doc.font("b").fontSize(13).fillColor(INK).text("Περιστατικά υπέρβασης", 40, doc.y);
    doc.moveDown(0.4);

    for (const w of contract.windows) {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.y = 44;
      }
      const y = doc.y;
      doc
        .font("b")
        .fontSize(10)
        .fillColor(INK)
        .text(`${w.day}  ${hhmm(w.start)} – ${w.ongoing ? "σε εξέλιξη" : hhmm(w.end)}`, 40, y);
      doc
        .font("b")
        .fontSize(10)
        .fillColor(MEGA_RED)
        .text(`${w.peak}/${w.slots}`, 40, y, { width: W, align: "right" });
      doc
        .font("r")
        .fontSize(9)
        .fillColor(MUTED)
        .text(
          `Διάρκεια ${span(w.minutes)}. ` +
            (w.causedBy
              ? `Το ${w.causedBy} μπήκε στις ${hhmm(w.start)} ενώ ήταν ήδη μέσα ${w.alreadyInside.join(", ") || "—"}.`
              : `Μέσα: ${w.plates.join(", ")}.`),
          40,
          y + 14,
          { width: W }
        );
      doc.y = y + 40;
      doc.moveTo(40, doc.y - 6).lineTo(40 + W, doc.y - 6).strokeColor(RULE).lineWidth(0.5).stroke();
    }

    doc.moveDown(0.8);

    // ── Τα οχήματα, με φωτογραφίες ────────────────────────────────────────
    doc.font("b").fontSize(13).fillColor(INK).text("Οχήματα και φωτογραφίες", 40, doc.y);
    doc
      .font("r")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text("Είσοδος και έξοδος όπως τις κατέγραψαν οι κάμερες.", 40, doc.y + 1, { width: W });
    doc.moveDown(0.8);

    const IMG_W = 172;
    const IMG_H = 108;

    for (const v of vehicles) {
      if (doc.y + IMG_H + 72 > doc.page.height - 50) {
        doc.addPage();
        doc.y = 44;
      }
      const y0 = doc.y;

      doc.font("b").fontSize(11).fillColor(INK).text(v.plate, 40, y0);
      if (v.chargeableMinutes > 0) {
        doc
          .font("b")
          .fontSize(10)
          .fillColor(MEGA_RED)
          .text(`${span(v.chargeableMinutes)} · ${v.amount.toFixed(2)} €`, 40, y0, {
            width: W,
            align: "right",
          });
      }
      doc
        .font("r")
        .fontSize(9)
        .fillColor(MUTED)
        .text(
          `Είσοδος ${formatWallClock(v.entry)}` +
            (v.exit ? `  ·  Έξοδος ${formatWallClock(v.exit)}` : "  ·  βρίσκεται ακόμα μέσα") +
            (v.chargeableMinutes > 0 ? "  ·  πέρα από τις θέσεις της σύμβασης" : "  ·  εντός θέσεων"),
          40,
          y0 + 15,
          { width: W }
        );

      // Απόσταση από τη γραμμή στοιχείων: οι λεζάντες κολλούσαν πάνω της.
      const imgY = y0 + 44;
      const slot = (buf: Buffer | null, x: number, caption: string) => {
        doc.font("r").fontSize(7.5).fillColor(MUTED).text(caption, x, imgY - 11, { width: IMG_W });
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
      slot(v.inPhoto, 40, "Είσοδος");
      slot(v.outPhoto, 40 + IMG_W + 12, "Έξοδος");

      doc.y = imgY + IMG_H + 14;
      doc.moveTo(40, doc.y - 6).lineTo(40 + W, doc.y - 6).strokeColor(RULE).lineWidth(0.5).stroke();
    }

    // ── Υποσέλιδο ─────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // Βλ. `daily-report`: χωρίς μηδενισμό του περιθωρίου, κάθε υποσέλιδο
      // γεννά δική του κενή σελίδα.
      const keep = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("r")
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(
          `MEGA Parking · Αποδεικτικό υπέρβασης σύμβασης ${contract.inst} · σελίδα ${i + 1} από ${range.count}`,
          40,
          doc.page.height - 30,
          { width: W, align: "center", lineBreak: false }
        );
      doc.page.margins.bottom = keep;
    }

    doc.end();
  });
}
