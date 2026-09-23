"use client"

import type { ReactNode } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { ColumnSortState } from "@/lib/sortable-table"

export type SortableTableHeadVariant = "default" | "dark"

type SortableTableHeadProps<K extends string> = {
  sortKey: K
  columnSort: ColumnSortState<K>
  onSort: (key: K) => void
  children: ReactNode
  className?: string
  align?: "left" | "right"
  variant?: SortableTableHeadVariant
}

/**
 * Clickable column header: cycles sort asc → desc → off.
 * Use {@link cycleColumnSort} in parent state. Non-sortable cells use plain `TableHead`.
 */
export function SortableTableHead<K extends string>({
  sortKey,
  columnSort,
  onSort,
  children,
  className,
  align = "left",
  variant = "default",
}: SortableTableHeadProps<K>) {
  const active = columnSort?.key === sortKey
  const dir = active ? columnSort!.dir : null

  const labelStyles =
    variant === "dark"
      ? "text-xs font-medium text-muted-foreground hover:bg-muted/80 data-[active=true]:text-foreground"
      : "text-xs font-medium text-muted-foreground hover:bg-muted/80 data-[active=true]:text-foreground"

  return (
    <TableHead className={className}>
      <button
        type="button"
        data-active={active}
        onClick={() => onSort(sortKey)}
        title={
          active
            ? dir === "asc"
              ? "Αύξουσα ταξινόμηση — πατήστε για φθίνουσα"
              : "Φθίνουσα ταξινόμηση — πατήστε για κατάργηση"
            : "Ταξινόμηση στήλης"
        }
        className={cn(
          "group inline-flex w-full min-h-8 items-center gap-1 rounded-md px-1.5 py-1 text-left transition-colors",
          align === "right" && "justify-end text-right",
          labelStyles
        )}
      >
        <span>{children}</span>
        {dir === "asc" && <ArrowUp className="h-3 w-3 shrink-0 opacity-90" aria-hidden />}
        {dir === "desc" && <ArrowDown className="h-3 w-3 shrink-0 opacity-90" aria-hidden />}
      </button>
    </TableHead>
  )
}
