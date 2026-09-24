"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Shield, Car, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * «Γιατί MEGA Parking».
 *
 * ΓΙΑΤΙ ΑΣΥΜΜΕΤΡΟ ΚΑΙ ΟΧΙ ΠΛΕΓΜΑ ΙΣΩΝ ΚΑΡΤΩΝ
 * Τέσσερις πανομοιότυπες κάρτες σε σειρά λένε στον επισκέπτη ότι και τα
 * τέσσερα είναι εξίσου σημαντικά — δηλαδή τίποτα δεν είναι. Δεν υπάρχει
 * ιεραρχία, το μάτι σαρώνει και δεν κρατά κανένα. Εδώ η τοποθεσία, που είναι
 * ο πραγματικός λόγος που κάποιος διαλέγει αυτό το πάρκινγκ, παίρνει διπλό
 * χώρο και σκούρο φόντο· τα υπόλοιπα υποστηρίζουν.
 *
 * Ο τίτλος είναι αριστερά και όχι κεντραρισμένος, για τον ίδιο λόγο: τρεις
 * σερί κεντραρισμένοι τίτλοι είναι η υπογραφή του προτύπου.
 */
const POINTS = [
  { key: "location", icon: MapPin, feature: true },
  { key: "security", icon: Shield, feature: false },
  { key: "space", icon: Car, feature: false },
  { key: "support", icon: Headphones, feature: false },
] as const;

export function WhyChooseUsSection() {
  const t = useTranslations("whyChooseUs");
  const reduceMotion = useReducedMotion();

  return (
    <section id="about" className="scroll-mt-20 bg-background" aria-labelledby="why-choose-heading">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-24">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mega-red)]">
            {t("eyebrow")}
          </p>
          <h2 id="why-choose-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("description")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POINTS.map(({ key, icon: Icon, feature }, index) => (
            <motion.div
              key={key}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.07 }}
              className={cn(feature && "sm:col-span-2 lg:row-span-2")}
            >
              <div
                className={cn(
                  "group flex h-full flex-col rounded-2xl border p-6 transition-all duration-300",
                  "hover:-translate-y-1 hover:shadow-lg",
                  feature
                    ? "border-transparent bg-[var(--mega-blue)] p-8 text-white lg:justify-end"
                    : "border-border bg-card text-card-foreground hover:border-[var(--mega-red)]/40"
                )}
              >
                <span
                  className={cn(
                    "mb-4 flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                    feature
                      ? "bg-white/10 text-white"
                      : "bg-[var(--mega-red)]/10 text-[var(--mega-red)] group-hover:bg-[var(--mega-red)] group-hover:text-white"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className={cn("font-bold", feature ? "text-2xl sm:text-3xl" : "text-lg")}>
                  {t(`${key}.title`)}
                </h3>
                <p
                  className={cn(
                    "mt-2 text-sm leading-relaxed",
                    feature ? "max-w-md text-base text-white/75" : "text-muted-foreground"
                  )}
                >
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
