import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export async function CtaSection() {
  const t = await getTranslations("cta");

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-primary px-6 py-12 text-center text-primary-foreground">
        <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h2>
        <p className="max-w-2xl text-primary-foreground/85">{t("description")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-mega-red text-white hover:brightness-110">
            <NextLink href="/register">
              {t("primary")}
              <ArrowRight aria-hidden />
            </NextLink>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <a href="mailto:info@megaparking.gr">
              <Mail aria-hidden />
              {t("secondary")}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
