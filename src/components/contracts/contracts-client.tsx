"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreVertical, Plus, Check, X, Edit, Trash2, ChevronDown, ChevronRight as ChevronRightIcon, List, RefreshCw, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import { formFieldStyles } from "@/lib/form-styles";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

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
}

interface ITEM {
  ITEMS: number;
  MTRL: string | null;
  CODE: string | null;
  NAME: string | null;
}

export function ContractsClient({ installations, currentUserRole, instLinesIntegrationId }: ContractsClientProps) {
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
      toast.error("MTRL (license plate) is required");
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
        toast.success("Item created successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create item");
      }
    } catch (error) {
      console.error("Error creating item:", error);
      toast.error("Failed to create item");
    }
  };

  const handleAddCarsToContract = async () => {
    if (!selectedInst || selectedItems.size === 0) {
      toast.error("Please select at least one item");
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
        toast.success(`Successfully added ${selectedItems.size} car(s) to contract`);
        setAddCarDialogOpen(false);
        setSelectedItems(new Set());
        setSyncToErp(false);
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add cars to contract");
      }
    } catch (error) {
      console.error("Error adding cars to contract:", error);
      toast.error("Failed to add cars to contract");
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
        toast.success("Contract updated successfully");
        setEditContractDialogOpen(false);
        setSyncToErp(false);
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update contract");
      }
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Failed to update contract");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInstLine = async () => {
    if (!editingInstLine) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/contracts/instlines/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instLineId: editingInstLine.INSTLINES,
          data: instLineFormData,
          syncToErp: syncToErp,
        }),
      });

      if (response.ok) {
        toast.success("License plate updated successfully");
        setEditInstLineDialogOpen(false);
        setEditingInstLine(null);
        setSyncToErp(false);
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update license plate");
      }
    } catch (error) {
      console.error("Error updating license plate:", error);
      toast.error("Failed to update license plate");
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

  return (
    <div ref={containerRef} className="space-y-6 opacity-0">
      <PageHeader
        title="CONTRACTS"
        highlight="CONTRACTS"
        subtitle={`Viewing ${filteredInstallations.length} of ${installations.length} contract${installations.length !== 1 ? "s" : ""} (Date To max 2 months old)`}
      />

      <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <div className="p-6 space-y-4">
          {/* Search Box + Sync plates */}
          <div className="flex items-center gap-4 flex-wrap">
            <Input
              type="text"
              placeholder="Search by code, name, INST number, or TRDR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md h-7 text-sm"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearch("")}
                className="h-7 text-sm"
              >
                Clear
              </Button>
            )}
            {instLinesIntegrationId && installations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-sm gap-1.5"
                disabled={syncingPlates}
                onClick={async () => {
                  setSyncingPlates(true);
                  setSyncPlatesModalOpen(true);
                  setSyncPlatesProgress(0);
                  setSyncPlatesMessage("Syncing plates from ERP…");
                  setSyncPlatesElapsed(0);
                  // Simulated progress 0 → 90% over ~90s while server runs
                  syncPlatesIntervalRef.current = setInterval(() => {
                    setSyncPlatesElapsed((e) => e + 1);
                    setSyncPlatesProgress((p) => Math.min(90, p + 1));
                  }, 1000);
                  try {
                    const instIds = installations.map((i) => i.INST);
                    const res = await fetch("/api/cron/sync-integration", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        integrationId: instLinesIntegrationId,
                        instIds,
                      }),
                    });
                    const data = await res.json();
                    if (syncPlatesIntervalRef.current) {
                      clearInterval(syncPlatesIntervalRef.current);
                      syncPlatesIntervalRef.current = null;
                    }
                    setSyncPlatesProgress(100);
                    setSyncPlatesMessage("Complete");
                    if (data.success) {
                      const created = data.stats?.erpToApp?.created ?? data.stats?.created ?? 0;
                      const updated = data.stats?.erpToApp?.updated ?? data.stats?.updated ?? 0;
                      setTimeout(() => {
                        setSyncPlatesModalOpen(false);
                        setSyncingPlates(false);
                        toast.success(`Plates synced: ${created} created, ${updated} updated`);
                        router.refresh();
                      }, 500);
                    } else {
                      setTimeout(() => {
                        setSyncPlatesModalOpen(false);
                        setSyncingPlates(false);
                        toast.error(data.error || "Sync failed");
                      }, 500);
                    }
                  } catch (e) {
                    if (syncPlatesIntervalRef.current) {
                      clearInterval(syncPlatesIntervalRef.current);
                      syncPlatesIntervalRef.current = null;
                    }
                    setSyncPlatesProgress(100);
                    setSyncPlatesMessage("Error");
                    setTimeout(() => {
                      setSyncPlatesModalOpen(false);
                      setSyncingPlates(false);
                      toast.error("Failed to sync plates");
                    }, 500);
                  }
                }}
              >
                {syncingPlates ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sync plates
              </Button>
            )}
          </div>

          {/* Pagination Info */}
          {filteredInstallations.length > itemsPerPage && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                Showing {startIndex + 1} to {Math.min(endIndex, filteredInstallations.length)} of {filteredInstallations.length} contracts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-7 px-2 text-sm"
                >
                  <ChevronsLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-7 px-2 text-sm"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 px-2 text-sm"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-7 px-2 text-sm"
                >
                  <ChevronsRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredInstallations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[11px] text-muted-foreground mb-2">
                {installations.length === 0 
                  ? "No contracts found in the database."
                  : "No contracts match your search criteria."}
              </p>
              {installations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Please run a sync from the Integrations page to import contracts.
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-muted-foreground/20">
                  <TableHead className="text-sm font-bold uppercase w-8"></TableHead>
                  <TableHead className="text-sm font-bold uppercase">Title</TableHead>
                  <TableHead className="text-sm font-bold uppercase max-w-[200px]">Remarks</TableHead>
                  <TableHead className="text-sm font-bold uppercase">Start Date</TableHead>
                  <TableHead className="text-sm font-bold uppercase">Date To</TableHead>
                  <TableHead className="text-sm font-bold uppercase">Active From</TableHead>
                  <TableHead className="text-sm font-bold uppercase">Car.No</TableHead>
                  <TableHead className="text-sm font-bold uppercase">Status</TableHead>
                  <TableHead className="text-sm font-bold uppercase w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInstallations.map((installation) => {
                  const allInstLines = getAllInstLines(installation.lines || []);
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
                      <TableRow
                        className="border-muted-foreground/20 hover:bg-muted/50"
                      >
                        <TableCell
                          className="text-sm w-8 p-1 cursor-pointer align-middle"
                          onClick={() => setExpandedInstId(isExpanded ? null : installation.INST)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell
                          className="text-sm font-medium cursor-pointer"
                          onClick={() => setExpandedInstId(isExpanded ? null : installation.INST)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{installation.NAME || installation.CODE || `INST-${installation.INST}`}</span>
                            {installation.lines && installation.lines.length > 0 && (
                              <Badge variant="secondary" className="text-[0.5rem] px-1.5 py-0.5 font-medium">
                                With plates ({installation.lines.length})
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]" title={installation.REMARKS ?? undefined}>
                          <span className="line-clamp-2 text-muted-foreground">{installation.REMARKS ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {installation.WDATEFROM
                            ? format(new Date(installation.WDATEFROM), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {installation.WDATETO
                            ? format(new Date(installation.WDATETO), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {installation.FROMDATE
                            ? format(new Date(installation.FROMDATE), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(() => {
                            const platesCount = installation.lines?.length ?? 0;
                            const num01 = installation.NUM01 != null ? Math.floor(Number(installation.NUM01)) : null;
                            const exceeded = num01 != null && num01 >= 0 && platesCount > num01;
                            return (
                              <span className={exceeded ? "text-destructive font-medium" : ""}>
                                {num01 != null
                                  ? `${platesCount} / ${num01}`
                                  : platesCount > 0
                                    ? `${platesCount} (no limit)`
                                    : "—"}
                                {exceeded && (
                                  <Badge variant="destructive" className="ml-1.5 text-[0.5rem] px-1 py-0">
                                    Exceeded
                                  </Badge>
                                )}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {isActiveToday ? (
                            <Badge className="bg-green-600 hover:bg-green-600 text-white text-sm font-medium">
                              Active
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm w-[80px]" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleEditContractClick(installation)}>
                                <Edit className="h-3 w-3 mr-2" />
                                Edit Contract
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddCarClick(installation)}>
                                <Plus className="h-3 w-3 mr-2" />
                                Add New Car
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setInstlinesModalInst(installation)}>
                                <List className="h-3 w-3 mr-2" />
                                View INSTLINES (modal)
                              </DropdownMenuItem>
                              {instLinesIntegrationId && (
                                <DropdownMenuItem
                                  disabled={syncingInstId === installation.INST}
                                  onClick={async () => {
                                    setSyncingInstId(installation.INST);
                                    try {
                                      const res = await fetch("/api/cron/sync-integration", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          integrationId: instLinesIntegrationId,
                                          instIds: [installation.INST],
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        const created = data.stats?.erpToApp?.created ?? data.stats?.created ?? 0;
                                        const updated = data.stats?.erpToApp?.updated ?? data.stats?.updated ?? 0;
                                        toast.success(`Plates synced: ${created} created, ${updated} updated`);
                                        router.refresh();
                                      } else {
                                        toast.error(data.error || "Sync failed");
                                      }
                                    } catch (e) {
                                      toast.error("Failed to sync plates");
                                    } finally {
                                      setSyncingInstId(null);
                                    }
                                  }}
                                >
                                  {syncingInstId === installation.INST ? (
                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 mr-2" />
                                  )}
                                  Sync plates (this contract)
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${installation.INST}-expanded`} className="bg-muted/30 border-muted-foreground/20">
                          <TableCell colSpan={8} className="p-4 align-top">
                            <div className="grid gap-4 md:grid-cols-2 text-sm">
                              {/* Customer details (TRDR) */}
                              <div className="space-y-2">
                                <div className="font-bold uppercase text-muted-foreground border-b pb-1 text-sm">Customer (TRDR)</div>
                                {customer ? (
                                  <div className="space-y-1">
                                    {customer.TRDR && <div><span className="text-muted-foreground">TRDR:</span> {customer.TRDR}</div>}
                                    {customer.NAME && <div><span className="text-muted-foreground">Name:</span> {customer.NAME}</div>}
                                    {customer.CODE && <div><span className="text-muted-foreground">Code:</span> {customer.CODE}</div>}
                                    {customer.AFM && <div><span className="text-muted-foreground">AFM:</span> {customer.AFM}</div>}
                                    {customer.ADDRESS && <div><span className="text-muted-foreground">Address:</span> {customer.ADDRESS}</div>}
                                    {customer.CITY && <div><span className="text-muted-foreground">City:</span> {customer.CITY}</div>}
                                    {customer.ZIP && <div><span className="text-muted-foreground">ZIP:</span> {customer.ZIP}</div>}
                                    {customer.COUNTRY && <div><span className="text-muted-foreground">Country:</span> {customer.COUNTRY}</div>}
                                    {customer.PHONE01 && <div><span className="text-muted-foreground">Phone:</span> {customer.PHONE01}</div>}
                                    {customer.PHONE02 && <div><span className="text-muted-foreground">Phone 2:</span> {customer.PHONE02}</div>}
                                    {customer.EMAIL && <div><span className="text-muted-foreground">Email:</span> {customer.EMAIL}</div>}
                                    {customer.WEBPAGE && <div><span className="text-muted-foreground">Web:</span> {customer.WEBPAGE}</div>}
                                    {customer.JOBTYPE && <div><span className="text-muted-foreground">Job type:</span> {customer.JOBTYPE}</div>}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground">No customer (TRDR) found for this contract.</div>
                                )}
                              </div>
                              {/* INSTLINES table */}
                              <div className="space-y-2">
                                <div className="font-bold uppercase text-muted-foreground border-b pb-1 text-sm">INSTLINES ({allInstLines.length})</div>
                                {allInstLines.length === 0 ? (
                                  <div className="text-muted-foreground text-sm">No INSTLINES.</div>
                                ) : (
                                  <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="border-muted-foreground/20">
                                          <TableHead className="text-sm font-bold">#</TableHead>
                                          <TableHead className="text-sm font-bold">LINENUM</TableHead>
                                          <TableHead className="text-sm font-bold">MTRL</TableHead>
                                          <TableHead className="text-sm font-bold">Name</TableHead>
                                          <TableHead className="text-sm font-bold">QTY</TableHead>
                                          <TableHead className="text-sm font-bold"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {allInstLines.map((line, idx) => (
                                          <TableRow key={line.INSTLINES} className="border-muted-foreground/10">
                                            <TableCell className="text-sm">{idx + 1}</TableCell>
                                            <TableCell className="text-sm">{line.LINENUM ?? "—"}</TableCell>
                                            <TableCell className="text-sm font-medium">{line.MTRL ?? "—"}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{line.MTRL_NAME ?? "—"}</TableCell>
                                            <TableCell className="text-sm">{line.QTY ?? "—"}</TableCell>
                                            <TableCell className="text-sm p-1">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0"
                                                onClick={() => handleEditInstLineClick(line, installation)}
                                              >
                                                <Edit className="h-2.5 w-2.5" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
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
            <div className="flex items-center justify-center gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-7 px-2 text-sm"
              >
                <ChevronsLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2 text-sm"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-7 px-2 text-sm"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-7 px-2 text-sm"
              >
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* INSTLINES Modal — all lines for selected INST */}
      <Dialog open={!!instlinesModalInst} onOpenChange={(open) => !open && setInstlinesModalInst(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[11px] font-bold uppercase">
              INSTLINES — {instlinesModalInst?.NAME || instlinesModalInst?.CODE || `INST-${instlinesModalInst?.INST}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {instlinesModalInst && (
              <>
                <div className="text-sm text-muted-foreground mb-2">
                  Start Date: {instlinesModalInst.WDATEFROM ? format(new Date(instlinesModalInst.WDATEFROM), "dd/MM/yyyy") : "—"} · Date To: {instlinesModalInst.WDATETO ? format(new Date(instlinesModalInst.WDATETO), "dd/MM/yyyy") : "—"} · Car.No: {instlinesModalInst.NUM01 ?? "—"}
                </div>
                {(instlinesModalInst.lines?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No INSTLINES for this contract.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-muted-foreground/20">
                        <TableHead className="text-sm font-bold uppercase">#</TableHead>
                        <TableHead className="text-sm font-bold uppercase">LINENUM</TableHead>
                        <TableHead className="text-sm font-bold uppercase">MTRL</TableHead>
                        <TableHead className="text-sm font-bold uppercase">Name</TableHead>
                        <TableHead className="text-sm font-bold uppercase">QTY</TableHead>
                        <TableHead className="text-sm font-bold uppercase">FROMDATE</TableHead>
                        <TableHead className="text-sm font-bold uppercase w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instlinesModalInst.lines?.map((line, idx) => (
                        <TableRow
                          key={line.INSTLINES}
                          className="border-muted-foreground/20 hover:bg-muted/50"
                        >
                          <TableCell className="text-sm">{idx + 1}</TableCell>
                          <TableCell className="text-sm">{line.LINENUM ?? "—"}</TableCell>
                          <TableCell className="text-sm font-medium">{line.MTRL ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{line.MTRL_NAME ?? "—"}</TableCell>
                          <TableCell className="text-sm">{line.QTY ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            {line.FROMDATE ? format(new Date(line.FROMDATE), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-sm w-[60px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setInstlinesModalInst(null);
                                handleEditInstLineClick(line, instlinesModalInst);
                              }}
                            >
                              <Edit className="h-3 w-3" />
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
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => syncingPlates && e.preventDefault()} onEscapeKeyDown={(e) => syncingPlates && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Sync plates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{syncPlatesMessage}</p>
            <div className="space-y-2">
              <Progress value={syncPlatesProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {syncPlatesElapsed > 0 && `${syncPlatesElapsed}s elapsed`}
                {syncPlatesProgress >= 100 && " — Done"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Sync runs on the server. Do not close this window until complete.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Car Dialog */}
      <Dialog open={addCarDialogOpen} onOpenChange={setAddCarDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[11px] font-bold uppercase">
              Add New Car to Contract: {selectedInst?.CODE || `INST-${selectedInst?.INST}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Items */}
            <div className="space-y-2">
              <label className={formFieldStyles.label}>Search Items (MTRL)</label>
              <Command className="rounded-lg border">
                <CommandInput 
                  placeholder="Search by MTRL, CODE, or NAME..." 
                  value={itemsSearch}
                  onValueChange={setItemsSearch}
                  className="h-7 text-sm"
                />
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>No items found.</CommandEmpty>
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
                        className="text-sm"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Checkbox
                            checked={item.MTRL ? selectedItems.has(item.MTRL) : false}
                            onCheckedChange={() => item.MTRL && handleItemToggle(item.MTRL)}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.MTRL}</div>
                            {item.NAME && (
                              <div className="text-sm text-muted-foreground">{item.NAME}</div>
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
                <label className={formFieldStyles.label}>Selected Items ({selectedItems.size})</label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[60px]">
                  {Array.from(selectedItems).map((mtrl) => {
                    const item = items.find(i => i.MTRL === mtrl);
                    return (
                      <Badge key={mtrl} variant="secondary" className="text-sm px-2 py-1">
                        {mtrl}
                        <button
                          onClick={() => handleItemToggle(mtrl)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add New Item */}
            <div className="space-y-2 border-t pt-4">
              <label className={formFieldStyles.label}>Add New Item (if not in list)</label>
              <div className="grid grid-cols-2 gap-2">
                <div className={formFieldStyles.fieldSpacing}>
                  <label className={formFieldStyles.label}>MTRL (License Plate) *</label>
                  <Input
                    value={newItemMtrl}
                    onChange={(e) => setNewItemMtrl(e.target.value.toUpperCase())}
                    placeholder="e.g., ABC1234"
                    className={formFieldStyles.input}
                  />
                </div>
                <div className={formFieldStyles.fieldSpacing}>
                  <label className={formFieldStyles.label}>Name</label>
                  <Input
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Optional"
                    className={formFieldStyles.input}
                  />
                </div>
              </div>
              <Button
                onClick={handleAddNewItem}
                disabled={!newItemMtrl.trim()}
                className={formFieldStyles.button}
                size="sm"
              >
                <Plus className={formFieldStyles.buttonIcon} />
                Add New Item
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
            <Label htmlFor="sync-to-erp-add" className={formFieldStyles.label}>
              Sync to ERP
            </Label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddCarDialogOpen(false);
                setSyncToErp(false);
              }}
              className={formFieldStyles.button}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCarsToContract}
              disabled={selectedItems.size === 0 || isAddingItems}
              className={formFieldStyles.button}
            >
              {isAddingItems ? "Adding..." : `Add ${selectedItems.size} Car(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog */}
      <Dialog open={editContractDialogOpen} onOpenChange={setEditContractDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[11px] font-bold uppercase">
              Edit Contract: {selectedInst?.CODE || `INST-${selectedInst?.INST}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className={formFieldStyles.formSpacing}>
            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="name" className={formFieldStyles.label}>NAME</Label>
              <Input
                id="name"
                value={contractFormData.NAME || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, NAME: e.target.value })}
                className={formFieldStyles.input}
              />
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="isactive" className={formFieldStyles.label}>ISACTIVE</Label>
              <Select
                value={String(contractFormData.ISACTIVE ?? 1)}
                onValueChange={(value) => setContractFormData({ ...contractFormData, ISACTIVE: Number(value) })}
              >
                <SelectTrigger className={formFieldStyles.select}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className={formFieldStyles.selectItem}>Active</SelectItem>
                  <SelectItem value="0" className={formFieldStyles.selectItem}>Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Important Fields Section */}
            <div className={`${formFieldStyles.sectionHeader} border-b pb-1 mb-2`}>CONTRACT DETAILS</div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="trdr" className={formFieldStyles.label}>
                TRDR (Customer Reference) *
              </Label>
              <Input
                id="trdr"
                value={contractFormData.TRDR || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, TRDR: e.target.value })}
                className={formFieldStyles.input}
                placeholder="Customer reference from TRDR model"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="wdatefrom" className={formFieldStyles.label}>
                  Contract Start Date (WDATEFROM) *
                </Label>
                <Input
                  id="wdatefrom"
                  type="date"
                  value={contractFormData.WDATEFROM ? format(new Date(contractFormData.WDATEFROM), "yyyy-MM-dd") : ""}
                  onChange={(e) => setContractFormData({ 
                    ...contractFormData, 
                    WDATEFROM: e.target.value ? new Date(e.target.value) : null 
                  })}
                  className={formFieldStyles.input}
                />
              </div>
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="wdateto" className={formFieldStyles.label}>
                  Valid Until (WDATETO) *
                </Label>
                <Input
                  id="wdateto"
                  type="date"
                  value={contractFormData.WDATETO ? format(new Date(contractFormData.WDATETO), "yyyy-MM-dd") : ""}
                  onChange={(e) => setContractFormData({ 
                    ...contractFormData, 
                    WDATETO: e.target.value ? new Date(e.target.value) : null 
                  })}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="num01" className={formFieldStyles.label}>
                  Max Concurrent Cars (NUM01) *
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
                  className={formFieldStyles.input}
                  placeholder="Allowed concurrent parked cars"
                />
              </div>
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="fromdate" className={formFieldStyles.label}>
                  Activation Date (FROMDATE) *
                </Label>
                <Input
                  id="fromdate"
                  type="date"
                  value={contractFormData.FROMDATE ? format(new Date(contractFormData.FROMDATE), "yyyy-MM-dd") : ""}
                  onChange={(e) => setContractFormData({ 
                    ...contractFormData, 
                    FROMDATE: e.target.value ? new Date(e.target.value) : null 
                  })}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="remarks" className={formFieldStyles.label}>REMARKS</Label>
              <Textarea
                id="remarks"
                value={contractFormData.REMARKS || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, REMARKS: e.target.value })}
                className={formFieldStyles.textarea}
                rows={3}
                placeholder="Additional notes or remarks"
              />
            </div>

            {/* Other Fields Section */}
            <div className={`${formFieldStyles.sectionHeader} border-b pb-1 mb-2 mt-4`}>ADDITIONAL INFORMATION</div>

            <div className="grid grid-cols-2 gap-2">
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="trdbranch" className={formFieldStyles.label}>TRDBRANCH</Label>
                <Input
                  id="trdbranch"
                  value={contractFormData.TRDBRANCH || ""}
                  onChange={(e) => setContractFormData({ ...contractFormData, TRDBRANCH: e.target.value })}
                  className={formFieldStyles.input}
                />
              </div>
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="branch" className={formFieldStyles.label}>BRANCH</Label>
                <Input
                  id="branch"
                  value={contractFormData.BRANCH || ""}
                  onChange={(e) => setContractFormData({ ...contractFormData, BRANCH: e.target.value })}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="salesman" className={formFieldStyles.label}>SALESMAN</Label>
              <Input
                id="salesman"
                value={contractFormData.SALESMAN || ""}
                onChange={(e) => setContractFormData({ ...contractFormData, SALESMAN: e.target.value })}
                className={formFieldStyles.input}
              />
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="blocked" className={formFieldStyles.label}>BLOCKED</Label>
              <Select
                value={String(contractFormData.BLOCKED ?? 0)}
                onValueChange={(value) => setContractFormData({ ...contractFormData, BLOCKED: Number(value) })}
              >
                <SelectTrigger className={formFieldStyles.select}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0" className={formFieldStyles.selectItem}>Not Blocked</SelectItem>
                  <SelectItem value="1" className={formFieldStyles.selectItem}>Blocked</SelectItem>
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
              <Label htmlFor="sync-to-erp-contract" className={formFieldStyles.label}>
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
              className={formFieldStyles.button}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveContract}
              disabled={isSaving}
              className={formFieldStyles.button}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit INSTLINES Dialog */}
      <Dialog open={editInstLineDialogOpen} onOpenChange={setEditInstLineDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[11px] font-bold uppercase">
              Edit License Plate: {editingInstLine?.MTRL}
            </DialogTitle>
          </DialogHeader>
          
          <div className={formFieldStyles.formSpacing}>
            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="mtrl" className={formFieldStyles.label}>MTRL (License Plate)</Label>
              <Input
                id="mtrl"
                value={instLineFormData.MTRL || ""}
                onChange={(e) => setInstLineFormData({ ...instLineFormData, MTRL: e.target.value.toUpperCase() })}
                className={formFieldStyles.input}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="linenum" className={formFieldStyles.label}>LINENUM</Label>
                <Input
                  id="linenum"
                  type="number"
                  value={instLineFormData.LINENUM || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, LINENUM: e.target.value ? Number(e.target.value) : null })}
                  className={formFieldStyles.input}
                />
              </div>
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="qty" className={formFieldStyles.label}>QTY</Label>
                <Input
                  id="qty"
                  type="number"
                  step="0.01"
                  value={instLineFormData.QTY || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, QTY: e.target.value ? Number(e.target.value) : null })}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="price" className={formFieldStyles.label}>PRICE</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={instLineFormData.PRICE || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, PRICE: e.target.value ? Number(e.target.value) : null })}
                  className={formFieldStyles.input}
                />
              </div>
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="mtrunit" className={formFieldStyles.label}>MTRUNIT</Label>
                <Input
                  id="mtrunit"
                  value={instLineFormData.MTRUNIT || ""}
                  onChange={(e) => setInstLineFormData({ ...instLineFormData, MTRUNIT: e.target.value })}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="fromdate-line" className={formFieldStyles.label}>FROM DATE</Label>
                <Input
                  id="fromdate-line"
                  type="date"
                  value={instLineFormData.FROMDATE ? format(new Date(instLineFormData.FROMDATE), "yyyy-MM-dd") : ""}
                  onChange={(e) => setInstLineFormData({ 
                    ...instLineFormData, 
                    FROMDATE: e.target.value ? new Date(e.target.value) : null 
                  })}
                  className={formFieldStyles.input}
                />
              </div>
              <div className={formFieldStyles.fieldSpacing}>
                <Label htmlFor="finaldate" className={formFieldStyles.label}>FINAL DATE</Label>
                <Input
                  id="finaldate"
                  type="date"
                  value={instLineFormData.FINALDATE ? format(new Date(instLineFormData.FINALDATE), "yyyy-MM-dd") : ""}
                  onChange={(e) => setInstLineFormData({ 
                    ...instLineFormData, 
                    FINALDATE: e.target.value ? new Date(e.target.value) : null 
                  })}
                  className={formFieldStyles.input}
                />
              </div>
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="sncode" className={formFieldStyles.label}>SNCODE</Label>
              <Input
                id="sncode"
                value={instLineFormData.SNCODE || ""}
                onChange={(e) => setInstLineFormData({ ...instLineFormData, SNCODE: e.target.value })}
                className={formFieldStyles.input}
              />
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="comments" className={formFieldStyles.label}>COMMENTS</Label>
              <Textarea
                id="comments"
                value={instLineFormData.COMMENTS || ""}
                onChange={(e) => setInstLineFormData({ ...instLineFormData, COMMENTS: e.target.value })}
                className={formFieldStyles.textarea}
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
              <Label htmlFor="sync-to-erp-instline" className={formFieldStyles.label}>
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
              className={formFieldStyles.button}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveInstLine}
              disabled={isSaving}
              className={formFieldStyles.button}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
