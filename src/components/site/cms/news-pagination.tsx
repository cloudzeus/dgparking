import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors";

/**
 * Σελιδοποίηση με `?page=` — απλοί σύνδεσμοι, ώστε να δουλεύει και χωρίς
 * JavaScript και να μπορεί κανείς να στείλει τη σελίδα που βλέπει.
 */
export function NewsPagination({
  page,
  totalPages,
  labels,
}: {
  page: number;
  totalPages: number;
  labels: { previous: string; next: string; status: string; navigation: string };
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => (target <= 1 ? "/news" : `/news?page=${target}`);

  return (
    <nav
      className="mt-12 flex items-center justify-center gap-4"
      aria-label={labels.navigation}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(BUTTON, "hover:bg-accent")}>
          <ChevronLeft className="size-4" aria-hidden />
          {labels.previous}
        </Link>
      ) : (
        <span className={cn(BUTTON, "cursor-default opacity-40")} aria-disabled>
          <ChevronLeft className="size-4" aria-hidden />
          {labels.previous}
        </span>
      )}

      <span className="font-mono text-sm text-muted-foreground" aria-current="page">
        {labels.status}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(BUTTON, "hover:bg-accent")}>
          {labels.next}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={cn(BUTTON, "cursor-default opacity-40")} aria-disabled>
          {labels.next}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
