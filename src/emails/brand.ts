/**
 * Ταυτότητα MEGA Parking για email.
 * Πηγή: «Σύστημα Σχεδιασμού & Υλικό Ταυτότητας» v1.0, Ιούλιος 2026.
 *
 * Κανόνες που δεσμεύουν κάθε πρότυπο:
 *  - ΜΟΝΟ system fonts (Arial/Helvetica). Τα email clients δεν φορτώνουν
 *    webfonts, οπότε Commissioner και JetBrains Mono μένουν στο web.
 *  - Το MP Red είναι χρώμα ΔΡΑΣΗΣ: κουμπιά και σύνδεσμοι. Ποτέ για μεγάλες
 *    επιφάνειες κειμένου.
 *  - Λογότυπο ως φιλοξενούμενο PNG, μέγιστο πλάτος 220 px.
 *  - Ένα μήνυμα και ένα CTA ανά email.
 */

export const BRAND = {
  red: "#C4123D", // MP Red — δράση
  navy: "#1E2A5A", // MP Navy — κεφαλίδες, σταθερότητα
  ink: "#21212E", // κείμενο
  steel: "#888894", // δευτερεύον κείμενο
  cloud: "#EDEDF1", // φόντα, διαχωριστικά
  white: "#FFFFFF",
} as const;

/** Arial πρώτα: ό,τι κι αν έχει ο παραλήπτης, το βλέπει ίδιο. */
export const FONT_STACK = "Arial, Helvetica, sans-serif";
/** Για πινακίδες, ώρες, ποσά — monospace που υπάρχει παντού. */
export const MONO_STACK = "'Courier New', Courier, monospace";

export const COMPANY = {
  name: "MEGA Parking",
  city: "Πειραιάς",
  address: "Μαυρομιχάλη 4, Πειραιάς 185 45",
  phone: "210 41 34 508",
  phoneHref: "+302104134508",
  email: "mparkingp@gmail.com",
  site: "https://megaparking.gr",
  hours: [
    "Δευτέρα – Παρασκευή: 06:30 – 22:30",
    "Σάββατο: 08:00 – 16:00",
    "Κυριακή: κλειστά",
  ],
} as const;

/**
 * Το λογότυπο ζει σε δημόσιο URL — τα email clients δεν αποδίδουν SVG.
 * Δύο εκδοχές, όπως ορίζει ο οδηγός: negative πάνω σε μπλε ή κόκκινο φόντο,
 * έγχρωμο πάνω σε λευκό. Και τα δύο 440px (2× για retina), εμφανίζονται στα 220.
 */
const CDN = "https://kolleris.b-cdn.net/megaparking/email";

/** Λευκό — για τη μπλε κεφαλίδα. */
export const LOGO_URL = process.env.EMAIL_LOGO_URL || `${CDN}/mp-logo-white-v2.png`;

/** Έγχρωμο — για λευκά φόντα (υποσέλιδο, ανοιχτές ενότητες). */
export const LOGO_COLOR_URL =
  process.env.EMAIL_LOGO_COLOR_URL || `${CDN}/mp-logo-colour-v2.png`;

/** Πλάτος περιεχομένου: 600 px, το ασφαλές πρότυπο για κάθε client. */
export const CONTENT_WIDTH = 600;
