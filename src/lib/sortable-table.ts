/**
 * Client-side table sorting helpers. Use with {@link SortableTableHead}.
 * Cycle: unsorted → asc → desc → unsorted (same column).
 */
export type ColumnSortState<K extends string = string> = { key: K; dir: "asc" | "desc" } | null

export function cycleColumnSort<K extends string>(prev: ColumnSortState<K>, key: K): ColumnSortState<K> {
  if (!prev || prev.key !== key) return { key, dir: "asc" }
  if (prev.dir === "asc") return { key, dir: "desc" }
  return null
}
