"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Check } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Επιλογέας γλώσσας: κρατά τη σελίδα και αλλάζει μόνο το πρόθεμα της διαδρομής. */
export function LanguageSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("language")} title={t("language")}>
          <Globe aria-hidden />
          {localeNames[locale].short}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {routing.locales.map((value) => (
            <DropdownMenuItem
              key={value}
              onClick={() =>
                router.replace(
                  // @ts-expect-error — οι δυναμικές παράμετροι της τρέχουσας διαδρομής
                  { pathname, params },
                  { locale: value }
                )
              }
            >
              {value === locale ? <Check aria-hidden /> : <span className="size-4" aria-hidden />}
              {localeNames[value].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
