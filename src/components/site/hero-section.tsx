import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Hero του δημόσιου site: βίντεο φόντο με το μπλε της μάρκας από πάνω,
 * όπως στο megaparking.gr.
 */
export async function HeroSection() {
  const t = await getTranslations("hero");

  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-heading">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/images/MEGAParkingLogoWide.svg"
        className="absolute inset-0 -z-20 size-full object-cover"
        aria-hidden
      >
        <source src="https://kolleris.b-cdn.net/megaparking/bg.mp4" type="video/mp4" />
      </video>
      {/* Το μπλε της μάρκας πάνω από το βίντεο, ώστε το κείμενο να διαβάζεται. */}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--mega-blue),rgba(23,40,91,0.82))]"
        aria-hidden
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 py-24 text-center text-white sm:py-32">
        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
          {t("badge")}
        </span>

        <h1 id="hero-heading" className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          {t("title")}
          <span className="mt-2 block text-3xl font-semibold sm:text-4xl md:text-5xl">{t("subtitle")}</span>
        </h1>

        <p className="max-w-2xl text-base text-white/85 sm:text-lg">{t("description")}</p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-mega-red text-white hover:brightness-110">
            <NextLink href="/register">
              {t("primaryCta")}
              <ArrowRight aria-hidden />
            </NextLink>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <NextLink href="/login">
              <LogIn aria-hidden />
              {t("secondaryCta")}
            </NextLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
