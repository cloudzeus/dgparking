import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Κάρτα στοιχείων για ανοιχτό περιεχόμενο γραμμής ή σελίδα λεπτομερειών.
 *
 * Τίτλος με χρωματιστή γραμμή (`accent` = `bg-chart-1…5`) και από κάτω γραμμές
 * «ετικέτα — τιμή» σε δύο στοιχισμένες στήλες. Σε πλέγμα:
 * `grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4`.
 */
export function InfoPanel({
  title,
  accent = "bg-chart-1",
  action,
  children,
  className,
}: {
  title: ReactNode;
  accent?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-md border bg-card p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          <span className={cn("h-3 w-1 shrink-0 rounded-full", accent)} aria-hidden />
          <span className="truncate">{title}</span>
        </h4>
        {action}
      </div>
      <dl className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-3 gap-y-1">{children}</dl>
    </section>
  );
}

/** Μία γραμμή «ετικέτα — τιμή» μέσα σε `InfoPanel`. `wrap` για μεγάλα κείμενα (διευθύνσεις, σχόλια). */
export function InfoRow({
  label,
  mono,
  wrap,
  children,
}: {
  label: ReactNode;
  mono?: boolean;
  wrap?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 text-xs tabular-nums", wrap ? "break-words" : "truncate", mono && "font-mono")}>
        {children}
      </dd>
    </>
  );
}
