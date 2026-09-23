import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-green-700 dark:text-green-400",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-red-700 dark:text-red-400",
  info: "text-blue-700 dark:text-blue-400",
};

/**
 * Κάρτα αριθμού (KPI). Ίδια παντού: μικρή ετικέτα, μεγάλος αριθμός με
 * σταθερό πλάτος ψηφίων, προαιρετική υποσημείωση. Χρώμα μόνο όταν ο αριθμός
 * σημαίνει κάτι (π.χ. σφάλματα > 0).
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onClick,
  active,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      </div>
      <div className={cn("mt-1 text-2xl leading-none font-semibold tabular-nums", toneClass[tone])}>
        {typeof value === "number" ? value.toLocaleString("el-GR") : value}
      </div>
      {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
    </>
  );
  const base = cn(
    "min-w-0 rounded-lg border bg-card p-3 text-left shadow-xs",
    active && "border-primary ring-1 ring-primary",
    className,
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, "cursor-pointer transition-colors hover:bg-accent")}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

const gridCols = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
} as const;

/**
 * Πλέγμα καρτών αριθμών με σωστή αναδίπλωση σε κάθε πλάτος.
 * `cols` = μέγιστες στήλες σε μεγάλη οθόνη (όσες και οι κάρτες, αν είναι ≤ 6).
 */
export function StatGrid({
  children,
  cols,
  className,
}: {
  children: ReactNode;
  cols?: keyof typeof gridCols;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        cols ? gridCols[cols] : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
