import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

/** Τα τρία πακέτα πλυσίματος, με σύνδεσμο στη σελίδα /car-wash. */
const PACKAGES = [
  { key: "basic", popular: false },
  { key: "premium", popular: true },
  { key: "deluxe", popular: false },
] as const;

export async function CarWashSection() {
  const t = await getTranslations("carWashServices");

  return (
    <section id="car-wash" className="scroll-mt-20 border-y bg-muted/40" aria-labelledby="car-wash-heading">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 id="car-wash-heading" className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("description")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PACKAGES.map(({ key, popular }) => {
            const features = t.raw(`${key}.features`) as string[];

            return (
              <Card key={key} className="relative flex h-full flex-col overflow-hidden pt-0">
                {popular && (
                  <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground">{t("popular")}</Badge>
                )}

                <div className="border-b px-6 py-8 text-center">
                  <h3 className="text-xl font-semibold">{t(`${key}.title`)}</h3>
                  <p className="mt-1 text-3xl font-bold">{t(`${key}.price`)}</p>
                </div>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/car-wash">{t("cta")}</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
