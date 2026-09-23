"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegalModal } from "@/components/site/legal-modal";

const STORAGE_KEY = "cookie-consent";

/** Η τιμή δεν αλλάζει όσο ζει η σελίδα — δεν χρειάζεται συνδρομή. */
const subscribeToNothing = () => () => {};

/**
 * Ειδοποίηση cookie του δημόσιου site. Η επιλογή μένει στον browser του
 * επισκέπτη (localStorage) — δεν φεύγει από τη συσκευή του.
 */
export function CookieConsent() {
  const t = useTranslations("legal.cookies");
  const tLegal = useTranslations("legal");
  // Πρώτη απόδοση στον server και στην ενυδάτωση: τίποτα. Μετά διαβάζεται η
  // επιλογή του επισκέπτη — χωρίς setState μέσα σε effect.
  const isHydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  const hasConsent = useMemo(() => {
    if (!isHydrated) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      // Ιδιωτική περιήγηση ή αποκλεισμένη αποθήκευση: δεν δείχνουμε τίποτα.
      return true;
    }
  }, [isHydrated]);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Αν δεν μπορεί να αποθηκευτεί, απλώς κλείνει για αυτή την επίσκεψη.
    }
    setIsDismissed(true);
  };

  if (!isHydrated || hasConsent || isDismissed) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 p-4">
        <div className="relative mx-auto max-w-3xl rounded-lg bg-mega-blue p-6 text-white shadow-lg">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsDismissed(true)}
            aria-label={t("close")}
            title={t("close")}
            className="absolute end-3 top-3 text-white hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden />
          </Button>

          <h2 className="mb-2 text-base font-semibold">{t("title")}</h2>
          <p className="mb-4 text-sm text-white/85">{t("description")}</p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={accept} className="bg-mega-red text-white hover:brightness-110">
              {t("accept")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsPrivacyOpen(true)}
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              {tLegal("privacyPolicy.title")}
            </Button>
          </div>
        </div>
      </div>

      <LegalModal document="privacyPolicy" open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen} />
    </>
  );
}
