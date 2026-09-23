import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Χρωματιστό εικονίδιο της κάρτας — από τα tokens των γραφημάτων. */
export const KPI_TONE = {
  blue: "bg-chart-1/15 text-chart-1",
  green: "bg-chart-2/15 text-chart-2",
  amber: "bg-chart-3/15 text-chart-3",
  violet: "bg-chart-4/15 text-chart-4",
  red: "bg-chart-5/15 text-chart-5",
} as const;

/**
 * Κάρτα αριθμού με χρωματιστό εικονίδιο και προαιρετική μεταβολή (%).
 * Για επισκοπήσεις (αρχική σελίδα, κεφαλίδες λιστών). Με `href` γίνεται σύνδεσμος.
 */
export function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  change,
  href,
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone: keyof typeof KPI_TONE;
  change?: number | null;
  href?: string;
  /** Εναλλαγή φίλτρου που ζει σε state (αντί για `href`). */
  onClick?: () => void;
  /** Το φίλτρο της κάρτας είναι ενεργό. */
  active?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{label}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", KPI_TONE[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="mt-1 text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {change != null && (
          <Badge variant={change >= 0 ? "success" : "danger"} className="tabular-nums">
            {change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
            {change > 0 ? "+" : ""}
            {change}%
          </Badge>
        )}
        {hint && <span className="min-w-0">{hint}</span>}
      </div>
    </>
  );
  const cls = cn(
    "block min-w-0 rounded-lg border bg-card p-3 text-left shadow-xs",
    active && "border-primary ring-1 ring-primary",
  );
  if (href) {
    return (
      <Link href={href} className={cn(cls, "transition-colors hover:bg-accent/50")}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={cn(cls, "w-full cursor-pointer transition-colors hover:bg-accent/50")}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
