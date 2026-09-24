import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

/** Το κλειδί ανάπτυξης — ό,τι κρυπτογραφήθηκε χωρίς `ENCRYPTION_KEY` το χρησιμοποιεί. */
const DEV_PASSPHRASE = "default-key-change-in-production";

/**
 * Το κλειδί κρυπτογράφησης από μια φράση ή από δεκαεξαδικό.
 *
 * ΓΙΑΤΙ ΔΕΧΕΤΑΙ ΚΑΙ ΤΑ ΔΥΟ
 * Το `Buffer.from(key, "hex")` σε οτιδήποτε δεν είναι ακριβώς 64 δεκαεξαδικοί
 * χαρακτήρες παράγει buffer λάθος μήκους, και το μόνο που φτάνει στον χρήστη
 * είναι το αδιάφανο «Invalid key length» — από μια σελίδα που απλώς σταματά να
 * δουλεύει. Μια κανονική φράση παράγει πλέον έγκυρο κλειδί μέσω scrypt, αντί
 * να ρίχνει την εφαρμογή.
 */
export function deriveKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  return crypto.scryptSync(trimmed, "salt", KEY_LENGTH);
}

/** Το κλειδί ανάπτυξης, για μεταφορά δεδομένων σε νέο κλειδί. */
export function developmentKey(): Buffer {
  return crypto.scryptSync(DEV_PASSPHRASE, "salt", KEY_LENGTH);
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY?.trim();
  if (!key) {
    console.warn("ENCRYPTION_KEY not set, using default (not secure for production!)");
    return developmentKey();
  }
  return deriveKey(key);
}

export function encrypt(text: string, key: Buffer = getEncryptionKey()): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Αποκρυπτογράφηση.
 *
 * ΤΟ ΜΗΝΥΜΑ ΣΦΑΛΜΑΤΟΣ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΛΥΣΗΣ
 * Η αποτυχία εδώ σημαίνει σχεδόν πάντα ένα από δύο πράγματα: λάθος μορφή
 * κλειδιού, ή σωστό κλειδί που όμως ΔΕΝ είναι αυτό με το οποίο γράφτηκαν τα
 * δεδομένα. Το δεύτερο είναι ύπουλο — το κλειδί «φαίνεται» σωστό. Χωρίς
 * εξήγηση, χάνεται μια ώρα σε λάθος κατεύθυνση.
 */
export function decrypt(encryptedText: string, key: Buffer = getEncryptionKey()): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted text format");

  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    const hasEnv = Boolean(process.env.ENCRYPTION_KEY?.trim());
    throw new Error(
      hasEnv
        ? "Η αποκρυπτογράφηση απέτυχε: το ENCRYPTION_KEY δεν είναι αυτό με το οποίο " +
          "κρυπτογραφήθηκαν τα δεδομένα. Είτε αφαίρεσέ το, είτε τρέξε πρώτα " +
          "`npm run encryption:rotate` για να μεταφερθούν τα υπάρχοντα μυστικά στο νέο κλειδί."
        : "Η αποκρυπτογράφηση απέτυχε και δεν έχει οριστεί ENCRYPTION_KEY — τα δεδομένα " +
          "πιθανότατα γράφτηκαν με άλλο κλειδί. " +
          (error instanceof Error ? error.message : "")
    );
  }
}
