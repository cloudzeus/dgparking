import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { ProposalRequestDialog } from "@/components/site/proposal-request-dialog";

/** Εταιρική στάθμευση: τα οφέλη και το αίτημα προσφοράς. */
export async function BusinessSolutionsSection() {
  const t = await getTranslations("business");
  const points = t.raw("points") as string[];

  return (
    <section
      id="business"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:py-20"
      aria-labelledby="business-heading"
    >
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <h2 id="business-heading" className="text-3xl font-bold tracking-tight">
          {t("title")}
        </h2>
        <p className="mt-3 text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="order-2 rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8 lg:order-1">
          <h3 className="text-2xl font-bold tracking-tight">{t("corporateTitle")}</h3>

          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="text-muted-foreground">{point}</span>
              </li>
            ))}
          </ul>

          <ProposalRequestDialog />
        </div>

        <div className="relative order-1 h-[300px] overflow-hidden rounded-xl border bg-muted lg:order-2 lg:h-[400px]">
          <Image
            src="https://kolleris.b-cdn.net/megaparking/business.svg"
            alt={t("imageAlt")}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-contain p-4"
          />
        </div>
      </div>
    </section>
  );
}
