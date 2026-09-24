import { getTranslations } from "next-intl/server";
import { Languages } from "lucide-react";

/**
 * Ήσυχη σημείωση όταν το κείμενο που βλέπει ο επισκέπτης παρήχθη αυτόματα.
 * Δεν είναι προειδοποίηση — είναι ειλικρίνεια για την προέλευση του κειμένου.
 */
export async function MachineTranslationNotice() {
  const t = await getTranslations("cms");

  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{t("machineTranslated")}</span>
    </p>
  );
}
