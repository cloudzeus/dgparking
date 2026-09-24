import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RIGHT_KEYS } from "@/components/site/right-keys";

/**
 * Κάθε δικαίωμα σε μία πρόταση, με το άρθρο δίπλα του. Με `linkTo` κάθε
 * κάρτα οδηγεί στη φόρμα άσκησης, με προεπιλεγμένο το δικαίωμα.
 */
export async function RightsList({ linkTo }: { linkTo?: "/data-rights" }) {
  const t = await getTranslations("gdpr.dataRights.rights");

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {RIGHT_KEYS.map((key) => {
        const body = (
          <>
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">{t(`${key}.title`)}</span>
              <span className="text-xs text-muted-foreground">{t(`${key}.article`)}</span>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{t(`${key}.description`)}</span>
          </>
        );

        return (
          <li key={key} className="min-w-0">
            {linkTo ? (
              <Link
                href={{ pathname: linkTo, query: { right: key } }}
                className="block h-full rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                {body}
              </Link>
            ) : (
              <div className="h-full rounded-lg border bg-card p-4">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
