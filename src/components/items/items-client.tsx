"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { EmptyState, KpiTile, PageHeader } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { IntegrationRecordForm } from "@/components/integrations/integration-record-form";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Link2Off,
  Plus,
  Search,
  SquareStack,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

const nf = new Intl.NumberFormat("el-GR");

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

  const counts = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.ISACTIVE === 1).length,
      inactive: items.filter((item) => item.ISACTIVE !== 1).length,
    }),
    [items]
  );

  if (!itemsIntegration) {
    return (
      <div ref={containerRef} className="space-y-4 opacity-0">
        <PageHeader
          className="mb-0"
          title="Είδη"
          description="Οι πινακίδες οχημάτων που τηρούνται ως είδη και συγχρονίζονται με το SoftOne."
          icon={Car}
        />
        <EmptyState
          title="Δεν έχει οριστεί διασύνδεση ITEMS"
          description="Για να δείτε και να καταχωρίσετε είδη, δημιουργήστε πρώτα μια διασύνδεση με μοντέλο ITEMS."
          icon={Link2Off}
          action={
            <Button onClick={() => router.push("/integrations")}>
              Μετάβαση στις διασυνδέσεις
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4 opacity-0">
      <PageHeader
        className="mb-0"
        title="Είδη"
        description="Οι πινακίδες οχημάτων που τηρούνται ως είδη και συγχρονίζονται με το SoftOne. Αναζητήστε με πινακίδα, κωδικό ή MTRL."
        icon={Car}
        actions={
          <Button onClick={() => setIsAddDialogOpen(true)} title="Καταχώριση νέου είδους">
            <Plus className="size-4" />
            Νέο είδος
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Σύνολο ειδών"
          value={nf.format(counts.total)}
          hint="όπως έχουν φορτωθεί"
          icon={SquareStack}
          tone="blue"
        />
        <KpiTile
          label="Ενεργά"
          value={nf.format(counts.active)}
          hint="διαθέσιμα προς χρήση"
          icon={Car}
          tone="green"
        />
        <KpiTile
          label="Ανενεργά"
          value={nf.format(counts.inactive)}
          hint="δεν χρησιμοποιούνται"
          icon={CircleSlash}
          tone="amber"
        />
        <KpiTile
          label="Αποτελέσματα"
          value={nf.format(filteredItems.length)}
          hint={
            totalPages > 1
              ? `σελίδα ${nf.format(currentPage)} από ${nf.format(totalPages)}`
              : "με τα τρέχοντα φίλτρα"
          }
          icon={Search}
          tone="violet"
        />
      </div>

      {/* Φίλτρα */}
      <Card>
        <CardContent>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder="Αναζήτηση με πινακίδα, κωδικό ή MTRL…"
              aria-label="Αναζήτηση ειδών"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {filteredItems.length > 0
              ? `Εμφανίζονται ${nf.format(startIndex + 1)}–${nf.format(
                  Math.min(endIndex, filteredItems.length)
                )} από ${nf.format(filteredItems.length)} είδη.`
              : "Δεν υπάρχουν αποτελέσματα."}
          </p>
        </CardContent>
      </Card>

      {/* Πινακίδες — όσες χωρούν ανά γραμμή */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
          {paginatedItems.map((item) => (
            <div
              key={item.ITEMS}
              title={item.NAME || "Χωρίς πινακίδα"}
              className="flex h-[29px] w-[80px] items-center overflow-hidden rounded border border-muted-foreground/40 bg-white"
            >
              {/* Λωρίδα ΕΕ */}
              <div className="flex h-full w-[24%] shrink-0 items-center justify-center bg-[#003399]">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  {/* Κύκλος με 12 αστέρια — σήμα της Ευρωπαϊκής Ένωσης */}
                  {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i * 30 - 90) * (Math.PI / 180);
                    const cx = 7 + 3.5 * Math.cos(angle);
                    const cy = 7 + 3.5 * Math.sin(angle);
                    const starPoints: string[] = [];
                    for (let j = 0; j < 5; j++) {
                      const outerAngle = (j * 144 - 90) * (Math.PI / 180);
                      starPoints.push(
                        `${cx + 1 * Math.cos(outerAngle)},${cy + 1 * Math.sin(outerAngle)}`
                      );
                      const innerAngle = ((j + 0.5) * 144 - 90) * (Math.PI / 180);
                      starPoints.push(
                        `${cx + 0.4 * Math.cos(innerAngle)},${cy + 0.4 * Math.sin(innerAngle)}`
                      );
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
              {/* Πινακίδα */}
              <div className="flex min-w-0 flex-1 items-center justify-center px-1">
                <span className="truncate font-mono text-xs font-bold tracking-wider text-black uppercase tabular-nums">
                  {item.NAME || "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Σελιδοποίηση */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="size-4" />
            Προηγούμενη
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
                  size="icon-sm"
                  aria-label={`Σελίδα ${pageNum}`}
                  title={`Σελίδα ${pageNum}`}
                  onClick={() => setCurrentPage(pageNum)}
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
          >
            Επόμενη
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {filteredItems.length === 0 && (
        <EmptyState
          title={search ? "Κανένα είδος δεν ταιριάζει στην αναζήτηση" : "Δεν υπάρχουν είδη"}
          description={
            search
              ? `Δεν βρέθηκε είδος για «${search}». Δοκιμάστε πινακίδα, κωδικό ή MTRL.`
              : "Καταχωρίστε το πρώτο είδος για να εμφανιστεί εδώ."
          }
          icon={Car}
          action={
            search ? (
              <Button variant="outline" onClick={() => setSearch("")}>
                Καθαρισμός αναζήτησης
              </Button>
            ) : (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="size-4" />
                Νέο είδος
              </Button>
            )
          }
        />
      )}

      {/* Παράθυρο καταχώρισης είδους */}
      <FormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title="Νέο είδος"
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
