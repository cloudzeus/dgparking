import { getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Διεύθυνση, τηλέφωνο, email και ωράριο — όλα από τον server. */
export async function ContactInfo() {
  const t = await getTranslations("contact.info");

  return (
    <Card>
      <CardHeader>
        <CardTitle id="contact-info-heading" className="text-2xl font-bold">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 size-5 shrink-0 text-mega-red" aria-hidden />
          <div>
            <h3 className="font-medium">{t("addressLabel")}</h3>
            <p className="text-muted-foreground">
              {t("addressLine1")}
              <br />
              {t("addressLine2")}
              <br />
              {t("addressLine3")}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Phone className="mt-1 size-5 shrink-0 text-mega-red" aria-hidden />
          <div>
            <h3 className="font-medium">{t("phoneLabel")}</h3>
            <p className="text-muted-foreground">
              <a
                href={`tel:${t("phone").replace(/\s/g, "")}`}
                className="transition-colors hover:text-foreground"
              >
                {t("phone")}
              </a>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Mail className="mt-1 size-5 shrink-0 text-mega-red" aria-hidden />
          <div>
            <h3 className="font-medium">{t("emailLabel")}</h3>
            <p className="text-muted-foreground">
              <a href={`mailto:${t("email")}`} className="transition-colors hover:text-foreground">
                {t("email")}
              </a>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="mt-1 size-5 shrink-0 text-mega-red" aria-hidden />
          <div>
            <h3 className="font-medium">{t("hoursLabel")}</h3>
            <div className="text-muted-foreground">
              <p>{t("hoursWeekdays")}</p>
              <p>{t("hoursSaturday")}</p>
              <p>{t("hoursSunday")}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
