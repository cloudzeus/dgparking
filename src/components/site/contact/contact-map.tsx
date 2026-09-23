import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAP_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3146.1668880098377!2d23.639887777100668!3d37.94988907194195!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14a1bbc045e4544f%3A0x382fe80814087512!2zUGFya2luZyDOm865zrzOrM69zrkgzqDOtc65z4HOsc65zqwgLSBNZWdhIFBhcmtpbmcgfCDOnM6tzrvOv8-CIM6UzrnOus-Ez43Ov8-FIFBhcmtBcm91bmQ!5e0!3m2!1sel!2sgr!4v1743141871331!5m2!1sel!2sgr";

/** Ο χάρτης της Google και οι οδηγίες πρόσβασης. */
export async function ContactMap() {
  const t = await getTranslations("contact");

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden py-0">
        <CardContent className="h-[420px] p-0 lg:h-[560px]">
          <iframe
            src={MAP_SRC}
            title={t("map.title")}
            aria-label={t("map.ariaLabel")}
            className="size-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">{t("directions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground">
          <p>{t("directions.paragraph1")}</p>
          <p>{t("directions.paragraph2")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
