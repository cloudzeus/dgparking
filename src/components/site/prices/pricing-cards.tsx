"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bike, Car, Check, Clock, Moon, Star, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ICONS = { clock: Clock, sun: Sun, moon: Moon, car: Car, bike: Bike } as const;

export type PricingPackage = {
  key: string;
  icon: keyof typeof ICONS;
  title: string;
  description: string;
  features: string[];
  price: string;
  unit: string | null;
  popular: boolean;
};

/**
 * Οι κάρτες των πακέτων. Client component μόνο για την κίνηση στο hover /
 * στο scroll — το κείμενο και οι τιμές έρχονται έτοιμα από τον server.
 */
export function PricingCards({
  packages,
  popularLabel,
}: {
  packages: PricingPackage[];
  popularLabel: string;
}) {
  // Σεβασμός στο prefers-reduced-motion: χωρίς μετακίνηση, μόνο εμφάνιση.
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {packages.map((plan, index) => {
        const Icon = ICONS[plan.icon];

        return (
          <motion.div
            key={plan.key}
            className="h-full"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.08 }}
            whileHover={reduceMotion ? undefined : { y: -8 }}
          >
            <Card
              className={cn(
                "relative h-full transition-shadow hover:shadow-lg",
                plan.popular && "border-mega-red ring-1 ring-mega-red/40"
              )}
            >
              {plan.popular && (
                <Badge className="absolute top-4 right-4 gap-1 bg-mega-red text-white">
                  <Star className="size-3" aria-hidden />
                  {popularLabel}
                </Badge>
              )}

              <CardHeader>
                <span className="mb-1 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle className="pr-20 text-xl">{plan.title}</CardTitle>
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">{plan.price}</span>
                  {plan.unit && <span className="text-sm text-muted-foreground">{plan.unit}</span>}
                </p>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
