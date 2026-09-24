import Image from "next/image";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { MapPin, Clock, LogIn } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CookiePreferencesButton } from "@/components/site/cookie-preferences-button";
import { NewsletterSignup } from "@/components/site/newsletter-signup";

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Image
            src="/images/MEGAParkingLogoWide.svg"
            alt="MEGA Parking"
            width={180}
            height={44}
            className="h-9 w-auto"
          />
          <p className="text-sm text-muted-foreground">{t("hero.description")}</p>
        </div>

        <nav className="flex flex-col gap-2" aria-label={t("footer.quickLinks")}>
          <h2 className="text-sm font-semibold">{t("footer.quickLinks")}</h2>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t("nav.home")}
          </Link>
          <Link href="/prices" className="text-sm text-muted-foreground hover:text-foreground">
            {t("nav.prices")}
          </Link>
          <Link href="/news" className="text-sm text-muted-foreground hover:text-foreground">
            {t("nav.news")}
          </Link>
          <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground">
            {t("nav.contact")}
          </Link>
          <NextLink href="/login" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <LogIn className="size-3.5" aria-hidden />
            {t("nav.customerPortal")}
          </NextLink>
        </nav>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t("footer.contact")}</h2>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("site.address")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4" aria-hidden />
            {t("site.workingHours")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("site.workingHoursWeekday")}</p>
          <p className="text-sm text-muted-foreground">{t("site.workingHoursSaturday")}</p>
          <p className="text-sm text-muted-foreground">{t("site.workingHoursSunday")}</p>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">
          <div className="max-w-xl">
            <NewsletterSignup />
          </div>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} {t("site.name")}. {t("footer.rights")}
          </p>
          {/* Οι νομικές σελίδες είναι πραγματικές σελίδες — με δική τους
              διεύθυνση, ώστε να μπορεί κανείς να τις στείλει ή να τις
              τυπώσει. Δίπλα τους, το κουμπί που ξανανοίγει τις ρυθμίσεις
              cookie: η ανάκληση πρέπει να είναι εξίσου εύκολη (άρ. 7 §3). */}
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
            aria-label={t("gdpr.nav.privacy")}
          >
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("gdpr.nav.privacy")}
            </Link>
            <Link
              href="/terms"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("gdpr.nav.terms")}
            </Link>
            <Link
              href="/cookies"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("gdpr.nav.cookies")}
            </Link>
            <Link
              href="/data-rights"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("gdpr.nav.dataRights")}
            </Link>
            <CookiePreferencesButton
              label={t("gdpr.banner.settings")}
              variant="link"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            />
          </nav>
        </div>
      </div>
    </footer>
  );
}
