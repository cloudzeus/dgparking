import { getFormatter, getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CarWashBookingDialog } from "./car-wash-booking-dialog";
import { WASH_PACKAGES } from "./packages";

/** Τα πακέτα πλυσίματος με τιμή, περιεχόμενο και κουμπί κράτησης. */
export async function CarWashPackages() {
  const t = await getTranslations("carWash.packages");
  const formatter = await getFormatter();

  return (
    <section
      id="packages"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:py-20"
      aria-labelledby="car-wash-packages-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="car-wash-packages-heading" className="text-3xl font-bold tracking-tight">
          {t("title")}
        </h2>
        <p className="mt-3 text-muted-foreground">{t("description")}</p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {WASH_PACKAGES.map((pkg) => (
          <Card key={pkg.key} className="relative h-full">
            {pkg.featured ? (
              <Badge className="absolute end-4 top-4 bg-mega-red text-white">{t("popular")}</Badge>
            ) : null}
            <CardHeader>
              <CardTitle className="text-xl">{t(`${pkg.key}.title`)}</CardTitle>
              <p className="text-2xl font-bold">
                {formatter.number(pkg.price, {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })}
              </p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-mega-red" aria-hidden />
                    <span>{t(`${pkg.key}.features.${feature}`)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <CarWashBookingDialog defaultService={pkg.key} className="w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
