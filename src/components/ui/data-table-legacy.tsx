"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronUp,
  ChevronDown,
  Search,
  MoreHorizontal,
  Columns,
  Plus,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

export type SortDirection = "asc" | "desc" | null;

export interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  className?: string;
  width?: string;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  searchFields?: string[];
  addButtonLabel?: string;
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onToggleStatus?: (item: T) => void;
  actions?: Array<{
    label: string;
    onClick: (item: T) => void;
    variant?: "default" | "destructive";
    icon?: React.ReactNode;
  }> | ((item: T) => Array<{
    label: string;
    onClick: (item: T) => void;
    variant?: "default" | "destructive";
    icon?: React.ReactNode;
  }>);
  defaultVisibleColumns?: string[];
  className?: string;
  customButtons?: React.ReactNode; // Additional buttons to show next to add button
  storageKey?: string; // Unique key for localStorage persistence (e.g., "users-table", "customers-table")
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  title,
  subtitle,
  searchPlaceholder = "Search...",
  searchFields = [],
  addButtonLabel,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
  actions = [],
  defaultVisibleColumns,
  className,
  customButtons,
  storageKey,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  // OPTIMIZATION: Debounce search input to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300); // 300ms debounce delay
    
    return () => clearTimeout(timer);
  }, [search]);
  
  // Initialize visible columns with default (no localStorage access during SSR)
  const getDefaultVisibleColumns = (): Set<string> => {
    return new Set(defaultVisibleColumns || columns.map(col => col.key));
  };
  
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(getDefaultVisibleColumns);
  const [pageSize, setPageSize] = useState<number | "all">(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  
  // Load saved column visibility from localStorage after mount (client-side only)
  useEffect(() => {
    setIsMounted(true);
    
    if (!storageKey || typeof window === "undefined") {
      return;
    }
    
    try {
      const saved = localStorage.getItem(`dataTable-columns-${storageKey}`);
      if (saved) {
        const savedColumns = JSON.parse(saved) as string[];
        // Validate that saved columns still exist in current columns
        const validColumns = savedColumns.filter(colKey => 
          columns.some(col => col.key === colKey)
        );
        // If we have valid saved columns, use them; otherwise use default
        if (validColumns.length > 0) {
          setVisibleColumns(new Set(validColumns));
        }
      }
    } catch (error) {
      console.error("Error loading column preferences:", error);
    }
  }, [storageKey, columns]);
  
  // Save column visibility to localStorage when it changes
  useEffect(() => {
    if (!isMounted || !storageKey || typeof window === "undefined") {
      return;
    }
    
    if (visibleColumns.size > 0) {
      try {
        const columnsArray = Array.from(visibleColumns);
        localStorage.setItem(`dataTable-columns-${storageKey}`, JSON.stringify(columnsArray));
      } catch (error) {
        console.error("Error saving column preferences:", error);
      }
    }
  }, [visibleColumns, storageKey, isMounted]);
  
  // Handle new columns being added (merge with saved preferences)
  useEffect(() => {
    if (storageKey && columns.length > 0) {
      const allColumnKeys = new Set(columns.map(col => col.key));
      const currentVisibleKeys = Array.from(visibleColumns);
      
      // Check if there are new columns that aren't in visibleColumns
      const newColumns = columns
        .map(col => col.key)
        .filter(key => !visibleColumns.has(key));
      
      // If there are new columns, add them to visible columns (user preference is preserved, new columns are shown)
      if (newColumns.length > 0) {
        setVisibleColumns(prev => {
          const updated = new Set(prev);
          newColumns.forEach(key => updated.add(key));
          return updated;
        });
      }
      
      // Remove columns that no longer exist
      const removedColumns = currentVisibleKeys.filter(key => !allColumnKeys.has(key));
      if (removedColumns.length > 0) {
        setVisibleColumns(prev => {
          const updated = new Set(prev);
          removedColumns.forEach(key => updated.delete(key));
          return updated;
        });
      }
    }
  }, [columns, storageKey]); // Only run when columns change

  // OPTIMIZATION: Use debounced search and optimize filtering for large datasets
  const filteredData = useMemo(() => {
    let result = data;

    // Apply regular search if provided (using debounced value)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      const searchFieldsArray = searchFields.length > 0 ? searchFields : [];
      
      // For large datasets, use more efficient filtering
      if (data.length > 1000) {
        // Use Set for faster lookups if searching in specific fields
        result = result.filter((item) => {
          // Early exit if no search fields
          if (searchFieldsArray.length === 0) return true;
          
          // Check each search field
          for (const field of searchFieldsArray) {
            const value = item[field];
            if (value?.toString().toLowerCase().includes(searchLower)) {
              return true; // Found match, include this item
            }
          }
          return false; // No match found
        });
      } else {
        // For smaller datasets, use original logic
        result = result.filter((item) =>
          searchFieldsArray.some((field) => {
            const value = item[field];
            return value?.toString().toLowerCase().includes(searchLower);
          })
        );
      }
    }

    return result;
  }, [data, debouncedSearch, searchFields]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === "asc" ? 1 : -1;
      if (bValue == null) return sortDirection === "asc" ? -1 : 1;

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === "asc" ? comparison : -comparison;
      }

      // Handle date comparison
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === "asc"
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // Handle number comparison
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Fallback to string comparison
      const aStr = String(aValue);
      const bStr = String(bValue);
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    if (sortColumn === columnKey) {
      // Cycle through sort directions: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        // Don't allow hiding all columns
        if (newSet.size > 1) {
          newSet.delete(columnKey);
        }
      } else {
        newSet.add(columnKey);
      }
      return newSet;
    });
  };

  // Pagination logic
  const totalItems = sortedData.length;
  const totalPages = pageSize === "all" ? 1 : Math.ceil(totalItems / pageSize);
  
  // Reset to page 1 when page size changes or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, search]);

  // Get paginated data
  const paginatedData = useMemo(() => {
    if (pageSize === "all") return sortedData;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize]);

  // Calculate page numbers to display
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const pages: (number | string)[] = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  const visibleColumnsList = columns.filter(col => visibleColumns.has(col.key));

  const renderCellContent = (item: T, column: Column<T>) => {
    const value = item[column.key];

    if (column.render) {
      return column.render(value, item);
    }

    // Default renderers
    if (value instanceof Date) {
      return format(value, "dd/MM/yyyy");
    }

    if (typeof value === "boolean") {
      return (
        <Badge variant={value ? "default" : "secondary"} className="text-[7px] px-1.5 py-0.5">
          {value ? "ACTIVE" : "INACTIVE"}
        </Badge>
      );
    }

    return value || "-";
  };

  return (
    <Card className={`group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
      {title && (
        <CardHeader className="pb-4 relative">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[13px] uppercase text-muted-foreground font-bold">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-[9px] text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 border-muted-foreground/20 focus:border-violet-500/50 text-[11px]"
              />
            </div>

            <div className="flex items-center gap-2">
              {columns.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild suppressHydrationWarning>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 relative z-10"
                      type="button"
                    >
                      <Columns className="h-4 w-4 mr-1" />
                      <span className="text-[11px]">COLUMNS</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[11px]">TOGGLE COLUMNS</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {columns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={visibleColumns.has(column.key)}
                        onCheckedChange={() => toggleColumnVisibility(column.key)}
                        className="text-[11px]"
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Page Size Selector */}
              <Select
                value={pageSize === "all" ? "all" : String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(value === "all" ? "all" : parseInt(value, 10));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-20 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25" className="text-[11px]">25</SelectItem>
                  <SelectItem value="50" className="text-[11px]">50</SelectItem>
                  <SelectItem value="100" className="text-[11px]">100</SelectItem>
                  <SelectItem value="all" className="text-[11px]">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customButtons}
            {addButtonLabel && onAdd && (
              <Button
                type="button"
                onClick={() => {
                  onAdd();
                }}
                size="sm"
                className="h-9 gap-2 px-6 py-3 text-[11px] font-medium shadow-lg hover:shadow-xl transition-all duration-300 relative z-10"
              >
                <Plus className="h-3 w-3" />
                {addButtonLabel}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      )}

      {!title && (
        <div className="px-6 py-3 border-b border-muted-foreground/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {searchPlaceholder && (
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-9 border-muted-foreground/20 focus:border-violet-500/50 text-[11px]"
                  />
                </div>
              )}

            <div className="flex items-center gap-2">
              {columns.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild suppressHydrationWarning>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 relative z-10"
                      type="button"
                    >
                      <Columns className="h-4 w-4 mr-1" />
                      <span className="text-[11px]">COLUMNS</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[11px]">TOGGLE COLUMNS</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {columns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={visibleColumns.has(column.key)}
                        onCheckedChange={() => toggleColumnVisibility(column.key)}
                        className="text-[11px]"
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Page Size Selector */}
              <Select
                value={pageSize === "all" ? "all" : String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(value === "all" ? "all" : parseInt(value, 10));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-20 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25" className="text-[11px]">25</SelectItem>
                  <SelectItem value="50" className="text-[11px]">50</SelectItem>
                  <SelectItem value="100" className="text-[11px]">100</SelectItem>
                  <SelectItem value="all" className="text-[11px]">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customButtons}
            {addButtonLabel && onAdd && (
              <Button
                type="button"
                onClick={() => {
                  onAdd();
                }}
                size="sm"
                className="h-9 gap-2 px-6 py-3 text-[11px] font-medium shadow-lg hover:shadow-xl transition-all duration-300 relative z-10"
              >
                <Plus className="h-3 w-3" />
                {addButtonLabel}
              </Button>
            )}
          </div>
          </div>
        </div>
      )}

      <CardContent className={`${title ? 'relative' : 'relative px-6'}`}>
        <div className="rounded-lg border border-muted-foreground/20 overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="h-6">
                {visibleColumnsList.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`text-[7px] uppercase font-bold text-muted-foreground ${column.className || ""}`}
                    style={{ width: column.width }}
                  >
                    {column.sortable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 hover:bg-transparent font-bold"
                        onClick={() => handleSort(column.key)}
                      >
                        <span className="text-[7px]">{column.label}</span>
                        <ArrowUpDown className="ml-1 h-2.5 w-2.5" />
                        {sortColumn === column.key && sortDirection === "asc" && (
                          <ChevronUp className="ml-1 h-2.5 w-2.5" />
                        )}
                        {sortColumn === column.key && sortDirection === "desc" && (
                          <ChevronDown className="ml-1 h-2.5 w-2.5" />
                        )}
                      </Button>
                    ) : (
                      <span className="text-[7px]">{column.label}</span>
                    )}
                  </TableHead>
                ))}
                {(actions.length > 0 || onEdit || onDelete || onToggleStatus) && (
                  <TableHead className="text-right text-[7px] uppercase font-bold text-muted-foreground w-16">
                    ACTIONS
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumnsList.length + (actions.length > 0 || onEdit || onDelete || onToggleStatus ? 1 : 0)}
                    className="h-12 text-center text-[9px] text-muted-foreground"
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow key={item.id || index} className="h-6 hover:bg-muted/70 transition-colors cursor-pointer">
                    {visibleColumnsList.map((column) => (
                      <TableCell
                        key={column.key}
                        className={`text-[9px] ${column.className || ""}`}
                      >
                        {renderCellContent(item, column)}
                      </TableCell>
                    ))}
                    {((typeof actions === 'function' ? actions(item).length > 0 : (actions?.length || 0) > 0) || onEdit || onDelete || onToggleStatus) && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild suppressHydrationWarning>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-[9px]">ACTIONS</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {onEdit && (
                              <DropdownMenuItem
                                onClick={() => onEdit(item)}
                                className="text-[9px]"
                              >
                                Edit User
                              </DropdownMenuItem>
                            )}
                            {onToggleStatus && (
                              <DropdownMenuItem
                                onClick={() => onToggleStatus(item)}
                                className="text-[9px]"
                              >
                                Toggle Status
                              </DropdownMenuItem>
                            )}
                            {(() => {
                              const recordActions = typeof actions === 'function' ? actions(item) : (actions || []);
                              return recordActions.map((action, actionIndex) => (
                                <DropdownMenuItem
                                  key={actionIndex}
                                  onClick={() => action.onClick(item)}
                                  className={`text-[9px] ${action.variant === 'destructive' ? 'text-destructive' : ''}`}
                                >
                                  {action.icon}
                                  {action.label}
                                </DropdownMenuItem>
                              ));
                            })()}
                            {onDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(item)}
                                  className="text-[9px] text-destructive"
                                >
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-[9px] text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              
              {getPageNumbers().map((page, index) => {
                if (page === "...") {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-[9px] text-muted-foreground">
                      ...
                    </span>
                  );
                }
                const pageNum = page as number;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className={`h-7 w-7 p-0 text-[9px] ${
                      currentPage === pageNum 
                        ? "bg-primary text-primary-foreground" 
                        : ""
                    }`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
