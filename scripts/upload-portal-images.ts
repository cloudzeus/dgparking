import "dotenv/config";
/** Κατεβάζει τις εικόνες της πύλης πελατών, τις κάνει WebP και τις ανεβάζει. */
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const ZONE = process.env.BUNNY_STORAGE_ZONE!;
const KEY = process.env.BUNNY_ACCESS_KEY!;
const HOST = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const CDN = process.env.BUNNY_CDN_HOSTNAME!;

const IMAGES = [
  {
    file: "portal-contract",
    title: "Πύλη πελατών — η σύμβασή σας",
    alt: {
      el: "Κινητό που δείχνει τη διάρκεια και τις θέσεις μιας σύμβασης",
      en: "A phone showing a contract period and its parking slots",
      it: "Uno smartphone che mostra la durata di un contratto e i posti auto",
    },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790319573765_db666db3.png",
  },
  {
    file: "portal-plates-v2",
    title: "Πύλη πελατών — οι πινακίδες σας",
    alt: {
      el: "Λευκές πινακίδες οχημάτων σε στοίβα, σε σκούρο μπλε φόντο",
      en: "White vehicle plates stacked on a deep navy background",
      it: "Targhe bianche impilate su sfondo blu scuro",
    },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790319872470_bdfdd18c.png",
  },
  {
    file: "portal-movements",
    title: "Πύλη πελατών — οι κινήσεις σας",
    alt: {
      el: "Υπόγειος χώρος στάθμευσης με τακτοποιημένες θέσεις",
      en: "An underground car park with orderly marked bays",
      it: "Un parcheggio sotterraneo con posti ordinati",
    },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790319592806_5e6d4d46.png",
  },
  {
    file: "portal-invoices",
    title: "Πύλη πελατών — τα τιμολόγιά σας",
    alt: {
      el: "Τρία λευκά παραστατικά σε βεντάλια, σε σκούρο μπλε φόντο",
      en: "Three white documents fanned out on a deep navy background",
      it: "Tre documenti bianchi disposti a ventaglio su sfondo blu scuro",
    },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790319600654_e543e5f2.png",
  },
];

async function main() {
  if (!ZONE || !KEY || !CDN) return console.log("Λείπουν οι ρυθμίσεις BunnyCDN.");
  for (const img of IMAGES) {
    const res = await fetch(img.url);
    if (!res.ok) { console.log("απέτυχε η λήψη:", img.file, res.status); continue; }
    const raw = Buffer.from(await res.arrayBuffer());

    // Το δελτίο το δείχνει σε 536px· 1200 αρκεί για οθόνες Retina.
    const out = await sharp(raw)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const meta = await sharp(out).metadata();

    const path = `site/portal/${img.file}.webp`;
    const put = await fetch(`https://${HOST}/${ZONE}/${path}`, {
      method: "PUT",
      headers: { AccessKey: KEY, "Content-Type": "image/webp" },
      body: new Uint8Array(out),
    });
    if (!put.ok) { console.log("απέτυχε το ανέβασμα:", img.file, put.status); continue; }

    const cdnUrl = `https://${CDN}/${path}`;
    const fileName = `${img.file}.webp`;
    const existing = await prisma.mediaAsset.findFirst({ where: { fileName } });
    const data = {
      title: img.title, fileName, url: cdnUrl, mimeType: "image/webp",
      fileSize: out.length, width: meta.width ?? null, height: meta.height ?? null,
      alt: img.alt, folder: "site",
    };
    if (existing) await prisma.mediaAsset.update({ where: { id: existing.id }, data });
    else await prisma.mediaAsset.create({ data });

    console.log(`✓ ${fileName}  ${(raw.length/1024).toFixed(0)}KB → ${(out.length/1024).toFixed(0)}KB  ${meta.width}×${meta.height}`);
    console.log(`  ${cdnUrl}`);
  }
  process.exit(0);
}
main();
