import Image from "next/image";
import { getTranslations } from "next-intl/server";

const ESPA_PDF = "https://kolleris.b-cdn.net/megaparking/espa.pdf";

/**
 * Το πανό ΕΣΠΑ/ΕΕ, καρφιτσωμένο κάτω αριστερά (κρύβεται στα κινητά).
 *
 * Στο megaparkingsite κάθεται στο μέσο της αριστερής πλευράς, όπου σκεπάζει
 * κείμενο και κουμπιά. Κάτω αριστερά μένει ορατό χωρίς να πιάνει τα κλικ.
 */
export async function EuBanner() {
  const t = await getTranslations("euBanner");

  return (
    <div
      className="fixed bottom-4 left-0 z-40 hidden md:block"
      role="complementary"
      aria-label={t("region")}
    >
      <div className="overflow-hidden rounded-r-md border border-l-0 bg-card shadow-md">
        <a
          href={ESPA_PDF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("label")}
          className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Image src="/images/banner_espa.png" alt={t("alt")} width={350} height={61} className="h-auto w-[350px]" />
        </a>
      </div>
    </div>
  );
}
