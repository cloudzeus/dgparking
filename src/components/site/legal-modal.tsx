"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LegalDocument = "privacyPolicy" | "termsOfService";

/**
 * Πολιτική απορρήτου / Όροι χρήσης, όπως στο megaparkingsite: τίτλος,
 * ημερομηνία ισχύος, εισαγωγή και ενότητες με λίστες.
 */
export function LegalModal({
  document,
  open,
  onOpenChange,
}: {
  document: LegalDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations(`legal.${document}`);
  const sections = t.raw("sections") as Record<string, { title: string; content: string[] }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("effectiveDate")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">{t("intro")}</p>

          {Object.entries(sections).map(([key, section]) => (
            <section key={key} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {section.content.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
