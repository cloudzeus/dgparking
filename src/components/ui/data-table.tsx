"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnResizeMode,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, Download, Settings, ArrowUpDown, ArrowUp, ArrowDown, ChevronFirst, ChevronLeft, ChevronLast } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Ελληνικό όνομα στήλης για το μενού «Στήλες» όταν το header είναι component. */
    label?: string;
    /** Με `fixedLayout`: η στήλη παίρνει ό,τι πλάτος περισσεύει (π.χ. περιγραφή). */
    flex?: boolean;
    /** Στοίχιση κεφαλίδας ίδια με το περιεχόμενο (π.χ. "right" για ποσά). */
    align?: "left" | "right";
  }
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** When set, replaces the default "Data Table (N items)" header title */
  title?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  pageSize?: number;
  totalItems?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  expandableContent?: (item: TData) => React.ReactNode;
  showColumnSelector?: boolean;
  showExport?: boolean;
  onExport?: () => void;
  loading?: boolean;
  className?: string;
  selectedRows?: string[];
  onRowSelectionChange?: (selectedRows: string[]) => void;
  showInternetProductsFilter?: boolean;
  internetProductsOnly?: boolean;
  onInternetProductsFilterChange?: (checked: boolean) => void;
  /** Stable row id for expandable rows and selection. Defaults to index. */
  getRowId?: (row: TData, index: number) => string;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  columnVisibilityStorageKey?: string;
  /**
   * Σταθερά πλάτη στηλών (table-fixed): οι στήλες κρατούν το `size` τους, οι
   * `meta.flex` μοιράζονται τον χώρο που μένει, και τα truncate/line-clamp
   * δουλεύουν. Χωρίς αυτό ο πίνακας απλώνει όσο το μεγαλύτερο κείμενο.
   */
  fixedLayout?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  title,
  searchPlaceholder = "Αναζήτηση…",
  searchValue = "",
  onSearchChange,
  pageSize = 200,
  totalItems = 0,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  expandableContent,
  showColumnSelector = true,
  showExport = true,
  onExport,
  loading = false,
  className,
  selectedRows = [],
  onRowSelectionChange,
  showInternetProductsFilter = false,
  internetProductsOnly = false,
  onInternetProductsFilterChange,
  getRowId,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  columnVisibilityStorageKey,
  fixedLayout = false,
}: DataTableProps<TData, TValue>) {
  const pathname = usePathname();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  /** Avoid infinite parent↔child loops: only notify when selected ids actually change. */
  const lastNotifiedSelectionKeyRef = React.useRef<string | null>(null);
  const columnIdentity = React.useMemo(() => {
    return columns
      .map((column, index) => {
        const id = (column as { id?: string }).id;
        const accessorKey = (column as { accessorKey?: string }).accessorKey;
        return id || accessorKey || `col-${index}`;
      })
      .join("|");
  }, [columns]);

  const resolvedColumnVisibilityStorageKey = React.useMemo(() => {
    if (columnVisibilityStorageKey) return columnVisibilityStorageKey;
    if (!showColumnSelector) return null;
    return `datatable-column-visibility:${pathname}:${columnIdentity}`;
  }, [columnVisibilityStorageKey, showColumnSelector, pathname, columnIdentity]);

  React.useEffect(() => {
    if (!controlledColumnVisibility) return;
    setColumnVisibility(controlledColumnVisibility);
  }, [controlledColumnVisibility]);

  React.useEffect(() => {
    if (controlledColumnVisibility) return;
    if (!resolvedColumnVisibilityStorageKey) return;
    try {
      const raw = localStorage.getItem(resolvedColumnVisibilityStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") return;
      const sanitized = Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === "boolean")
      ) as VisibilityState;
      setColumnVisibility(sanitized);
    } catch {
      // Ignore malformed local storage values.
    }
  }, [controlledColumnVisibility, resolvedColumnVisibilityStorageKey]);

  React.useEffect(() => {
    if (controlledColumnVisibility) return;
    if (!resolvedColumnVisibilityStorageKey) return;
    try {
      localStorage.setItem(
        resolvedColumnVisibilityStorageKey,
        JSON.stringify(columnVisibility)
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [controlledColumnVisibility, resolvedColumnVisibilityStorageKey, columnVisibility]);

  const handleColumnVisibilityChange = React.useCallback(
    (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onColumnVisibilityChange?.(next);
        return next;
      });
    },
    [onColumnVisibilityChange]
  );

  /*
   * Πλάτη στηλών.
   *
   * Σε αυτόματο layout ο browser απλώνει κάθε στήλη όσο το κείμενό της και
   * αγνοεί το πλάτος της λαβής — γι' αυτό το «σύρσιμο» δεν μίκραινε τίποτα.
   * Στο πρώτο σύρσιμο κρατάμε τα πλάτη που φαίνονται εκείνη τη στιγμή και
   * περνάμε σε σταθερό layout, ώστε ο πίνακας να μην «πηδήξει». Τα πλάτη
   * μένουν αποθηκευμένα ανά σελίδα.
   */
  const columnSizingStorageKey = `datatable-column-sizing:${pathname}:${columnIdentity}`;
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const headerCells = React.useRef(new Map<string, HTMLTableCellElement>());

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(columnSizingStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const clean = Object.fromEntries(
        Object.entries(parsed ?? {}).filter(([, v]) => typeof v === "number" && v >= 40 && v <= 2000),
      ) as ColumnSizingState;
      if (Object.keys(clean).length) setColumnSizing(clean);
    } catch {
      /* κατεστραμμένη τιμή: αγνοείται */
    }
  }, [columnSizingStorageKey]);

  React.useEffect(() => {
    if (!Object.keys(columnSizing).length) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(columnSizingStorageKey, JSON.stringify(columnSizing));
      } catch {
        /* ιδιωτική περιήγηση */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [columnSizing, columnSizingStorageKey]);

  const useFixedLayout = fixedLayout || Object.keys(columnSizing).length > 0;

  /*
   * Το ανοιχτό περιεχόμενο γραμμής μένει στο ορατό πλάτος: σε φαρδύ πίνακα με
   * οριζόντια κύλιση δεν απλώνεται σε όλο το πλάτος του πίνακα αλλά
   * «κολλάει» αριστερά με πλάτος όσο το πλαίσιο.
   */
  const scrollBoxRef = React.useRef<HTMLDivElement>(null);
  const [scrollBoxWidth, setScrollBoxWidth] = React.useState<number | null>(null);
  React.useEffect(() => {
    const el = scrollBoxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setScrollBoxWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const table = useReactTable({
    data,
    columns,
    getRowId: getRowId as ((row: TData, index: number) => string) | undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    columnResizeMode: "onChange" as ColumnResizeMode,
    enableColumnResizing: true,
    onColumnSizingChange: setColumnSizing,
    enableRowSelection: !!onRowSelectionChange,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
  });

  /** Μια στήλη «flex» παίρνει τον χώρο που περισσεύει — μέχρι να της δώσει πλάτος ο χρήστης. */
  const isFlex = (column: any) => useFixedLayout && column.columnDef.meta?.flex && columnSizing[column.id] == null;

  const startResize = (header: any, event: React.MouseEvent | React.TouchEvent) => {
    if (!useFixedLayout || isFlex(header.column)) {
      const snapshot: ColumnSizingState = { ...columnSizing };
      headerCells.current.forEach((el, id) => {
        if (el.isConnected) snapshot[id] = Math.round(el.getBoundingClientRect().width);
      });
      flushSync(() => setColumnSizing(snapshot));
    }
    header.getResizeHandler()(event);
  };

  React.useEffect(() => {
    if (!onRowSelectionChange) return;
    const ids = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    const key = ids.slice().sort().join("\u0001");
    if (key === lastNotifiedSelectionKeyRef.current) return;
    lastNotifiedSelectionKeyRef.current = key;
    onRowSelectionChange(ids);
  }, [rowSelection, onRowSelectionChange]);

  const toggleRowExpansion = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  // Initial load: show skeleton. Page change / refetch: show table with overlay so pagination stays visible.
  if (loading && totalItems === 0) {
    return <DataTableSkeleton />;
  }

  return (
    <Card className={cn(className, "relative")}>
      {loading && totalItems > 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Φόρτωση…</span>
          </div>
        </div>
      )}
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {title ?? <span>{totalItems.toLocaleString("el-GR")} εγγραφές</span>}
          </div>
          <div className="flex items-center gap-2">
            {showInternetProductsFilter && onInternetProductsFilterChange && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="internet-products"
                  checked={internetProductsOnly}
                  onCheckedChange={onInternetProductsFilterChange}
                />
                <label
                  htmlFor="internet-products"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Μόνο δημοσιευμένα
                </label>
              </div>
            )}
            {showExport && onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download />
                Εξαγωγή
              </Button>
            )}
            {showColumnSelector && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings />
                    Στήλες
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column: any) => column.getCanHide())
                    .map((column: any) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                        >
                          {column.columnDef.meta?.label ??
                            (typeof column.columnDef.header === "string" && column.columnDef.header
                              ? column.columnDef.header
                              : column.id)}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search Bar */}
        {onSearchChange && (
          <div className="mb-4">
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}

        {/* Table */}
        <div ref={scrollBoxRef} className="rounded-md border overflow-x-auto">
          <Table
            className={cn(useFixedLayout && "table-fixed")}
            style={
              useFixedLayout
                ? {
                    width: "100%",
                    minWidth:
                      table
                        .getVisibleLeafColumns()
                        .reduce((sum: number, c: any) => sum + (isFlex(c) ? 180 : c.getSize()), 0) +
                      (onRowSelectionChange ? 36 : 0) +
                      (expandableContent ? 36 : 0),
                  }
                : undefined
            }
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup: any) => (
                <TableRow key={headerGroup.id} className="border-b hover:bg-transparent data-[state=selected]:bg-transparent">
                  {onRowSelectionChange && (
                    <TableHead className={useFixedLayout ? "w-9" : "w-12"}>
                      <Checkbox
                        checked={
                          table.getIsAllPageRowsSelected() ||
                          (table.getIsSomePageRowsSelected() && "indeterminate")
                        }
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Επιλογή όλων"
                      />
                    </TableHead>
                  )}
                  {expandableContent && (
                    <TableHead className={useFixedLayout ? "w-9" : "w-12"}></TableHead>
                  )}
                  {headerGroup.headers.map((header: any) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className="text-xs relative"
                        ref={(el: HTMLTableCellElement | null) => {
                          if (el) headerCells.current.set(header.column.id, el);
                          else headerCells.current.delete(header.column.id);
                        }}
                        style={isFlex(header.column) ? undefined : { width: header.getSize() }}
                      >
                        <div
                          className={cn(
                            "flex items-center",
                            header.column.columnDef.meta?.align === "right" ? "justify-end" : "justify-start",
                          )}
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              title={
                                sorted === "asc"
                                  ? "Αύξουσα ταξινόμηση — κλικ για φθίνουσα, ξανά για καθαρισμό"
                                  : sorted === "desc"
                                    ? "Κλικ για καθαρισμό ταξινόμησης"
                                    : "Ταξινόμηση στήλης"
                              }
                              className={cn(
                                "-mx-1.5 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-inherit hover:bg-muted/60",
                                header.column.columnDef.meta?.align === "right" ? "flex-row-reverse text-right" : "text-left",
                              )}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === "asc" ? (
                                <ArrowUp className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 shrink-0 opacity-55" aria-hidden />
                              )}
                            </button>
                          ) : (
                            <div className="py-1 text-xs font-semibold text-inherit">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </div>
                          )}
                        </div>
                        {header.column.getCanResize() && (
                        <div
                          onMouseDown={(e) => startResize(header, e)}
                          onTouchStart={(e) => startResize(header, e)}
                          onDoubleClick={() => header.column.resetSize()}
                          title="Σύρετε για αλλαγή πλάτους · διπλό κλικ για επαναφορά"
                          aria-hidden
                          className={cn(
                            "absolute top-0 -right-1 z-30 h-full w-2.5 cursor-col-resize touch-none select-none transition-colors",
                            header.column.getIsResizing() ? "bg-primary/60" : "hover:bg-border",
                          )}
                        />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row: any) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50"
                  >
                    {onRowSelectionChange && (
                      <TableCell className={useFixedLayout ? "w-9" : "w-12"}>
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) => row.toggleSelected(!!value)}
                          aria-label="Επιλογή γραμμής"
                        />
                      </TableCell>
                    )}
                    {expandableContent && (
                      <TableCell className={useFixedLayout ? "w-9" : "w-12"}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(row.id)}
                          className="h-6 w-6 p-0"
                        >
                          {expandedRows.has(row.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell: any) => (
                      <TableCell
                        key={cell.id}
                        className={cn("text-xs", useFixedLayout && "overflow-hidden whitespace-normal")}
                        style={isFlex(cell.column) ? undefined : { width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expandableContent && expandedRows.has(row.id) && (
                    <TableRow>
                      <TableCell
                        colSpan={row.getVisibleCells().length + (onRowSelectionChange ? 2 : 1)}
                        className="bg-muted/40 p-0 whitespace-normal"
                      >
                        <div
                          className="sticky left-0 p-3"
                          style={scrollBoxWidth ? { width: scrollBoxWidth - 2 } : undefined}
                        >
                          {expandableContent(row.original)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">
              {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalItems)} από {totalItems.toLocaleString("el-GR")}
            </div>
            {onPageSizeChange && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ανά σελίδα:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-7 rounded-sm border bg-background px-2 text-xs"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={2500}>2,500</option>
                  <option value={5000}>5,000</option>
                </select>
              </div>
            )}
          </div>
          {totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(1)}
                disabled={currentPage <= 1}
              >
                <ChevronFirst className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 9, currentPage - 4)) + i;
                  if (pageNum > totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage >= totalPages}
              >
                <ChevronLast className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DataTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-48" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 