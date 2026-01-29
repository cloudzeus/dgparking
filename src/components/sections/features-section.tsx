"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Database,
  Palette,
  Zap,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Zap,
    title: "NEXT.JS 16",
    description:
      "Built on the latest Next.js with App Router, Server Components, and Turbopack for blazing fast development.",
  },
  {
    icon: Palette,
    title: "TAILWIND CSS 4.1",
    description:
      "Modern styling with Tailwind CSS v4.1, featuring CSS-first configuration and improved performance.",
  },
  {
    icon: Database,
    title: "PRISMA ORM",
    description:
      "Type-safe database access with Prisma ORM, configured for MySQL with intuitive schema management.",
  },
  {
    icon: Layers,
    title: "SHADCN/UI",
    description:
      "Beautiful, accessible UI components built with Radix UI and styled with Tailwind CSS.",
  },
  {
    icon: Sparkles,
    title: "GSAP ANIMATIONS",
    description:
      "Professional-grade animations with GSAP for smooth, performant transitions and interactions.",
  },
  {
    icon: Shield,
    title: "TYPESCRIPT",
    description:
      "Full TypeScript support throughout the codebase for type safety and better developer experience.",
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.children;

      if (cards) {
        gsap.fromTo(
          cards,
          {
            opacity: 0,
            y: 60,
            scale: 0.95,
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              end: "bottom 20%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative px-4 py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            EVERYTHING YOU NEED
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            A carefully curated stack of modern technologies to accelerate your
            development workflow.
          </p>
        </div>

        <div
          ref={cardsRef}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="group relative overflow-hidden bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <CardHeader className="relative">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
                    <Icon className="h-6 w-6 text-violet-600" />
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

