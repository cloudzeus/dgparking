import "./article-prose.css";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";

/**
 * Το σώμα ενός άρθρου ή μιας σελίδας του CMS.
 *
 * Το HTML περνά πάντα από τον καθαριστή πριν αποδοθεί — ο επεξεργαστής της
 * διαχείρισης δεν θεωρείται έμπιστη πηγή.
 */
export function ContentBody({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const safeHtml = sanitizeHtml(html);
  if (safeHtml.trim() === "") return null;

  return (
    <div
      className={cn("mega-prose", className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
