import "dotenv/config";
/** Κατεβάζει τις παραγόμενες εικόνες, τις κάνει WebP και τις ανεβάζει. */
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const ZONE = process.env.BUNNY_STORAGE_ZONE!;
const KEY = process.env.BUNNY_ACCESS_KEY!;
const HOST = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const CDN = process.env.BUNNY_CDN_HOSTNAME!;

const IMAGES = [
  { file: "events-hero", title: "Εκδηλώσεις — είσοδος πάρκινγκ το σούρουπο",
    alt: { el: "Είσοδος του πάρκινγκ με δεσμευμένες θέσεις για εκδήλωση, το σούρουπο",
           en: "Parking entrance with reserved event bays at dusk",
           it: "Ingresso del parcheggio con posti riservati per eventi al crepuscolo" },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790266019704_3fa565c2.png" },
  { file: "events-bays", title: "Εκδηλώσεις — δεσμευμένες θέσεις",
    alt: { el: "Σειρές άδειων δεσμευμένων θέσεων σε καθαρό στεγασμένο πάρκινγκ",
           en: "Rows of empty reserved bays in a clean covered parking deck",
           it: "File di posti riservati vuoti in un parcheggio coperto pulito" },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790266030133_382afbec.png" },
  { file: "events-arrival", title: "Εκδηλώσεις — άφιξη καλεσμένων",
    alt: { el: "Καλεσμένοι φτάνουν σε εκδήλωση και τους υποδέχεται υπάλληλος του πάρκινγκ",
           en: "Guests arriving at an event, welcomed by a parking attendant",
           it: "Ospiti in arrivo a un evento, accolti da un addetto al parcheggio" },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790266040462_d16d39ae.png" },
];

async function main() {
  if (!ZONE || !KEY || !CDN) return console.log("Λείπουν οι ρυθμίσεις BunnyCDN.");
  for (const img of IMAGES) {
    const res = await fetch(img.url);
    if (!res.ok) { console.log("απέτυχε η λήψη:", img.file, res.status); continue; }
    const raw = Buffer.from(await res.arrayBuffer());

    // Ίδιος κανόνας με τις φωτογραφίες των καμερών: WebP, έως 1440×1440.
    const out = await sharp(raw)
      .resize({ width: 1440, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const meta = await sharp(out).metadata();

    const path = `site/events/${img.file}.webp`;
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
