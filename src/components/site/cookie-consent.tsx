"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  ALLOW_ALL,
  COOKIE_CONSENT_OPEN_EVENT,
  DENY_ALL,
  readCookiePreferences,
  writeCookiePreferences,
  type CookieCategory,
} from "@/lib/cookie-consent";

type Choice = Record<CookieCategory, boolean>;

/** Η τιμή δεν αλλάζει όσο ζει η σελίδα — δεν χρειάζεται συνδρομή. */
const subscribeToNothing = () => () => {};

/**
 * Ειδοποίηση cookie με τρεις κατηγορίες: απαραίτητα (πάντα ενεργά, χωρίς
 * συγκατάθεση), στατιστικά και μάρκετινγκ.
 *
 * Η επιλογή μένει στη συσκευή του επισκέπτη για τη διεπαφή, αλλά στέλνεται
 * και στη βάση ως `ConsentLog` — εκεί ζει η νομική απόδειξη, μαζί με το
 * ακριβές κείμενο που είχε μπροστά του.
 */
export function CookieConsent() {
  const t = useTranslations("gdpr.banner");
  const tCategories = useTranslations("gdpr.cookies.categories");
  const locale = useLocale();

  // Πρώτη απόδοση στον server και στην ενυδάτωση: τίποτα. Μετά διαβάζεται η
  // επιλογή του επισκέπτη — χωρίς setState μέσα σε effect.
  const isHydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const stored = useMemo(() => (isHydrated ? readCookiePreferences() : null), [isHydrated]);

  const [reopened, setReopened] = useState(false);
  const [decided, setDecided] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);

  // Ξανάνοιγμα από το υποσέλιδο ή τη σελίδα cookies — πάντα στις ρυθμίσεις.
  useEffect(() => {
    const reopen = () => {
      setChoice(readCookiePreferences() ?? DENY_ALL);
      setShowSettings(true);
      setDismissed(false);
      setReopened(true);
    };
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, reopen);
  }, []);

  // Ανοιχτό όταν ο επισκέπτης δεν έχει αποφασίσει ακόμη, ή όταν ζήτησε ο
  // ίδιος τις ρυθμίσεις.
  const isOpen = isHydrated && !dismissed && (reopened || (!stored && !decided));
  const current: Choice = choice ?? { analytics: stored?.analytics ?? false, marketing: stored?.marketing ?? false };

  /** Το ακριβές κείμενο που είδε ο επισκέπτης, όπως θα σταθεί σε έλεγχο. */
  const consentTextFor = useCallback(
    (buttonLabel: string, settings: boolean) => {
      const lines = settings
        ? [
            t("settingsTitle"),
            t("settingsDescription"),
            `${tCategories("necessary.name")} — ${tCategories("necessary.description")}`,
            `${tCategories("analytics.name")} — ${tCategories("analytics.description")}`,
            `${tCategories("marketing.name")} — ${tCategories("marketing.description")}`,
          ]
        : [t("title"), t("description")];
      return [...lines, `[${buttonLabel}]`].join(" ");
    },
    [t, tCategories],
  );

  const decide = useCallback(
    async (next: Choice, buttonLabel: string, settings: boolean) => {
      writeCookiePreferences({ ...next, decidedAt: new Date().toISOString() });
      setChoice(next);
      setDecided(true);
      setReopened(false);
      setShowSettings(false);

      try {
        await fetch("/api/gdpr/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...next,
            consentText: consentTextFor(buttonLabel, settings),
            locale,
          }),
        });
      } catch (error) {
        // Η επιλογή ισχύει ήδη στη συσκευή· η καταγραφή θα ξαναγίνει την
        // επόμενη φορά που θα την αλλάξει.
        console.error("Could not record the cookie choice:", error);
      }
    },
    [consentTextFor, locale],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="relative mx-auto max-w-3xl rounded-lg bg-mega-blue p-6 text-white shadow-lg">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDismissed(true)}
          aria-label={t("close")}
          title={t("close")}
          className="absolute end-3 top-3 text-white hover:bg-white/10 hover:text-white"
        >
          <X aria-hidden />
        </Button>

        <h2 className="mb-2 pe-8 text-base font-semibold">
          {showSettings ? t("settingsTitle") : t("title")}
        </h2>
        <p className="mb-4 text-sm text-white/85">
          {showSettings ? t("settingsDescription") : t("description")}
        </p>

        {showSettings && (
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{tCategories("necessary.name")}</p>
                <p className="text-xs text-white/75">{tCategories("necessary.description")}</p>
              </div>
              <Switch checked disabled aria-label={tCategories("necessary.name")} />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="cookie-analytics" className="text-sm font-medium">
                  {tCategories("analytics.name")}
                </Label>
                <p className="text-xs text-white/75">{tCategories("analytics.description")}</p>
              </div>
              <Switch
                id="cookie-analytics"
                checked={current.analytics}
                onCheckedChange={(checked) => setChoice({ ...current, analytics: checked })}
              />
            </div>

            <Separator className="bg-white/20" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="cookie-marketing" className="text-sm font-medium">
                  {tCategories("marketing.name")}
                </Label>
                <p className="text-xs text-white/75">{tCategories("marketing.description")}</p>
              </div>
              <Switch
                id="cookie-marketing"
                checked={current.marketing}
                onCheckedChange={(checked) => setChoice({ ...current, marketing: checked })}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {showSettings ? (
            <Button
              onClick={() => decide(current, t("save"), true)}
              className="bg-mega-red text-white hover:brightness-110"
            >
              {t("save")}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => decide(ALLOW_ALL, t("acceptAll"), false)}
                className="bg-mega-red text-white hover:brightness-110"
              >
                {t("acceptAll")}
              </Button>
              <Button
                variant="outline"
                onClick={() => decide(DENY_ALL, t("necessaryOnly"), false)}
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {t("necessaryOnly")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowSettings(true)}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                {t("settings")}
              </Button>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            {t("privacyLink")}
          </Link>
          <Link href="/cookies" className="underline-offset-4 hover:underline">
            {t("cookiesLink")}
          </Link>
        </div>
      </div>
    </div>
  );
}
