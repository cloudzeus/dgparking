/**
 * BunnyCDN Storage API Utility
 * 
 * Handles image uploads to BunnyCDN Storage.
 * Used for storing LPR camera images (plate images, full images, evidence images).
 * 
 * SERVER-SIDE ONLY
 *
 * ΟΛΕΣ οι εικόνες μετατρέπονται σε WebP με μέγιστη διάσταση 1440px πριν
 * ανέβουν. Οι κάμερες στέλνουν JPEG 1920×1080 (~300 KB η καθεμία) και τρεις
 * εικόνες ανά διέλευση: 81.539 αρχεία είχαν φτάσει τα 10,5 GB. Το WebP στο ίδιο
 * οπτικό επίπεδο κόβει τον όγκο κατά ~70%.
 */

import sharp from "sharp";
import { MAX_IMAGE_DIMENSION, WEBP_QUALITY } from "@/lib/media";

/**
 * Μετατροπή σε WebP με σμίκρυνση.
 *
 * Αν αποτύχει — κατεστραμμένο byte stream, μορφή που δεν αναγνωρίζει η sharp —
 * επιστρέφεται το πρωτότυπο. Μια εικόνα που δεν συμπιέστηκε είναι πολύ
 * προτιμότερη από χαμένο αποδεικτικό υλικό.
 */
async function toWebp(
  input: Buffer,
  label: string
): Promise<{ buffer: Buffer; extension: string; converted: boolean }> {
  try {
    const output = await sharp(input)
      .rotate() // προσανατολισμός από EXIF πριν τη σμίκρυνση
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true, // οι μικρές εικόνες πινακίδας μένουν ως έχουν
      })
      // Η διαφάνεια διατηρείται — ποτέ flatten.
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    const saved = Math.round((1 - output.length / input.length) * 100);
    console.log(
      `   🗜️  WebP: ${(input.length / 1024).toFixed(0)}KB → ${(output.length / 1024).toFixed(0)}KB (−${saved}%) [${label}]`
    );
    return { buffer: output, extension: "webp", converted: true };
  } catch (error) {
    console.warn(`   ⚠️  Η μετατροπή σε WebP απέτυχε για «${label}» — ανεβαίνει ως έχει:`, error);
    return { buffer: input, extension: "", converted: false };
  }
}

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE;
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com";
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME; // e.g., "your-zone.b-cdn.net"

/**
 * Upload a base64 image directly to BunnyCDN Storage
 * 
 * IMPORTANT: This function uploads the image directly to BunnyCDN and returns only the URL.
 * The image blob/base64 is NOT stored locally or in the database - only the URL is returned.
 * 
 * @param base64Image - Base64 encoded image string (with or without data URI prefix)
 * @param fileName - Desired file name (will be prefixed with timestamp)
 * @param folder - Optional folder path (e.g., "lpr/plate-images")
 * @returns URL of the uploaded image (blob is NOT stored, only URL returned)
 */
export async function uploadImageToBunnyCDN(
  base64Image: string,
  fileName: string,
  folder: string = "lpr"
): Promise<{ url: string; fileName: string }> {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY) {
    const errorMsg = "BunnyCDN credentials not configured. Please set BUNNY_STORAGE_ZONE and BUNNY_ACCESS_KEY environment variables.";
    console.error(`❌ ${errorMsg}`);
    console.error(`   ⚠️  Image upload skipped - event will still be saved but without image URLs`);
    throw new Error(errorMsg);
  }

  try {
    // Remove data URI prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = base64Image.includes(",")
      ? base64Image.split(",")[1]
      : base64Image;

    // Decode base64 to buffer for upload
    // This buffer is only used for the upload request and is NOT stored anywhere
    const originalBuffer = Buffer.from(base64Data, "base64");

    // Συμπίεση ΠΡΙΝ το ανέβασμα — ό,τι ανεβεί ασυμπίεστο μένει ασυμπίεστο.
    const { buffer: imageBuffer, extension, converted } = await toWebp(originalBuffer, fileName);

    // Generate unique file name with timestamp
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    // Η κατάληξη πρέπει να ακολουθεί το περιεχόμενο: το BunnyCDN σερβίρει
    // Content-Type με βάση την κατάληξη, και ένα WebP σε .jpg δεν εμφανίζεται.
    const withExtension = converted
      ? `${sanitizedFileName.replace(/\.[^.]+$/, "")}.${extension}`
      : sanitizedFileName;
    const finalFileName = `${timestamp}_${withExtension}`;
    const filePath = folder ? `${folder}/${finalFileName}` : finalFileName;

    // BunnyCDN Storage API endpoint
    // Note: BunnyCDN automatically creates folders when uploading to a path
    const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${filePath}`;
    
    console.log(`   📁 Uploading to folder path: ${folder}/${finalFileName}`);
    console.log(`   🔗 Full upload URL: ${uploadUrl}`);

    // Upload directly to BunnyCDN via PUT request
    // The image buffer is sent in the request body and uploaded to BunnyCDN
    // After this request, the buffer is garbage collected - NOT stored locally
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_ACCESS_KEY,
        "Content-Type": "application/octet-stream",
      },
      // Uint8Array και όχι Buffer: τα νεότερα Node types δεν δέχονται
      // `Buffer<ArrayBufferLike>` ως BodyInit.
      body: new Uint8Array(imageBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BunnyCDN upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(`   ✅ Upload successful! Folder structure created automatically: ${folder}`);

    // Construct the CDN URL
    // We only return the URL - the actual image file is stored on BunnyCDN, not locally
    const cdnUrl = BUNNY_CDN_HOSTNAME
      ? `https://${BUNNY_CDN_HOSTNAME}/${filePath}`
      : `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${filePath}`;
    
    console.log(`   🔗 CDN URL: ${cdnUrl}`);

    // Return only the URL - blob/base64 is NOT stored or returned
    return {
      url: cdnUrl,
      fileName: finalFileName,
    };
  } catch (error) {
    console.error("BunnyCDN upload error:", error);
    throw error;
  }
}

/**
 * Upload multiple images to BunnyCDN
 * 
 * @param images - Array of { base64, fileName, folder } objects
 * @returns Array of uploaded image URLs
 */
export async function uploadMultipleImagesToBunnyCDN(
  images: Array<{ base64: string; fileName: string; folder?: string }>
): Promise<Array<{ url: string; fileName: string }>> {
  const uploadPromises = images.map((img) =>
    uploadImageToBunnyCDN(img.base64, img.fileName, img.folder)
  );

  return Promise.all(uploadPromises);
}

/**
 * Delete an image from BunnyCDN Storage
 * 
 * @param filePath - Full path to the file (e.g., "lpr/plate-images/1234567890_image.jpg")
 */
export async function deleteImageFromBunnyCDN(filePath: string): Promise<void> {
  if (!BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY) {
    throw new Error("BunnyCDN credentials not configured");
  }

  try {
    const deleteUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${filePath}`;

    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "AccessKey": BUNNY_ACCESS_KEY,
      },
    });

    if (!response.ok && response.status !== 404) {
      // 404 is OK - file doesn't exist
      const errorText = await response.text();
      throw new Error(`BunnyCDN delete failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    console.error("BunnyCDN delete error:", error);
    throw error;
  }
}
