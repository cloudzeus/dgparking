import "dotenv/config";
/** Κατεβάζει τις παραγόμενες εικόνες, τις κάνει WebP και τις ανεβάζει. */
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

const ZONE = process.env.BUNNY_STORAGE_ZONE!;
const KEY = process.env.BUNNY_ACCESS_KEY!;
const HOST = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const CDN = process.env.BUNNY_CDN_HOSTNAME!;

const IMAGES = [
  { file: "portal-devices", title: "Πύλη πελατών — συσκευές",
    alt: { el: "Κινητό και φορητός υπολογιστής σε σκούρο μπλε φόντο",
           en: "A phone and a laptop on a deep navy background",
           it: "Uno smartphone e un portatile su sfondo blu scuro" },
    url: "https://cdn.openart.ai/openart-ai/production/2026-09/create-image/cXQx4aSR0hj6h2z4EF10/gpt-image-2.5-sunburst-1_1790268113665_ef3272e9.png" },
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
