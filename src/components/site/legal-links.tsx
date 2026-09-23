"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LegalModal } from "@/components/site/legal-modal";

/** Οι δύο νομικοί σύνδεσμοι του υποσέλιδου — ανοίγουν σε παράθυρο. */
export function LegalLinks() {
  const t = useTranslations("legal");
  const [open, setOpen] = useState<"privacyPolicy" | "termsOfService" | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen("privacyPolicy")}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("privacyPolicy.title")}
        </button>
        <button
          type="button"
          onClick={() => setOpen("termsOfService")}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("termsOfService.title")}
        </button>
      </div>

      <LegalModal
        document={open ?? "privacyPolicy"}
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
      />
    </>
  );
}
