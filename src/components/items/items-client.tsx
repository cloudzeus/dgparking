"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { IntegrationRecordForm } from "@/components/integrations/integration-record-form";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Item {
  ITEMS: number;
  MTRL: string | null;
  CODE: string | null;
  NAME: string | null;
  ISACTIVE: number;
  [key: string]: any;
}

interface ItemsClientProps {
  items: Item[];
  currentUserRole: Role;
  itemsIntegration: any;
  modelFields: Array<{
    name: string;
    type: string;
    isId: boolean;
    isUnique: boolean;
    isRequired: boolean;
  }>;
}

export function ItemsClient({
  items: initialItems,
  currentUserRole,
  itemsIntegration,
  modelFields,
}: ItemsClientProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 500;
  const [items, setItems] = useState<Item[]>(initialItems);
  
  // OPTIMIZATION: Debounce search input to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300); // 300ms debounce delay
    
    return () => clearTimeout(timer);
  }, [search]);

  // Sync items state with server data when initialItems changes (e.g., after router.refresh)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    });

    return () => ctx.revert();
  }, []);

  // OPTIMIZATION: Use debounced search and optimize filtering for large datasets
  const filteredItems = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const searchLower = debouncedSearch.toLowerCase();
    
    // For large datasets, optimize the filter
    if (items.length > 1000) {
      return items.filter((item) => {
        // Check each field with early exit
        return (
          item.NAME?.toLowerCase().includes(searchLower) ||
          item.CODE?.toLowerCase().includes(searchLower) ||
          item.MTRL?.toLowerCase().includes(searchLower)
        );
      });
    } else {
      // For smaller datasets, use original logic
      return items.filter(
        (item) =>
          item.NAME?.toLowerCase().includes(searchLower) ||
          item.CODE?.toLowerCase().includes(searchLower) ||
          item.MTRL?.toLowerCase().includes(searchLower)
      );
    }
  }, [items, debouncedSearch]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Reset to page 1 when debounced search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // European license plate styling - classic white with blue EU flag strip
  const getLicensePlateStyle = () => {
    return {
      background: "#ffffff",
      border: "1px solid #9ca3af", // gray-400
      color: "#000000",
      fontFamily: "monospace",
      width: "80px",
      height: "29px", // Reduced by 6px (3px top + 3px bottom)
    };
  };

  if (!itemsIntegration) {
    return (
      <div ref={containerRef} className="space-y-6 opacity-0">
        <PageHeader
          title="ITEMS"
          highlight="ITEMS"
          subtitle="Manage your items inventory"
        />
        <Card className="p-6">
          <div className="text-center py-8">
            <p className="text-[11px] text-muted-foreground mb-4">
              No ITEMS integration found. Please create an ITEMS integration first.
            </p>
            <Button
              onClick={() => router.push("/integrations")}
              className="h-9 gap-2 px-6 py-3 text-[11px]"
            >
              Go to Integrations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6 opacity-0">
      <PageHeader
        title="ITEMS"
        highlight="ITEMS"
        subtitle={`Viewing ${startIndex + 1}-${Math.min(endIndex, filteredItems.length)} of ${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""} (Page ${currentPage} of ${totalPages})`}
      />

      {/* Search and Add Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items by name, code, or MTRL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 border-muted-foreground/20 focus:border-violet-500/50 text-[11px]"
          />
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          size="sm"
          className="h-9 gap-2 px-6 py-3 text-[11px] font-medium shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Plus className="h-3 w-3" />
          ADD NEW ITEM
        </Button>
      </div>

      {/* License Plate Cards Grid - Responsive, fits as many as possible */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
        {paginatedItems.map((item) => {
          const plateStyle = getLicensePlateStyle();
          return (
            <Card
              key={item.ITEMS}
              className="overflow-hidden border-0 hover:shadow-lg transition-all duration-300 cursor-pointer group relative rounded-sm p-0"
              style={{
                background: plateStyle.background,
                border: plateStyle.border,
                fontFamily: plateStyle.fontFamily,
                width: plateStyle.width,
                height: plateStyle.height,
                borderRadius: "4px",
              }}
              onClick={() => {
                // Optional: Navigate to item details or open edit dialog
              }}
            >
              <div className="h-full flex items-center relative bg-white p-0" style={{ height: plateStyle.height }}>
                {/* EU Blue Strip with Flag (left side - 5px wider, ~24% width) */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[24%] flex items-center justify-center p-0"
                  style={{
                    background: "#003399",
                  }}
                >
                  {/* EU Flag - Circle of 12 yellow stars on blue background - smaller */}
                  <div className="relative w-3.5 h-3.5">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      className="absolute inset-0"
                    >
                      {/* 12 yellow stars arranged in a perfect circle - smaller */}
                      {Array.from({ length: 12 }).map((_, i) => {
                        const angle = (i * 30 - 90) * (Math.PI / 180);
                        const cx = 7 + 3.5 * Math.cos(angle);
                        const cy = 7 + 3.5 * Math.sin(angle);
                        // Create 5-pointed star
                        const starPoints = [];
                        for (let j = 0; j < 5; j++) {
                          const outerAngle = (j * 144 - 90) * (Math.PI / 180);
                          const outerX = cx + 1 * Math.cos(outerAngle);
                          const outerY = cy + 1 * Math.sin(outerAngle);
                          starPoints.push(`${outerX},${outerY}`);
                          const innerAngle = ((j + 0.5) * 144 - 90) * (Math.PI / 180);
                          const innerX = cx + 0.4 * Math.cos(innerAngle);
                          const innerY = cy + 0.4 * Math.sin(innerAngle);
                          starPoints.push(`${innerX},${innerY}`);
                        }
                        return (
                          <polygon
                            key={i}
                            points={starPoints.join(" ")}
                            fill="#FFD700"
                            stroke="#FFD700"
                            strokeWidth="0.1"
                          />
                        );
                      })}
                    </svg>
                  </div>
                </div>
                {/* Item Name (centered in white area - ~76% width) */}
                <div
                  className="flex-1 text-center font-bold uppercase ml-[24%] flex items-center justify-center h-full p-0"
                  style={{ 
                    color: plateStyle.color,
                    letterSpacing: "0.05em",
                  }}
                >
                  <div className="text-[11px] leading-tight line-clamp-1 wrap-break-word">
                    {item.NAME || "NO NAME"}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="h-8 px-3 text-[10px] gap-1"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-8 w-8 p-0 text-[10px]"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="h-8 px-3 text-[10px] gap-1"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {filteredItems.length === 0 && (
        <Card className="p-6">
          <div className="text-center py-8 text-[11px] text-muted-foreground">
            {search ? "No items found matching your search." : "No items found."}
          </div>
        </Card>
      )}

      {/* Add Item Dialog */}
      <FormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title="ADD NEW ITEM"
        maxWidth="2xl"
      >
        <IntegrationRecordForm
          mode="create"
          modelName="ITEMS"
          modelFields={modelFields}
          integrationId={itemsIntegration.id}
          onSuccess={async (newRecord?: any) => {
            setIsAddDialogOpen(false);
            
            // If we have the new record data, add it to the list optimistically
            if (newRecord) {
              // Add the new item to the beginning of the list (most recent first)
              // Ensure it's sorted by createdAt desc (newest first)
              setItems((prevItems) => {
                const updated = [newRecord, ...prevItems];
                // Sort by createdAt descending (newest first)
                return updated.sort((a, b) => {
                  const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return bDate - aDate;
                });
              });
              // Toast is already shown by IntegrationRecordForm
            } else {
              // Fallback: refresh the page if no record data returned
              router.refresh();
            }
          }}
        />
      </FormDialog>
    </div>
  );
}


