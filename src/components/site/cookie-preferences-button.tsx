"use client";

import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openCookiePreferences } from "@/lib/cookie-consent";

/**
 * Ξανανοίγει την ειδοποίηση cookie στις ρυθμίσεις. Η ανάκληση πρέπει να
 * είναι εξίσου εύκολη με τη συγκατάθεση (άρ. 7 §3) — γι' αυτό υπάρχει και
 * στο υποσέλιδο και στη σελίδα των cookies.
 */
export function CookiePreferencesButton({
  label,
  variant = "outline",
  className,
}: {
  label: string;
  variant?: "default" | "outline" | "ghost" | "link";
  className?: string;
}) {
  return (
    <Button type="button" variant={variant} className={className} onClick={openCookiePreferences}>
      <Cookie aria-hidden />
      {label}
    </Button>
  );
}
