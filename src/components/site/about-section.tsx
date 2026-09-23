import { getTranslations } from "next-intl/server";
import { MapPin, ShieldCheck, Car, Headset } from "lucide-react";

const POINTS = [
  { key: "location", icon: MapPin },
  { key: "security", icon: ShieldCheck },
  { key: "space", icon: Car },
  { key: "support", icon: Headset },
] as const;

export async function AboutSection() {
  const t = await getTranslations("about");

  return (
    <section id="about" className="scroll-mt-20 border-y bg-muted/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("description")}</p>
        </div>

        <dl className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ key, icon: Icon }) => (
            <div key={key} className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <dt className="text-base font-semibold">{t(`${key}.title`)}</dt>
              <dd className="text-sm text-muted-foreground">{t(`${key}.description`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
