/**
 * Σύμβαση ώρας για το parking — διάβασέ το πριν αγγίξεις οτιδήποτε με χρόνο.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ
 * Οι κάμερες στέλνουν ΤΟΠΙΚΗ ώρα Αθήνας και η εφαρμογή τη γράφει στο
 * `lpr_recognition_events.recognition_time` αυτούσια, σαν να ήταν UTC. Το
 * `created_at` της ίδιας γραμμής είναι κανονικό UTC, οπότε οι δύο στήλες
 * διαφέρουν κατά το offset Αθήνας (+3 το καλοκαίρι, +2 τον χειμώνα):
 *
 *   recognition_time = 2026-09-24T10:53:57Z   ← στην πραγματικότητα 10:53 τοπική
 *   created_at       = 2026-09-24T07:53:58Z   ← πραγματικό UTC
 *
 * Το SoftOne, από την άλλη, δίνει τοπικές ώρες ως κείμενο ("2026-09-24 07:51:00").
 *
 * Η ΣΥΜΒΑΣΗ
 * Όλα τα «ρολόγια τοίχου» παριστάνονται ως Date με τα ΤΟΠΙΚΑ μέρη γραμμένα στα
 * UTC πεδία. Δηλαδή ό,τι διαβάζεις με `getUTCHours()` είναι η ώρα Αθήνας. Έτσι:
 *   - το `recognitionTime` χρησιμοποιείται ως έχει, χωρίς μετατροπή
 *   - οι ώρες του ERP διαβάζονται με `parseErpWallClock` (προσθέτει "Z")
 *   - το «τώρα» ΠΡΕΠΕΙ να ζητιέται με `wallClockNow()`, ποτέ με `new Date()`
 *
 * Μη «διορθώσεις» το recognition_time χωρίς migration των ιστορικών δεδομένων —
 * 22.000 εγγραφές θα μετατοπιστούν και οι διάρκειες θα μείνουν σωστές μόνο αν
 * αλλάξουν όλες μαζί.
 */

/** Το «τώρα» στην ίδια σύμβαση με το `recognitionTime` (ρολόι τοίχου Αθήνας). */
export function wallClockNow(now: Date = new Date()): Date {
  const athens = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Athens" })
  );
  // Τα τοπικά μέρη της Αθήνας, γραμμένα στα UTC πεδία.
  return new Date(
    Date.UTC(
      athens.getFullYear(),
      athens.getMonth(),
      athens.getDate(),
      athens.getHours(),
      athens.getMinutes(),
      athens.getSeconds(),
      now.getMilliseconds()
    )
  );
}

/** Ώρα του SoftOne ("2026-09-24 07:51:00") στην ίδια σύμβαση. */
export function parseErpWallClock(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("0/0/0")) return null;
  const d = new Date(`${trimmed.replace(" ", "T")}Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Μορφοποίηση ρολογιού τοίχου για εμφάνιση — διαβάζει τα UTC μέρη. */
export function formatWallClock(d: Date | null): string {
  if (!d) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Πινακίδες που δεν διάβασε η κάμερα — δεν αντιπαραβάλλονται με τίποτα. */
const UNREADABLE = new Set(["NO PLATES", "NOPLATES", "NO PLATE", "UNKNOWN", "-", ""]);

export function isReadablePlate(plate: string | null | undefined): boolean {
  const p = (plate ?? "").trim().toUpperCase();
  return p.length >= 3 && !UNREADABLE.has(p);
}
