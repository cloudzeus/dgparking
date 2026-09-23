import { getTranslations } from "next-intl/server";
import { Camera, DoorOpen, FileText, LayoutDashboard, Database, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  { key: "lpr", icon: Camera },
  { key: "access", icon: DoorOpen },
  { key: "contracts", icon: FileText },
  { key: "dashboard", icon: LayoutDashboard },
  { key: "erp", icon: Database },
  { key: "reports", icon: BarChart3 },
] as const;

export async function FeaturesSection() {
  const t = await getTranslations("features");

  return (
    <section id="services" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("description")}</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon: Icon }) => (
          <Card key={key} className="h-full">
            <CardHeader>
              <span className="mb-1 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <CardTitle>{t(`${key}.title`)}</CardTitle>
              <CardDescription>{t(`${key}.description`)}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </section>
  );
}
