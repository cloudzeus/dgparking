"use client";

import Image from "next/image";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { Menu, LogIn } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const routes = [
    { href: "/", label: t("home") },
    { href: "/prices", label: t("prices") },
    { href: "/news", label: t("news") },
    { href: "/contact", label: t("contact") },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden" aria-label={t("openMenu")}>
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>{t("menu")}</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4" aria-label={t("menu")}>
              {routes.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className="rounded-md px-2 py-2 text-sm font-medium hover:bg-accent"
                >
                  {route.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex shrink-0 items-center" aria-label="MEGA Parking">
          <Image
            src="/images/MEGAParkingLogoWide.svg"
            alt="MEGA Parking"
            width={180}
            height={44}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <nav className="ml-6 hidden items-center gap-6 md:flex" aria-label={t("menu")}>
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === route.href && "text-foreground"
              )}
            >
              {route.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          {/* Η πύλη πελατών ζει εκτός γλωσσικού προθέματος — `next/link`, όχι το i18n Link. */}
          <Button asChild size="sm">
            <NextLink href="/login">
              <LogIn aria-hidden />
              {t("login")}
            </NextLink>
          </Button>
        </div>
      </div>
    </header>
  );
}
