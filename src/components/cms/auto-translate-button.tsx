"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { autoTranslate } from "@/lib/actions/cms";
import { LOCALE_LABEL, type CmsEntity, type TranslatedFields } from "@/components/cms/types";
import type { Locale } from "@/i18n/routing";

/**
 * «Αυτόματη μετάφραση από …» — γεμίζει τα πεδία της καρτέλας με μηχανική
 * μετάφραση. Το αποτέλεσμα είναι πάντα ΠΡΟΣΧΕΔΙΟ: ο γονιός το σημειώνει ως
 * μηχανικό και δείχνει προειδοποίηση μέχρι να το ελέγξει άνθρωπος.
 */
export function AutoTranslateButton({
  entity,
  id,
  from,
  to,
  source,
  providerName,
  disabled,
  onTranslated,
}: {
  entity: CmsEntity;
  /** Κενό όταν η εγγραφή δεν έχει αποθηκευτεί ακόμη. */
  id: string | null;
  from: Locale;
  to: Locale;
  /** Το τρέχον περιεχόμενο της γλώσσας προέλευσης, όπως είναι στη φόρμα. */
  source: {
    title: string;
    excerpt: string;
    contentHtml: string;
    seoTitle: string;
    seoDescription: string;
  };
  /** Όνομα υπηρεσίας μετάφρασης· κενό σημαίνει «δεν έχει ρυθμιστεί». */
  providerName: string | null;
  disabled?: boolean;
  onTranslated: (fields: TranslatedFields) => void;
}) {
  const [pending, startTransition] = useTransition();

  const noProvider = !providerName;
  const noSource = !source.title.trim();

  const title = noProvider
    ? "Δεν έχει ρυθμιστεί υπηρεσία αυτόματης μετάφρασης (TRANSLATE_API_KEY ή DEEPSEEK_API_KEY)."
    : noSource
      ? `Συμπλήρωσε πρώτα τον τίτλο στην καρτέλα «${LOCALE_LABEL[from]}».`
      : `Μετάφραση του περιεχομένου από ${LOCALE_LABEL[from]} με ${providerName}.`;

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        title={title}
        disabled={pending || disabled || noProvider || noSource}
        onClick={() =>
          startTransition(async () => {
            const result = await autoTranslate({ entity, id, from, to, source });
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            onTranslated(result.fields);
            toast.success(`Η μετάφραση από ${LOCALE_LABEL[from]} συμπληρώθηκε — έλεγξέ την πριν τη δημοσίευση.`);
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" /> : <Languages aria-hidden />}
        Αυτόματη μετάφραση από {LOCALE_LABEL[from]}
      </Button>
      {noProvider && (
        <p className="text-xs text-muted-foreground">
          Δεν έχει ρυθμιστεί υπηρεσία μετάφρασης. Όρισε <span className="font-mono">TRANSLATE_API_KEY</span> ή{" "}
          <span className="font-mono">DEEPSEEK_API_KEY</span> στο περιβάλλον.
        </p>
      )}
    </div>
  );
}
