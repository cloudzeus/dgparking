"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, LogIn } from "lucide-react";

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: 20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6 }
      )
        .fromTo(
          titleRef.current,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.8 },
          "-=0.3"
        )
        .fromTo(
          subtitleRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6 },
          "-=0.4"
        )
        .fromTo(
          buttonsRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5 },
          "-=0.3"
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-20"
    >
      <div className="mx-auto max-w-4xl text-center">
        <div ref={badgeRef} className="mb-6 inline-block opacity-0">
          <Badge
            variant="secondary"
            className="gap-1.5 px-4 py-2 text-sm font-medium shadow-lg"
          >
            <Sparkles className="h-4 w-4" />
            NEXT.JS 16 BOILERPLATE
          </Badge>
        </div>

        <h1
          ref={titleRef}
          className="mb-6 text-5xl font-bold tracking-tight text-foreground opacity-0 sm:text-6xl md:text-7xl"
        >
          BUILD SOMETHING{" "}
          <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
            AMAZING
          </span>
        </h1>

        <p
          ref={subtitleRef}
          className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground opacity-0 sm:text-xl"
        >
          A production-ready starter template with Next.js 16, Tailwind CSS 4.1,
          Prisma ORM, shadcn/ui components, and GSAP animations. Everything you
          need to build modern web applications.
        </p>

        <div
          ref={buttonsRef}
          className="flex flex-col items-center justify-center gap-4 opacity-0 sm:flex-row"
        >
          <Button size="lg" className="gap-2 px-8 shadow-lg">
            GET STARTED
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Link href="/login">
            <Button size="lg" variant="outline" className="gap-2 px-8">
              <LogIn className="h-4 w-4" />
              LOGIN
            </Button>
          </Link>
          <Button size="lg" variant="ghost" className="px-8">
            VIEW DOCUMENTATION
          </Button>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute left-1/4 top-1/4 -z-10 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
    </section>
  );
}

