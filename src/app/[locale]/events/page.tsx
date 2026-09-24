import Image from "next/image";
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EventRfpDialog } from "@/components/site/event-rfp-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BadgeEuro,
  CalendarClock,
  Camera,
  CircleParking,
  Clock,
  FileText,
  Ship,
  SquareParking,
  Users,
  Zap,
} from "lucide-react";

const CDN = "https://kolleris.b-cdn.net/site/events";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "events.meta" });
  return { title: t("title"), description: t("description") };
}

/**
 * Σελίδα «Στάθμευση για εκδηλώσεις».
 *
 * ΡΥΘΜΟΣ
 * Κάθε ενότητα έχει διαφορετικό σχήμα — φωτογραφικό hero, σκούρα ζώνη
 * αριθμών, ασύμμετρο bento, αριθμημένα βήματα, λίστα περιπτώσεων, ερωτήσεις.
 * Το επαναλαμβανόμενο «κεντραρισμένος τίτλος + πλέγμα καρτών» είναι ακριβώς
 * αυτό που κάνει μια σελίδα να μοιάζει με πρότυπο.
 *
 * Η φόρμα ζει σε modal και ανοίγει από τρία σημεία: hero, μέση, τέλος. Ένας
 * επισκέπτης που πείστηκε στη μέση δεν πρέπει να ψάχνει πού να πατήσει.
 */
export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("events");

  const stats = [
    { key: "capacity", icon: SquareParking },
    { key: "port", icon: Ship },
    { key: "hours", icon: Camera },
    { key: "response", icon: Clock },
  ] as const;

  // Το `feature` δηλώνεται σε όλα: αλλιώς ο τύπος της ένωσης δεν το έχει
  // παντού και η πρόσβαση σπάει στο build.
  const benefits = [
    { key: "reserved", icon: CircleParking, feature: true },
    { key: "price", icon: BadgeEuro, feature: false },
    { key: "access", icon: Zap, feature: false },
    { key: "staff", icon: Users, feature: false },
    { key: "security", icon: Camera, feature: false },
    { key: "invoice", icon: FileText, feature: false },
  ] as const;

  const cases = ["wedding", "corporate", "cruise", "concert", "filming", "fleet"] as const;
  const faqs = ["q1", "q2", "q3", "q4", "q5"] as const;

  return (
    <>
      {/* ── Hero: φωτογραφία με το μπλε της μάρκας από πάνω ─────────────── */}
      <section className="relative isolate overflow-hidden">
        <Image
          src={`${CDN}/events-hero.webp`}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,var(--mega-blue)_18%,rgba(23,40,91,0.86)_55%,rgba(23,40,91,0.55))]"
          aria-hidden
        />
        <div className="mx-auto w-full max-w-7xl px-4 py-24 text-white sm:py-32">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
              <CalendarClock className="size-3.5" aria-hidden />
              {t("hero.eyebrow")}
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 text-lg font-medium text-white/90 sm:text-xl">
              {t("hero.subtitle")}
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
              {t("hero.body")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <EventRfpDialog>
                <Button size="lg" className="bg-mega-red text-white hover:brightness-110">
                  <CalendarClock aria-hidden />
                  {t("hero.cta")}
                </Button>
              </EventRfpDialog>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/prices">{t("hero.secondary")}</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-white/55">{t("hero.note")}</p>
          </div>
        </div>
      </section>

      {/* ── Ζώνη αριθμών ──────────────────────────────────────────────── */}
      <section className="border-b bg-muted/40" aria-label={t("stats.eyebrow")}>
        <div className="mx-auto w-full max-w-7xl px-4 py-10">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("stats.eyebrow")}
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            {stats.map(({ key, icon: Icon }) => (
              <div key={key} className="border-l-2 border-[var(--mega-red)]/30 pl-4">
                <Icon className="mb-2 size-5 text-[var(--mega-red)]" aria-hidden />
                <dd className="text-3xl font-bold tabular-nums leading-none sm:text-4xl">
                  {t(`stats.${key}.value`)}
                </dd>
                <dt className="mt-1.5 text-sm text-muted-foreground">{t(`stats.${key}.label`)}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Τι περιλαμβάνει: ασύμμετρο bento ──────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-24">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mega-red)]">
            {t("benefits.eyebrow")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("benefits.title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("benefits.description")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ key, icon: Icon, feature }) => (
            <div
              key={key}
              className={
                feature
                  ? "group relative flex min-h-64 flex-col justify-end overflow-hidden rounded-2xl p-7 text-white sm:col-span-2 lg:row-span-2"
                  : "group rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--mega-red)]/40 hover:shadow-lg"
              }
            >
              {feature && (
                <>
                  <Image
                    src={`${CDN}/events-bays.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 66vw, 100vw"
                    className="-z-20 object-cover"
                  />
                  <div
                    className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(23,40,91,0.94),rgba(23,40,91,0.35))]"
                    aria-hidden
                  />
                </>
              )}
              <span
                className={
                  feature
                    ? "mb-4 flex size-12 items-center justify-center rounded-xl bg-white/15"
                    : "mb-4 flex size-11 items-center justify-center rounded-xl bg-[var(--mega-red)]/10 text-[var(--mega-red)] transition-colors group-hover:bg-[var(--mega-red)] group-hover:text-white"
                }
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className={feature ? "text-2xl font-bold sm:text-3xl" : "text-lg font-bold"}>
                {t(`benefits.${key}.title`)}
              </h3>
              <p
                className={
                  feature
                    ? "mt-2 max-w-md text-base leading-relaxed text-white/80"
                    : "mt-2 text-sm leading-relaxed text-muted-foreground"
                }
              >
                {t(`benefits.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Πώς γίνεται: φωτογραφία αριστερά, βήματα δεξιά ───────────── */}
      <section className="bg-muted/40">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl">
            <Image
              src={`${CDN}/events-arrival.webp`}
              alt={t("hero.eyebrow")}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mega-red)]">
              {t("how.eyebrow")}
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("how.title")}</h2>

            <ol className="mt-8 space-y-7">
              {(["step1", "step2", "step3"] as const).map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--mega-blue)] text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{t(`how.${step}.title`)}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {t(`how.${step}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <EventRfpDialog>
              <Button size="lg" className="mt-8">
                <CalendarClock aria-hidden />
                {t("hero.cta")}
              </Button>
            </EventRfpDialog>
          </div>
        </div>
      </section>

      {/* ── Ταιριάζει σε ──────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <div className="mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mega-red)]">
            {t("cases.eyebrow")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("cases.title")}</h2>
        </div>
        <ul className="flex flex-wrap gap-2.5">
          {cases.map((c) => (
            <li
              key={c}
              className="rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--mega-red)]/50 hover:text-[var(--mega-red)]"
            >
              {t(`cases.${c}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Ερωτήσεις ─────────────────────────────────────────────────── */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mega-red)]">
              {t("faq.eyebrow")}
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("faq.title")}</h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((q) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {t(`faq.${q}.q`)}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {t(`faq.${q}.a`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Τελικό κάλεσμα ────────────────────────────────────────────── */}
      <section className="bg-[var(--mega-blue)] text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("cta.title")}</h2>
            <p className="mt-3 text-white/75">{t("cta.description")}</p>
          </div>
          <EventRfpDialog>
            <Button size="lg" className="shrink-0 bg-mega-red text-white hover:brightness-110">
              <CalendarClock aria-hidden />
              {t("cta.button")}
            </Button>
          </EventRfpDialog>
        </div>
      </section>
    </>
  );
}
