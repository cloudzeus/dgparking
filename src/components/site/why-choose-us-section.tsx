"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Shield, Car, Droplet, Headphones } from "lucide-react";

/**
 * «Γιατί MEGA Parking» — οι κάρτες του megaparking.gr.
 *
 * Client component μόνο για την κίνηση (εμφάνιση με το scroll και ανασήκωμα
 * στο hover). Το χρώμα κάθε κάρτας ζει σε δύο CSS μεταβλητές, ώστε το
 * gradient του hover να γράφεται μία φορά στο Tailwind.
 */
const POINTS = [
  { key: "location", icon: MapPin, from: "var(--mega-blue)", to: "#3b82f6" },
  { key: "security", icon: Shield, from: "#16a34a", to: "#22c55e" },
  { key: "space", icon: Car, from: "#9333ea", to: "#a855f7" },
  { key: "support", icon: Headphones, from: "var(--mega-red)", to: "#f97316" },
] as const;

export function WhyChooseUsSection() {
  const t = useTranslations("whyChooseUs");
  const reduceMotion = useReducedMotion();

  return (
    <section id="about" className="scroll-mt-20 bg-background" aria-labelledby="why-choose-heading">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 id="why-choose-heading" className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("description")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {POINTS.map(({ key, icon: Icon, from, to }, index) => (
            <motion.div
              key={key}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.08 }}
              whileHover={reduceMotion ? undefined : { y: -8 }}
              className="h-full"
            >
              <div
                style={
                  {
                    "--accent-from": from,
                    "--accent-to": to,
                  } as React.CSSProperties
                }
                className="group flex h-full flex-col rounded-xl border bg-card p-6 text-card-foreground transition-colors duration-300 md:p-8 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent-from)_6%,var(--card)),color-mix(in_oklab,var(--accent-to)_12%,var(--card)))] hover:text-white hover:bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))]"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-white/20 group-hover:text-white">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="text-lg font-bold">{t(`${key}.title`)}</h3>
                </div>
                <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-white/90">
                  {t(`${key}.description`)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
