"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreVertical, Plus, X, Edit, ChevronDown, ChevronRight as ChevronRightIcon, List, RefreshCw, CarFront, FileText, CalendarCheck, TriangleAlert, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { syncPlatesAction } from "@/app/(app)/contracts/actions";

interface INSTLINES {
  INSTLINES: number;
  INST: number | null;
  LINENUM: number | null;
  SODTYPE: number | null;
  MTRL: string | null;
  MTRL_NAME?: string | null;
  BUSUNITS: string | null;
  QTY: number | null;
  PRICE: number | null;
  FROMDATE: Date | null;
  FINALDATE: Date | null;
  COMMENTS: string | null;
  SNCODE: string | null;
  INSTLINESS: string | null;
  MTRUNIT: string | null;
  BAILTYPE: string | null;
  GPNT: string | null;
  TRDBRANCH: string | null;
  INSDATE: Date | null;
  UPDDATE: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerDetails {
  TRDR: string | null;
  CODE: string | null;
  NAME: string | null;
  AFM: string | null;
  COUNTRY: string | null;
  ADDRESS: string | null;
  ZIP: string | null;
  CITY: string | null;
  PHONE01: string | null;
  PHONE02: string | null;
  EMAIL: string | null;
  WEBPAGE: string | null;
  JOBTYPE: string | null;
}

interface INST {
  INST: number;
  CODE: string | null;
  NAME: string | null;
  ISACTIVE: number;
  INSTTYPE: string | null;
  TRDR: string | null;
  TRDBRANCH: string | null;
  BRANCH: string | null;
  BUSUNITS: string | null;
  SALESMAN: string | null;
  TRDRS: string | null;
  TRDBRANCHS: string | null;
  GPNT: string | null;
  PRSN: string | null;
  PRJC: string | null;
  FROMDATE: Date | null;
  BLOCKED: number | null;
  BLCKDATE: Date | null;
  GDATEFROM: Date | null;
  GDATETO: Date | null;
  WDATEFROM: Date | null;
  WDATETO: Date | null;
  INSDATE: Date | null;
  UPDDATE: Date | null;
  NUM01: number | null;
  REMARKS: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: INSTLINES[];
  CUSTOMER_NAME?: string | null;
  customerDetails?: CustomerDetails | null;
}

interface ContractsClientProps {
  installations: INST[];
  currentUserRole: Role;
  /** INSTLINES integration ID for "Sync plates" (sync plates for contracts in date range) */
  instLinesIntegrationId: string | null;
  /** COUNTRY id (as string) -> country name from COUNTRY table (for expand row) */
  countryNameByCode?: Record<string, string>;
}

interface ITEM {
  ITEMS: number;
  MTRL: string | null;
  CODE: string | null;
  NAME: string | null;
}

export function ContractsClient({ installations, currentUserRole, instLinesIntegrationId, countryNameByCode = {} }: ContractsClientProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [syncingPlates, setSyncingPlates] = useState(false);
  const [syncingInstId, setSyncingInstId] = useState<number | null>(null);
  const [syncPlatesModalOpen, setSyncPlatesModalOpen] = useState(false);
  const [syncPlatesProgress, setSyncPlatesProgress] = useState(0);
  const [syncPlatesMessage, setSyncPlatesMessage] = useState("");
  const [syncPlatesElapsed, setSyncPlatesElapsed] = useState(0);
  const syncPlatesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [addCarDialogOpen, setAddCarDialogOpen] = useState(false);
  const [selectedInst, setSelectedInst] = useState<INST | null>(null);
  const [items, setItems] = useState<ITEM[]>([]);
  const [itemsSearch, setItemsSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [newItemMtrl, setNewItemMtrl] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [editContractDialogOpen, setEditContractDialogOpen] = useState(false);
  const [editInstLineDialogOpen, setEditInstLineDialogOpen] = useState(false);
  const [editingInstLine, setEditingInstLine] = useState<INSTLINES | null>(null);
  const [contractFormData, setContractFormData] = useState<Partial<INST>>({});
  const [instLineFormData, setInstLineFormData] = useState<Partial<INSTLINES>>({});
  const [syncToErp, setSyncToErp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [instlinesModalInst, setInstlinesModalInst] = useState<INST | null>(null);
  const [expandedInstId, setExpandedInstId] = useState<number | null>(null);

  // Fetch ITEMS when dialog opens
  useEffect(() => {
    if (addCarDialogOpen && selectedInst) {
      fetchItems();
    }
  }, [addCarDialogOpen, selectedInst]);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/items");
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

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

  // Cleanup sync plates progress interval on unmount
  useEffect(() => {
    return () => {
      if (syncPlatesIntervalRef.current) {
        clearInterval(syncPlatesIntervalRef.current);
        syncPlatesIntervalRef.current = null;
      }
    };
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);

  // Filter installations based on search
  const filteredInstallations = useMemo(() => {
    if (!debouncedSearch.trim()) return installations;
    const searchLower = debouncedSearch.toLowerCase();
    
    return installations.filter((inst) => {
      return (
        inst.CODE?.toLowerCase().includes(searchLower) ||
        inst.NAME?.toLowerCase().includes(searchLower) ||
        String(inst.INST).includes(searchLower) ||
        inst.TRDR?.toLowerCase().includes(searchLower)
      );
    });
  }, [installations, debouncedSearch]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredInstallations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInstallations = filteredInstallations.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!itemsSearch.trim()) return items;
    const searchLower = itemsSearch.toLowerCase();
    return items.filter(item => 
      item.MTRL?.toLowerCase().includes(searchLower) ||
      item.CODE?.toLowerCase().includes(searchLower) ||
      item.NAME?.toLowerCase().includes(searchLower)
    );
  }, [items, itemsSearch]);

  const handleAddCarClick = (inst: INST) => {
    setSelectedInst(inst);
    setSelectedItems(new Set());
    setItemsSearch("");
    setNewItemMtrl("");
    setNewItemName("");
    setAddCarDialogOpen(true);
  };

  const handleItemToggle = (mtrl: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(mtrl)) {
      newSelected.delete(mtrl);
    } else {
      newSelected.add(mtrl);
    }
    setSelectedItems(newSelected);
  };

  const handleAddNewItem = async () => {
    if (!newItemMtrl.trim()) {
      toast.error("Το πεδίο MTRL (πινακίδα) είναι υποχρεωτικό");
      return;
    }

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          MTRL: newItemMtrl.trim().toUpperCase(),
          NAME: newItemName.trim() || newItemMtrl.trim().toUpperCase(),
          CODE: newItemMtrl.trim().toUpperCase(),
          ISACTIVE: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Add to selected items
        const newSelected = new Set(selectedItems);
        newSelected.add(newItemMtrl.trim().toUpperCase());
        setSelectedItems(newSelected);
        // Add to items list
        setItems([...items, data.item]);
        setNewItemMtrl("");
        setNewItemName("");
        toast.success("Το είδος δημιουργήθηκε");
      } else {
        const error = await response.json();
        toast.error(error.error || "Η δημιουργία είδους απέτυχε");
      }
    } catch (error) {
      console.error("Error creating item:", error);
      toast.error("Η δημιουργία είδους απέτυχε");
    }
  };

  const handleAddCarsToContract = async () => {
    if (!selectedInst || selectedItems.size === 0) {
      toast.error("Επιλέξτε τουλάχιστον ένα είδος");
      return;
    }

    setIsAddingItems(true);
    try {
      const response = await fetch("/api/contracts/add-cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instId: selectedInst.INST,
          mtrlList: Array.from(selectedItems),
          syncToErp: syncToErp,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Προστέθηκαν ${selectedItems.size.toLocaleString("el-GR")} οχήματα στο συμβόλαιο`);
        setAddCarDialogOpen(false);
        setSelectedItems(new Set());
        setSyncToErp(false);
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Η προσθήκη οχημάτων στο συμβόλαιο απέτυχε");
      }
    } catch (error) {
      console.error("Error adding cars to contract:", error);
      toast.error("Η προσθήκη οχημάτων στο συμβόλαιο απέτυχε");
    } finally {
      setIsAddingItems(false);
    }
  };

  const handleEditContractClick = (inst: INST) => {
    setSelectedInst(inst);
    setContractFormData({
      NAME: inst.NAME,
      ISACTIVE: inst.ISACTIVE,
      INSTTYPE: inst.INSTTYPE,
      TRDR: inst.TRDR,
      TRDBRANCH: inst.TRDBRANCH,
      BRANCH: inst.BRANCH,
      BUSUNITS: inst.BUSUNITS,
      SALESMAN: inst.SALESMAN,
      FROMDATE: inst.FROMDATE,
      WDATEFROM: inst.WDATEFROM,
      WDATETO: inst.WDATETO,
      NUM01: inst.NUM01,
      REMARKS: inst.REMARKS,
      BLOCKED: inst.BLOCKED,
    });
    setSyncToErp(false);
    setEditContractDialogOpen(true);
  };

  const handleEditInstLineClick = (instLine: INSTLINES, inst: INST) => {
    setEditingInstLine(instLine);
    setSelectedInst(inst);
    setInstLineFormData({
      MTRL: instLine.MTRL,
      LINENUM: instLine.LINENUM,
      QTY: instLine.QTY,
      PRICE: instLine.PRICE,
      MTRUNIT: instLine.MTRUNIT,
      FROMDATE: instLine.FROMDATE,
      FINALDATE: instLine.FINALDATE,
      COMMENTS: instLine.COMMENTS,
      SNCODE: instLine.SNCODE,
    });
    setSyncToErp(false);
    setEditInstLineDialogOpen(true);
  };

  const handleSaveContract = async () => {
    if (!selectedInst) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/contracts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instId: selectedInst.INST,
          data: contractFormData,
          syncToErp: syncToErp,
        }),
      });

      if (response.ok) {
        toast.success("Το συμβόλαιο ενημερώθηκε");
        setEditContractDialogOpen(false);
        setSyncToErp(false);
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Η ενημέρωση του συμβολαίου απέτυχε");
      }
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Η ενημέρωση του συμβολαίου απέτυχε");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInstLine = async () => {
    if (!editingInstLine || !selectedInst) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/contracts/instlines/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instId: selectedInst.INST,
          instLineId: editingInstLine.INSTLINES,
          data: instLineFormData,
          syncToErp: syncToErp,
        }),
      });

      if (response.ok) {
        toast.success("Η πινακίδα ενημερώθηκε");
        setEditInstLineDialogOpen(false);
        setEditingInstLine(null);
        setSyncToErp(false);
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Η ενημέρωση της πινακίδας απέτυχε");
      }
    } catch (error) {
      console.error("Error updating license plate:", error);
      toast.error("Η ενημέρωση της πινακίδας απέτυχε");
    } finally {
      setIsSaving(false);
    }
  };

  // Get license plates (MTRL) from INSTLINES
  const getLicensePlates = (lines: INSTLINES[]) => {
    return lines
      .filter(line => line.MTRL && String(line.MTRL).trim() !== '')
      .map(line => ({
        mtrl: line.MTRL!,
        name: line.MTRL_NAME || 'No name',
        instLine: line,
      }));
  };

  // Get all INSTLINES (including ones without MTRL)
  const getAllInstLines = (lines: INSTLINES[]) => {
    return lines || [];
  };

  /** Είναι το συμβόλαιο ενεργό σήμερα (WDATEFROM ≤ σήμερα ≤ WDATETO); */
  const isActiveOn = (inst: INST) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = inst.WDATEFROM ? new Date(inst.WDATEFROM) : null;
    const to = inst.WDATETO ? new Date(inst.WDATETO) : null;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(0, 0, 0, 0);
    return (!from || today >= from) && (!to || today <= to);
  };

  /** Υπέρβαση του ορίου οχημάτων (NUM01) από τις πινακίδες του συμβολαίου. */
  const isOverLimit = (inst: INST) => {
    const plates = inst.lines?.length ?? 0;
    const limit = inst.NUM01 != null ? Math.floor(Number(inst.NUM01)) : null;
    return limit != null && limit >= 0 && plates > limit;
  };

  const summary = useMemo(
    () => ({
      all: installations.length,
      active: installations.filter(isActiveOn).length,
      plates: installations.reduce((sum, inst) => sum + (inst.lines?.length ?? 0), 0),
      overLimit: installations.filter(isOverLimit).length,
    }),
    [installations]
  );

  return (
    <div ref={containerRef} className="space-y-4 opacity-0">
      <PageHeader
        title="Συμβόλαια"
        description="Συμβόλαια στάθμευσης (INST) του SoftOne με τις πινακίδες τους — εμφανίζονται όσα λήγουν από 30 Νοεμβρίου 2025 και μετά."
        icon={FileText}
        className="mb-0"
        actions={
          instLinesIntegrationId && installations.length > 0 ? (
              <Button
                variant="outline"
                disabled={syncingPlates}
                onClick={async () => {
                  setSyncingPlates(true);
                  setSyncPlatesModalOpen(true);
                  setSyncPlatesProgress(0);
                  setSyncPlatesMessage("Συγχρονισμός πινακίδων για όλα τα συμβόλαια…");
                  setSyncPlatesElapsed(0);
                  syncPlatesIntervalRef.current = setInterval(() => {
                    setSyncPlatesElapsed((e) => e + 1);
                    setSyncPlatesProgress((p) => Math.min(90, p + 1));
                  }, 1000);
                  try {
                    // Same as per-contract: pass all visible contract INST ids so API fetches INSTLINES and filters by these INSTs (no date range)
                    const instIds = installations.map((i) => i.INST);
                    const data = await syncPlatesAction(instLinesIntegrationId, instIds, false);
                    if (syncPlatesIntervalRef.current) {
                      clearInterval(syncPlatesIntervalRef.current);
                      syncPlatesIntervalRef.current = null;
                    }
                    setSyncPlatesProgress(100);
                    setSyncPlatesMessage("Ολοκληρώθηκε");
                    if (data.success) {
                      const created = data.stats?.erpToApp?.created ?? data.stats?.created ?? 0;
                      const updated = data.stats?.erpToApp?.updated ?? data.stats?.updated ?? 0;
                      setTimeout(() => {
                        setSyncPlatesModalOpen(false);
                        setSyncingPlates(false);
                        if (data.warning) {
                          toast.warning(data.warning, { duration: 8000 });
                        } else {
                          toast.success(`Συγχρονισμός πινακίδων: ${created.toLocaleString("el-GR")} νέες, ${updated.toLocaleString("el-GR")} ενημερώθηκαν`);
                        }
                        router.push("/contracts");
                      }, 500);
                    } else {
                      setTimeout(() => {
                        setSyncPlatesModalOpen(false);
                        setSyncingPlates(false);
                        toast.error(data.error || "Ο συγχρονισμός απέτυχε");
                      }, 500);
                    }
                  } catch (e) {
                    if (syncPlatesIntervalRef.current) {
                      clearInterval(syncPlatesIntervalRef.current);
                      syncPlatesIntervalRef.current = null;
                    }
                    setSyncPlatesProgress(100);
                    setSyncPlatesMessage("Σφάλμα");
                    setTimeout(() => {
                      setSyncPlatesModalOpen(false);
                      setSyncingPlates(false);
                      toast.error("Ο συγχρονισμός πινακίδων απέτυχε");
                    }, 500);
                  }
                }}
              >
                {syncingPlates ? <Spinner /> : <RefreshCw />}
                Συγχρονισμός πινακίδων
              </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Συμβόλαια"
          value={summary.all.toLocaleString("el-GR")}
          hint={`${filteredInstallations.length.toLocaleString("el-GR")} στην τρέχουσα αναζήτηση`}
          icon={FileText}
          tone="blue"
        />
        <KpiTile
          label="Ενεργά σήμερα"
          value={summary.active.toLocaleString("el-GR")}
          hint="σε ισχύ με βάση τις ημερομηνίες"
          icon={CalendarCheck}
          tone="green"
        />
        <KpiTile
          label="Πινακίδες"
          value={summary.plates.toLocaleString("el-GR")}
          hint="σύνολο γραμμών INSTLINES"
          icon={CarFront}
          tone="violet"
        />
        <KpiTile
          label="Υπέρβαση ορίου"
          value={summary.overLimit.toLocaleString("el-GR")}
          hint="περισσότερες πινακίδες από το NUM01"
          icon={TriangleAlert}
          tone="red"
        />
      </div>

      <Card role="region" aria-label="Φίλτρα συμβολαίων" className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="text"
              placeholder="Αναζήτηση σε κωδικό, τίτλο, αριθμό INST ή TRDR…"
              aria-label="Αναζήτηση συμβολαίων"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
              <X />
              Καθαρισμός
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-4 p-4">
          {/* Pagination Info */}
          {filteredInstallations.length > itemsPerPage && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="tabular-nums">
                Εμφάνιση {(startIndex + 1).toLocaleString("el-GR")}–{Math.min(endIndex, filteredInstallations.length).toLocaleString("el-GR")} από {filteredInstallations.length.toLocaleString("el-GR")} συμβόλαια
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  aria-label="Πρώτη σελίδα"
                  title="Πρώτη σελίδα"
                >
                  <ChevronsLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Προηγούμενη σελίδα"
                  title="Προηγούμενη σελίδα"
                >
                  <ChevronLeft />
                </Button>
                <span className="px-2 tabular-nums">
                  Σελίδα {currentPage.toLocaleString("el-GR")} από {totalPages.toLocaleString("el-GR")}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Επόμενη σελίδα"
                  title="Επόμενη σελίδα"
                >
                  <ChevronRight />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  aria-label="Τελευταία σελίδα"
                  title="Τελευταία σελίδα"
                >
                  <ChevronsRight />
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredInstallations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={installations.length === 0 ? "Δεν υπάρχουν συμβόλαια" : "Κανένα συμβόλαιο δεν ταιριάζει"}
              description={
                installations.length === 0
                  ? "Τρέξτε συγχρονισμό από τη σελίδα «Διασυνδέσεις» για να εισαχθούν τα συμβόλαια."
                  : "Δοκιμάστε διαφορετικούς όρους αναζήτησης ή καθαρίστε το φίλτρο."
              }
              action={
                installations.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    Καθαρισμός αναζήτησης
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Τίτλος</TableHead>
                  <TableHead className="max-w-[200px]">Παρατηρήσεις</TableHead>
                  <TableHead>Έναρξη</TableHead>
                  <TableHead>Λήξη</TableHead>
                  <TableHead>Ενεργό από</TableHead>
                  <TableHead className="text-right">Οχήματα</TableHead>
                  <TableHead>Κατάσταση</TableHead>
                  <TableHead className="w-[80px]">Ενέργειες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInstallations.map((installation) => {
                  const allInstLines = getAllInstLines(installation.lines || []);
                  // Show all lines; display name from MTRL_NAME or MTRL or "—"
                  const instLinesWithPlate = allInstLines;
                  const isExpanded = expandedInstId === installation.INST;
                  const customer = installation.customerDetails;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const from = installation.WDATEFROM ? new Date(installation.WDATEFROM) : null;
                  const to = installation.WDATETO ? new Date(installation.WDATETO) : null;
                  if (from) from.setHours(0, 0, 0, 0);
                  if (to) to.setHours(0, 0, 0, 0);
                  const isActiveToday = (!from || today >= from) && (!to || today <= to);
                  return (
                    <React.Fragment key={installation.INST}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell
                          className="w-8 cursor-pointer p-1 align-middle"
                          onClick={() => setExpandedInstId(isExpanded ? null : installation.INST)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                          ) : (
                            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                          )}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer font-medium"
                          onClick={() => setExpandedInstId(isExpanded ? null : installation.INST)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{installation.NAME || installation.CODE || `INST-${installation.INST}`}</span>
                            {installation.lines && installation.lines.length > 0 && (
                              <Badge variant="neutral" className="tabular-nums">
                                {installation.lines.length.toLocaleString("el-GR")} πινακίδες
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]" title={installation.REMARKS ?? undefined}>
                          <span className="line-clamp-2 text-muted-foreground">{installation.REMARKS ?? "—"}</span>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {installation.WDATEFROM
                            ? format(new Date(installation.WDATEFROM), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {installation.WDATETO
                            ? format(new Date(installation.WDATETO), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {installation.FROMDATE
                            ? format(new Date(installation.FROMDATE), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(() => {
                            const platesCount = installation.lines?.length ?? 0;
                            const num01 = installation.NUM01 != null ? Math.floor(Number(installation.NUM01)) : null;
                            const exceeded = num01 != null && num01 >= 0 && platesCount > num01;
                            return (
                              <span className="inline-flex items-center justify-end gap-1.5">
                                <span className={exceeded ? "font-medium text-destructive" : ""}>
                                  {num01 != null
                                    ? `${platesCount.toLocaleString("el-GR")} / ${num01.toLocaleString("el-GR")}`
                                    : platesCount > 0
                                      ? `${platesCount.toLocaleString("el-GR")} (χωρίς όριο)`
                                      : "—"}
                                </span>
                                {exceeded && <Badge variant="danger">Υπέρβαση</Badge>}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {isActiveToday ? (
                            <Badge variant="success">Ενεργό</Badge>
                          ) : (
                            <Badge variant="neutral">Ανενεργό</Badge>
                          )}
                        </TableCell>
                        <TableCell className="w-[80px]" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Ενέργειες συμβολαίου" title="Ενέργειες συμβολαίου">
                                <MoreVertical />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => handleEditContractClick(installation)}>
                                <Edit />
                                Επεξεργασία συμβολαίου
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddCarClick(installation)}>
                                <Plus />
                                Προσθήκη οχήματος
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setInstlinesModalInst(installation)}>
                                <List />
                                Προβολή γραμμών (INSTLINES)
                              </DropdownMenuItem>
                              {instLinesIntegrationId && (
                                <DropdownMenuItem
                                  disabled={syncingInstId === installation.INST}
                                  onClick={async () => {
                                    setSyncingInstId(installation.INST);
                                    try {
                                      const data = await syncPlatesAction(instLinesIntegrationId, [installation.INST]);
                                      if (data.success) {
                                        const created = data.stats?.erpToApp?.created ?? data.stats?.created ?? 0;
                                        const updated = data.stats?.erpToApp?.updated ?? data.stats?.updated ?? 0;
                                        if (data.warning) {
                                          toast.warning(data.warning, { duration: 8000 });
                                        } else {
                                          toast.success(`Συγχρονισμός πινακίδων: ${created.toLocaleString("el-GR")} νέες, ${updated.toLocaleString("el-GR")} ενημερώθηκαν`);
                                        }
                                        router.push("/contracts");
                                      } else {
                                        toast.error(data.error || "Ο συγχρονισμός απέτυχε");
                                      }
                                    } catch (e) {
                                      toast.error("Ο συγχρονισμός πινακίδων απέτυχε");
                                    } finally {
                                      setSyncingInstId(null);
                                    }
                                  }}
                                >
                                  {syncingInstId === installation.INST ? <Spinner /> : <RefreshCw />}
                                  Συγχρονισμός πινακίδων (αυτό το συμβόλαιο)
                                </DropdownMenuItem>
                              )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${installation.INST}-expanded`}>
                          <TableCell colSpan={9} className="bg-muted/40 p-0 align-top whitespace-normal">
                            <div className="space-y-3 p-3">
                              {/* Κεφαλίδα ανοιχτής γραμμής */}
                              <div className="min-w-0 space-y-1">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <h3 className="min-w-0 text-sm font-semibold break-words">
                                    {installation.NAME || installation.CODE || `INST-${installation.INST}`}
                                  </h3>
                                  {isActiveToday ? (
                                    <Badge variant="success">Ενεργό</Badge>
                                  ) : (
                                    <Badge variant="neutral">Ανενεργό</Badge>
                                  )}
                                  {isOverLimit(installation) && <Badge variant="danger">Υπέρβαση ορίου</Badge>}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                                  <span>
                                    INST <span className="font-mono text-foreground">{installation.INST}</span>
                                  </span>
                                  <span>
                                    CODE <span className="font-mono text-foreground">{installation.CODE ?? "—"}</span>
                                  </span>
                                  <span>
                                    TRDR <span className="font-mono text-foreground">{installation.TRDR ?? "—"}</span>
                                  </span>
                                  <span>
                                    Ισχύς {installation.WDATEFROM ? format(new Date(installation.WDATEFROM), "dd/MM/yyyy") : "—"} –{" "}
                                    {installation.WDATETO ? format(new Date(installation.WDATETO), "dd/MM/yyyy") : "—"}
                                  </span>
                                </div>
                              </div>

                              {/* Ενέργειες */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Button size="sm" onClick={() => handleEditContractClick(installation)}>
                                  <Edit />
                                  Επεξεργασία
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleAddCarClick(installation)}>
                                  <Plus />
                                  Προσθήκη οχήματος
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setInstlinesModalInst(installation)}>
                                  <List />
                                  Γραμμές (INSTLINES)
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <InfoPanel title="Πελάτης (TRDR)" accent="bg-chart-1">
                                  <InfoRow label="TRDR" mono>
                                    {customer?.TRDR ?? "—"}
                                  </InfoRow>
                                  <InfoRow label="Επωνυμία (NAME)" wrap>
                                    {customer?.NAME ?? "—"}
                                  </InfoRow>
                                  <InfoRow label="Κωδικός (CODE)" mono>
                                    {customer?.CODE ?? "—"}
                                  </InfoRow>
                                  <InfoRow label="ΑΦΜ (AFM)" mono>
                                    {customer?.AFM ?? "—"}
                                  </InfoRow>
                                  <InfoRow label="Δραστηριότητα (JOBTYPE)" wrap>
                                    {customer?.JOBTYPE ?? "—"}
                                  </InfoRow>
                                </InfoPanel>

                                <InfoPanel title="Διεύθυνση & επικοινωνία" accent="bg-chart-2">
                                  <InfoRow label="Οδός (ADDRESS)" wrap>
                                    {customer?.ADDRESS ?? "—"}
                                  </InfoRow>
                                  <InfoRow label="Πόλη (CITY)">{customer?.CITY ?? "—"}</InfoRow>
                                  <InfoRow label="Τ.Κ. (ZIP)">{customer?.ZIP ?? "—"}</InfoRow>
                                  <InfoRow label="Χώρα (COUNTRY)">
                                    {customer?.COUNTRY != null && customer.COUNTRY !== ""
                                      ? countryNameByCode[String(customer.COUNTRY)] ?? customer.COUNTRY
                                      : "—"}
                                  </InfoRow>
                                  <InfoRow label="Τηλέφωνο (PHONE01)">{customer?.PHONE01 ?? "—"}</InfoRow>
                                  <InfoRow label="Τηλέφωνο 2 (PHONE02)">{customer?.PHONE02 ?? "—"}</InfoRow>
                                </InfoPanel>

                                <InfoPanel title="Συμβόλαιο" accent="bg-chart-3">
                                  <InfoRow label="Έναρξη (WDATEFROM)">
                                    {installation.WDATEFROM ? format(new Date(installation.WDATEFROM), "dd/MM/yyyy") : "—"}
                                  </InfoRow>
                                  <InfoRow label="Λήξη (WDATETO)">
                                    {installation.WDATETO ? format(new Date(installation.WDATETO), "dd/MM/yyyy") : "—"}
                                  </InfoRow>
                                  <InfoRow label="Ενεργό από (FROMDATE)">
                                    {installation.FROMDATE ? format(new Date(installation.FROMDATE), "dd/MM/yyyy") : "—"}
                                  </InfoRow>
                                  <InfoRow label="Όριο οχημάτων (NUM01)">
                                    {installation.NUM01 != null
                                      ? Math.floor(Number(installation.NUM01)).toLocaleString("el-GR")
                                      : "—"}
                                  </InfoRow>
                                  <InfoRow label="Πινακίδες">
                                    {instLinesWithPlate.length.toLocaleString("el-GR")}
                                  </InfoRow>
                                </InfoPanel>

                                <InfoPanel title="Παρατηρήσεις" accent="bg-chart-4">
                                  <InfoRow label="Σχόλια (REMARKS)" wrap>
                                    {installation.REMARKS?.trim() ? installation.REMARKS : "—"}
                                  </InfoRow>
                                  <InfoRow label="Τύπος (INSTTYPE)">{installation.INSTTYPE ?? "—"}</InfoRow>
                                  <InfoRow label="Πωλητής (SALESMAN)">{installation.SALESMAN ?? "—"}</InfoRow>
                                </InfoPanel>
                              </div>

                              {/* Πινακίδες οχημάτων */}
                              <div className="rounded-md border bg-card p-3">
                                <h4 className="mb-2 text-xs font-semibold">
                                  Πινακίδες οχημάτων ({instLinesWithPlate.length.toLocaleString("el-GR")})
                                </h4>
                                {instLinesWithPlate.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {instLinesWithPlate.map((line) => {
                                      const plateName = (line.MTRL_NAME && String(line.MTRL_NAME).trim() !== "" ? line.MTRL_NAME : line.MTRL) ?? "—";
                                      return (
                                        <span
                                          key={line.INSTLINES}
                                          className="inline-flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pr-0.5 pl-2"
                                        >
                                          <span className="font-mono text-xs uppercase tabular-nums">{plateName}</span>
                                          <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleEditInstLineClick(line, installation)}
                                            aria-label={`Επεξεργασία πινακίδας ${plateName}`}
                                            title={`Επεξεργασία πινακίδας ${plateName}`}
                                          >
                                            <Edit />
                                          </Button>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    Καμία πινακίδα. Πατήστε «Συγχρονισμός πινακίδων» για να φορτωθούν από το ERP.
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Bottom Pagination Controls */}
          {filteredInstallations.length > itemsPerPage && (
            <div className="flex items-center justify-center gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="Πρώτη σελίδα"
                title="Πρώτη σελίδα"
              >
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                aria-label="Προηγούμενη σελίδα"
                title="Προηγούμενη σελίδα"
              >
                <ChevronLeft />
              </Button>
              <span className="px-2 text-xs text-muted-foreground tabular-nums">
                Σελίδα {currentPage.toLocaleString("el-GR")} από {totalPages.toLocaleString("el-GR")}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                aria-label="Επόμενη σελίδα"
                title="Επόμενη σελίδα"
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Τελευταία σελίδα"
                title="Τελευταία σελίδα"
              >
                <ChevronsRight />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* INSTLINES Modal — all lines for selected INST */}
      <Dialog open={!!instlinesModalInst} onOpenChange={(open) => !open && setInstlinesModalInst(null)}>
        <DialogContent className="flex flex-col sm:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Γραμμές συμβολαίου (INSTLINES) — {instlinesModalInst?.NAME || instlinesModalInst?.CODE || `INST-${instlinesModalInst?.INST}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {instlinesModalInst && (
              <>
                <div className="mb-2 text-xs text-muted-foreground tabular-nums">
                  Έναρξη: {instlinesModalInst.WDATEFROM ? format(new Date(instlinesModalInst.WDATEFROM), "dd/MM/yyyy") : "—"} · Λήξη: {instlinesModalInst.WDATETO ? format(new Date(instlinesModalInst.WDATETO), "dd/MM/yyyy") : "—"} · Όριο οχημάτων (NUM01): {instlinesModalInst.NUM01 ?? "—"}
                </div>
                {(instlinesModalInst.lines?.length ?? 0) === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground">Δεν υπάρχουν γραμμές για αυτό το συμβόλαιο.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Γραμμή (LINENUM)</TableHead>
                        <TableHead>Κωδικός (MTRL)</TableHead>
                        <TableHead>Πινακίδα</TableHead>
                        <TableHead className="text-right">Ποσότητα (QTY)</TableHead>
                        <TableHead>Από (FROMDATE)</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instlinesModalInst.lines?.map((line, idx) => (
                        <TableRow key={line.INSTLINES} className="hover:bg-muted/50">
                          <TableCell className="tabular-nums">{idx + 1}</TableCell>
                          <TableCell className="tabular-nums">{line.LINENUM ?? "—"}</TableCell>
                          <TableCell className="font-mono tabular-nums">{line.MTRL ?? "—"}</TableCell>
                          <TableCell className="font-mono uppercase tabular-nums">{line.MTRL_NAME ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{line.QTY != null ? line.QTY.toLocaleString("el-GR") : "—"}</TableCell>
                          <TableCell className="tabular-nums">
                            {line.FROMDATE ? format(new Date(line.FROMDATE), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-xs w-[60px]">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Επεξεργασία γραμμής"
                              title="Επεξεργασία γραμμής"
                              onClick={() => {
                                setInstlinesModalInst(null);
                                handleEditInstLineClick(line, instlinesModalInst);
                              }}
                            >
                              <Edit />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sync plates progress modal (server-side sync) */}
      <Dialog
        open={syncPlatesModalOpen}
        onOpenChange={(open) => {
          if (!syncingPlates) setSyncPlatesModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => syncingPlates && e.preventDefault()} onEscapeKeyDown={(e) => syncingPlates && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Συγχρονισμός πινακίδων</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{syncPlatesMessage}</p>
            <div className="space-y-2">
              <Progress value={syncPlatesProgress} className="h-2" />
              <p className="text-xs text-muted-foreground tabular-nums">
                {syncPlatesElapsed > 0 && `${syncPlatesElapsed.toLocaleString("el-GR")} δευτ.`}
                {syncPlatesProgress >= 100 && " — Ολοκληρώθηκε"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Ο συγχρονισμός εκτελείται στον διακομιστή. Μην κλείσετε το παράθυρο μέχρι να ολοκληρωθεί.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Car Dialog */}
      <Dialog open={addCarDialogOpen} onOpenChange={setAddCarDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Προσθήκη οχήματος στο συμβόλαιο {selectedInst?.CODE || `INST-${selectedInst?.INST}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Items */}
            <div className="space-y-2">
              <Label className="text-xs">Αναζήτηση ειδών (MTRL)</Label>
              <Command className="rounded-lg border">
                <CommandInput
                  placeholder="Αναζήτηση σε MTRL, CODE ή NAME…"
                  value={itemsSearch}
                  onValueChange={setItemsSearch}
                />
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>Δεν βρέθηκαν είδη.</CommandEmpty>
                  <CommandGroup>
                    {filteredItems.map((item) => (
                      <CommandItem
                        key={item.ITEMS}
                        value={`${item.MTRL} ${item.CODE} ${item.NAME}`}
                        onSelect={() => {
                          if (item.MTRL) {
                            handleItemToggle(item.MTRL);
                          }
                        }}
                        className="text-xs"
                      >
                        <div className="flex flex-1 items-center gap-2">
                          <Checkbox
                            checked={item.MTRL ? selectedItems.has(item.MTRL) : false}
                            onCheckedChange={() => item.MTRL && handleItemToggle(item.MTRL)}
                            aria-label={`Επιλογή είδους ${item.MTRL ?? ""}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-xs uppercase tabular-nums">{item.MTRL}</div>
                            {item.NAME && (
                              <div className="truncate text-xs text-muted-foreground">{item.NAME}</div>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* Selected Items */}
            {selectedItems.size > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Επιλεγμένα είδη ({selectedItems.size.toLocaleString("el-GR")})</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[60px]">
                  {Array.from(selectedItems).map((mtrl) => {
                    const item = items.find(i => i.MTRL === mtrl);
                    return (
                      <Badge key={mtrl} variant="neutral" className="font-mono uppercase tabular-nums">
                        {mtrl}
                        <button
                          type="button"
                          onClick={() => handleItemToggle(mtrl)}
                          aria-label={`Αφαίρεση ${mtrl}`}
                          title={`Αφαίρεση ${mtrl}`}
                          className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                        >
                          <X />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add New Item */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs">Νέο είδος (αν δεν υπάρχει στη λίστα)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Πινακίδα (MTRL) *</Label>
                  <Input
                    value={newItemMtrl}
                    onChange={(e) => setNewItemMtrl(e.target.value.toUpperCase())}
                    placeholder="π.χ. ΑΒΧ1234"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ονομασία</Label>
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Προαιρετικό"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddNewItem}
                disabled={!newItemMtrl.trim()}
               
                size="sm"
              >
                <Plus />
                Προσθήκη είδους
              </Button>
            </div>
          </div>

          {/* ERP Sync Checkbox */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <Checkbox
              id="sync-to-erp-add"
              checked={syncToErp}
              onCheckedChange={(checked) => setSyncToErp(checked === true)}
            />
            <Label htmlFor="sync-to-erp-add" className="text-xs">
              Συγχρονισμός στο ERP
            </Label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddCarDialogOpen(false);
                setSyncToErp(false);
              }}
             
            >
              Ακύρωση
            </Button>
            <Button
              onClick={handleAddCarsToContract}
              disabled={selectedItems.size === 0 || isAddingItems}
             
            >
              {isAddingItems ? "Προσθήκη…" : `Προσθήκη ${selectedItems.size.toLocaleString("el-GR")} οχημάτων`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog */}
      <Dialog open={editContractDialogOpen} onOpenChange={setEditContractDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Επεξεργασία συμβολαίου {selectedInst?.CODE || `INST-${selectedInst?.INST}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs">Τίτλος (NAME)</Label>
              <Input
                id="name"
                value={contractFormData.NAME || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, NAME: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="isactive" className="text-xs">Ενεργό (ISACTIVE)</Label>
              <Select
                value={String(contractFormData.ISACTIVE ?? 1)}
                onValueChange={(value) => setContractFormData({ ...contractFormData, ISACTIVE: Number(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Ενεργό</SelectItem>
                  <SelectItem value="0">Ανενεργό</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Important Fields Section */}
            <div className="mb-2 border-b pb-1 text-xs font-semibold text-muted-foreground">Στοιχεία συμβολαίου</div>

            <div className="space-y-1">
              <Label htmlFor="trdr" className="text-xs">
                Πελάτης (TRDR) *
              </Label>
              <Input
                id="trdr"
                value={contractFormData.TRDR || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, TRDR: e.target.value })}
                placeholder="Κωδικός πελάτη (TRDR)"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="wdatefrom" className="text-xs">
                  Έναρξη συμβολαίου (WDATEFROM) *
                </Label>
                <Input
                  id="wdatefrom"
                  type="date"
                  value={contractFormData.WDATEFROM ? format(new Date(contractFormData.WDATEFROM), "yyyy-MM-dd") : ""}
                  onChange={(e) => setContractFormData({ 
                    ...contractFormData, 
                    WDATEFROM: e.target.value ? new Date(e.target.value) : null 
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wdateto" className="text-xs">
                  Λήξη ισχύος (WDATETO) *
                </Label>
                <Input
                  id="wdateto"
                  type="date"
                  value={contractFormData.WDATETO ? format(new Date(contractFormData.WDATETO), "yyyy-MM-dd") : ""}
                  onChange={(e) => setContractFormData({ 
                    ...contractFormData, 
                    WDATETO: e.target.value ? new Date(e.target.value) : null 
                  })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="num01" className="text-xs">
                  Μέγιστα ταυτόχρονα οχήματα (NUM01) *
                </Label>
                <Input
                  id="num01"
                  type="number"
                  min="0"
                  step="1"
                  value={contractFormData.NUM01 !== null && contractFormData.NUM01 !== undefined ? contractFormData.NUM01 : ""}
                  onChange={(e) => setContractFormData({ 
                    ...contractFormData, 
                    NUM01: e.target.value ? Number(e.target.value) : null 
                  })}
                  placeholder="Επιτρεπόμενα ταυτόχρονα οχήματα"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fromdate" className="text-xs">
                  Ημερομηνία ενεργοποίησης (FROMDATE) *
                </Label>
                <Input
                  id="fromdate"
                  type="date"
                  value={contractFormData.FROMDATE ? format(new Date(contractFormData.FROMDATE), "yyyy-MM-dd") : ""}
                  onChange={(e) => setContractFormData({ 
                    ...contractFormData, 
                    FROMDATE: e.target.value ? new Date(e.target.value) : null 
                  })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="remarks" className="text-xs">Παρατηρήσεις (REMARKS)</Label>
              <Textarea
                id="remarks"
                value={contractFormData.REMARKS || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, REMARKS: e.target.value })}
                rows={3}
                placeholder="Σημειώσεις ή παρατηρήσεις"
              />
            </div>

            {/* Other Fields Section */}
            <div className="mt-4 mb-2 border-b pb-1 text-xs font-semibold text-muted-foreground">Πρόσθετα στοιχεία</div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="trdbranch" className="text-xs">Υποκατάστημα πελάτη (TRDBRANCH)</Label>
                <Input
                  id="trdbranch"
                  value={contractFormData.TRDBRANCH || ""}
                  onChange={(e) => setContractFormData({ ...contractFormData, TRDBRANCH: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="branch" className="text-xs">Υποκατάστημα (BRANCH)</Label>
                <Input
                  id="branch"
                  value={contractFormData.BRANCH || ""}
                  onChange={(e) => setContractFormData({ ...contractFormData, BRANCH: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="salesman" className="text-xs">Πωλητής (SALESMAN)</Label>
              <Input
                id="salesman"
                value={contractFormData.SALESMAN || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, SALESMAN: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="blocked" className="text-xs">Φραγή (BLOCKED)</Label>
              <Select
                value={String(contractFormData.BLOCKED ?? 0)}
                onValueChange={(value) => setContractFormData({ ...contractFormData, BLOCKED: Number(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Χωρίς φραγή</SelectItem>
                  <SelectItem value="1">Με φραγή</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ERP Sync Checkbox */}
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="sync-to-erp-contract"
                checked={syncToErp}
                onCheckedChange={(checked) => setSyncToErp(checked === true)}
              />
              <Label htmlFor="sync-to-erp-contract" className="text-xs">
                Sync to ERP
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditContractDialogOpen(false);
                setSyncToErp(false);
              }}
             
            >
              Ακύρωση
            </Button>
            <Button
              onClick={handleSaveContract}
              disabled={isSaving}
             
            >
              {isSaving ? "Αποθήκευση…" : "Αποθήκευση αλλαγών"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit INSTLINES Dialog */}
      <Dialog open={editInstLineDialogOpen} onOpenChange={setEditInstLineDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Επεξεργασία πινακίδας {editingInstLine?.MTRL}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="mtrl" className="text-xs">Πινακίδα (MTRL)</Label>
              <Input
                id="mtrl"
                value={instLineFormData.MTRL || ""}
                onChange={(e) => setInstLineFormData({ ...instLineFormData, MTRL: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="linenum" className="text-xs">Αριθμός γραμμής (LINENUM)</Label>
                <Input
                  id="linenum"
                  type="number"
                  value={instLineFormData.LINENUM || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, LINENUM: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qty" className="text-xs">Ποσότητα (QTY)</Label>
                <Input
                  id="qty"
                  type="number"
                  step="0.01"
                  value={instLineFormData.QTY || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, QTY: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="price" className="text-xs">Τιμή (PRICE)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={instLineFormData.PRICE || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, PRICE: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mtrunit" className="text-xs">Μονάδα (MTRUNIT)</Label>
                <Input
                  id="mtrunit"
                  value={instLineFormData.MTRUNIT || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, MTRUNIT: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="fromdate-line" className="text-xs">Ημερομηνία από (FROMDATE)</Label>
                <Input
                  id="fromdate-line"
                  type="date"
                  value={instLineFormData.FROMDATE ? format(new Date(instLineFormData.FROMDATE), "yyyy-MM-dd") : ""}
                  onChange={(e) => setInstLineFormData({ 
                    ...instLineFormData, 
                    FROMDATE: e.target.value ? new Date(e.target.value) : null 
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="finaldate" className="text-xs">Ημερομηνία λήξης (FINALDATE)</Label>
                <Input
                  id="finaldate"
                  type="date"
                  value={instLineFormData.FINALDATE ? format(new Date(instLineFormData.FINALDATE), "yyyy-MM-dd") : ""}
                  onChange={(e) => setInstLineFormData({ 
                    ...instLineFormData, 
                    FINALDATE: e.target.value ? new Date(e.target.value) : null 
                  })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sncode" className="text-xs">Σειριακός (SNCODE)</Label>
              <Input
                id="sncode"
                value={instLineFormData.SNCODE || ""}
                onChange={(e) => setInstLineFormData({ ...instLineFormData, SNCODE: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="comments" className="text-xs">Σχόλια (COMMENTS)</Label>
              <Textarea
                id="comments"
                value={instLineFormData.COMMENTS || ""}
                onChange={(e) => setInstLineFormData({ ...instLineFormData, COMMENTS: e.target.value })}
                rows={3}
              />
            </div>

            {/* ERP Sync Checkbox */}
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="sync-to-erp-instline"
                checked={syncToErp}
                onCheckedChange={(checked) => setSyncToErp(checked === true)}
              />
              <Label htmlFor="sync-to-erp-instline" className="text-xs">
                Sync to ERP
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditInstLineDialogOpen(false);
                setEditingInstLine(null);
                setSyncToErp(false);
              }}
             
            >
              Ακύρωση
            </Button>
            <Button
              onClick={handleSaveInstLine}
              disabled={isSaving}
             
            >
              {isSaving ? "Αποθήκευση…" : "Αποθήκευση αλλαγών"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
