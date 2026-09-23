"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/ui/data-table";
import { CustomerForm } from "./customer-form";
import { SyncProgressModal } from "./sync-progress-modal";
import { deleteCustomer, syncCustomersFromERP } from "@/lib/actions/customers";
import { toast } from "sonner";
import {
  AtSign,
  BadgeEuro,
  Edit,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  UserCheck,
} from "lucide-react";

interface Customer {
  id: number;
  SODTYPE: number;
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
  JOBTYPE: string | null;
  WEBPAGE: string | null;
  EMAIL: string | null;
  EMAILACC: string | null;
  IRSDATA: string | null;
  INSDATE: Date | null;
  UPDDATE: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomersClientProps {
  customers: Customer[];
  currentUserRole: Role;
}

/**
 * Προεπιλεγμένες στήλες: χωρά σε 1440px χωρίς οριζόντια κύλιση.
 * TRDR κάτω από τον κωδικό, email κάτω από την επωνυμία· οι χωριστές στήλες
 * ανοίγουν από το μενού «Στήλες».
 */
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  TRDR: false,
  EMAIL: false,
  COUNTRY: false,
  INSDATE: false,
  createdAt: false,
};

/** Ημερομηνία (και ώρα) στα ελληνικά, ζώνη Αθήνας. */
function formatDate(value: Date | string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function CustomersClient({ customers, currentUserRole }: CustomersClientProps) {
  const router = useRouter();
  const isAdmin = currentUserRole === "ADMIN";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [syncProgress, setSyncProgress] = useState<{
    status: "idle" | "syncing" | "completed" | "error";
    progress?: {
      synced: number;
      skipped: number;
      total: number;
    };
    error?: string;
  }>({ status: "idle" });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
      );
    });

    return () => ctx.revert();
  }, []);

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedCustomer) return;

    const result = await deleteCustomer(selectedCustomer.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Ο πελάτης διαγράφηκε");
      router.refresh();
    }
    setIsDeleteDialogOpen(false);
    setSelectedCustomer(null);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncProgress({ status: "syncing" });

    try {
      const result = await syncCustomersFromERP();

      if (result.error) {
        setSyncProgress({
          status: "error",
          error: result.error,
        });
        toast.error(result.error);

        // Auto-close error modal after 3 seconds
        setTimeout(() => {
          setSyncProgress({ status: "idle" });
          setIsSyncing(false);
        }, 3000);
      } else {
        setSyncProgress({
          status: "completed",
          progress: {
            synced: result.synced || 0,
            skipped: result.skipped || 0,
            total: result.total || 0,
          },
        });

        toast.success(
          `Ο συγχρονισμός ολοκληρώθηκε: ${(result.synced ?? 0).toLocaleString("el-GR")} νέοι πελάτες, ${(result.skipped ?? 0).toLocaleString("el-GR")} παραλείφθηκαν (σύνολο ${(result.total ?? 0).toLocaleString("el-GR")})`
        );

        router.refresh();

        // Auto-close success modal after 2 seconds
        setTimeout(() => {
          setSyncProgress({ status: "idle" });
          setIsSyncing(false);
        }, 2000);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ο συγχρονισμός πελατών από το ERP απέτυχε";
      setSyncProgress({
        status: "error",
        error: errorMessage,
      });
      toast.error(errorMessage);
      console.error("Sync error:", error);

      // Auto-close error modal after 3 seconds
      setTimeout(() => {
        setSyncProgress({ status: "idle" });
        setIsSyncing(false);
      }, 3000);
    }
  };

  const summary = useMemo(
    () => ({
      all: customers.length,
      clients: customers.filter((c) => c.SODTYPE === 13).length,
      withAfm: customers.filter((c) => c.AFM && c.AFM.trim() !== "").length,
      withEmail: customers.filter((c) => c.EMAIL && c.EMAIL.trim() !== "").length,
    }),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      (["NAME", "CODE", "EMAIL", "AFM", "CITY"] as const).some((field) =>
        String(customer[field] ?? "").toLowerCase().includes(term)
      )
    );
  }, [customers, search]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const pageRows = useMemo(
    () => filteredCustomers.slice((page - 1) * pageSize, page * pageSize),
    [filteredCustomers, page, pageSize]
  );

  const columns = useMemo<ColumnDef<Customer>[]>(() => {
    const cols: ColumnDef<Customer>[] = [
      {
        accessorKey: "CODE",
        meta: { label: "Κωδικός / TRDR" },
        header: "Κωδικός",
        enableSorting: true,
        size: 130,
        cell: ({ row }) => (
          <div className="min-w-0 leading-tight">
            <div className="truncate font-mono text-xs">{row.original.CODE || "—"}</div>
            {row.original.TRDR && (
              <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={`TRDR ${row.original.TRDR}`}>
                {row.original.TRDR}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "TRDR",
        meta: { label: "TRDR" },
        header: "TRDR",
        enableSorting: true,
        size: 110,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">{row.original.TRDR || "—"}</span>
        ),
      },
      {
        accessorKey: "NAME",
        meta: { label: "Επωνυμία", flex: true },
        header: "Επωνυμία",
        enableSorting: true,
        size: 300,
        cell: ({ row }) => (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-medium" title={row.original.NAME ?? undefined}>
              {row.original.NAME || "—"}
            </div>
            {row.original.EMAIL && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground" title={row.original.EMAIL}>
                {row.original.EMAIL}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "SODTYPE",
        meta: { label: "Τύπος (SODTYPE)" },
        header: "Τύπος",
        enableSorting: true,
        size: 100,
        cell: ({ row }) => (
          <Badge variant={row.original.SODTYPE === 13 ? "success" : "info"} title={`SODTYPE ${row.original.SODTYPE}`}>
            {row.original.SODTYPE === 13 ? "Πελάτης" : "Προμηθευτής"}
          </Badge>
        ),
      },
      {
        accessorKey: "AFM",
        meta: { label: "ΑΦΜ" },
        header: "ΑΦΜ",
        enableSorting: true,
        size: 120,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">{row.original.AFM || "—"}</span>
        ),
      },
      {
        accessorKey: "EMAIL",
        meta: { label: "Email", flex: false },
        header: "Email",
        enableSorting: true,
        size: 220,
        cell: ({ row }) => (
          <span className="block truncate text-xs" title={row.original.EMAIL ?? undefined}>
            {row.original.EMAIL || "—"}
          </span>
        ),
      },
      {
        accessorKey: "PHONE01",
        meta: { label: "Τηλέφωνο" },
        header: "Τηλέφωνο",
        enableSorting: true,
        size: 140,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.PHONE01 || row.original.PHONE02 || "—"}
          </span>
        ),
      },
      {
        accessorKey: "CITY",
        meta: { label: "Πόλη" },
        header: "Πόλη",
        enableSorting: true,
        size: 140,
        cell: ({ row }) => (
          <span className="block truncate text-xs" title={row.original.CITY ?? undefined}>
            {row.original.CITY || "—"}
          </span>
        ),
      },
      {
        accessorKey: "COUNTRY",
        meta: { label: "Χώρα" },
        header: "Χώρα",
        enableSorting: true,
        size: 100,
        cell: ({ row }) => <span className="text-xs">{row.original.COUNTRY || "—"}</span>,
      },
      {
        accessorKey: "INSDATE",
        meta: { label: "Καταχώριση (INSDATE)", align: "right" },
        header: "Καταχώριση",
        enableSorting: true,
        size: 150,
        cell: ({ row }) => (
          <span className="block text-right text-xs tabular-nums">
            {formatDate(row.original.INSDATE, true)}
          </span>
        ),
      },
      {
        accessorKey: "UPDDATE",
        meta: { label: "Ενημέρωση (UPDDATE)", align: "right" },
        header: "Ενημέρωση",
        enableSorting: true,
        size: 150,
        cell: ({ row }) => (
          <span className="block text-right text-xs tabular-nums">
            {formatDate(row.original.UPDDATE, true)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Δημιουργήθηκε", align: "right" },
        header: "Δημιουργήθηκε",
        enableSorting: true,
        size: 130,
        cell: ({ row }) => (
          <span className="block text-right text-xs tabular-nums">{formatDate(row.original.createdAt)}</span>
        ),
      },
    ];

    if (isAdmin) {
      cols.unshift({
        id: "rowEdit",
        header: "",
        enableSorting: false,
        enableResizing: false,
        enableHiding: false,
        size: 44,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-primary"
            aria-label="Επεξεργασία πελάτη"
            title="Επεξεργασία πελάτη"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row.original);
            }}
          >
            <Edit />
          </Button>
        ),
      });
    }

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const expandableContent = (customer: Customer) => (
    <div className="space-y-3">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-sm font-semibold break-words">
            {customer.NAME || customer.CODE || "Πελάτης χωρίς επωνυμία"}
          </h3>
          <Badge variant={customer.SODTYPE === 13 ? "success" : "info"} title={`SODTYPE ${customer.SODTYPE}`}>
            {customer.SODTYPE === 13 ? "Πελάτης" : "Προμηθευτής"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span>
            CODE <span className="font-mono text-foreground">{customer.CODE || "—"}</span>
          </span>
          <span>
            TRDR <span className="font-mono text-foreground">{customer.TRDR || "—"}</span>
          </span>
          <span>Καταχώριση {formatDate(customer.INSDATE, true)}</span>
          <span>Ενημέρωση {formatDate(customer.UPDDATE, true)}</span>
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(customer);
            }}
          >
            <Edit />
            Επεξεργασία
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(customer);
            }}
          >
            <Trash2 />
            Διαγραφή
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPanel title="SoftOne" accent="bg-chart-1">
          <InfoRow label="CODE" mono>
            {customer.CODE || "—"}
          </InfoRow>
          <InfoRow label="TRDR" mono>
            {customer.TRDR || "—"}
          </InfoRow>
          <InfoRow label="SODTYPE" mono>
            {customer.SODTYPE}
          </InfoRow>
          <InfoRow label="IRSDATA" wrap>
            {customer.IRSDATA || "—"}
          </InfoRow>
        </InfoPanel>

        <InfoPanel title="Φορολογικά" accent="bg-chart-2">
          <InfoRow label="ΑΦΜ (AFM)" mono>
            {customer.AFM || "—"}
          </InfoRow>
          <InfoRow label="Δραστηριότητα (JOBTYPE)" wrap>
            {customer.JOBTYPE || "—"}
          </InfoRow>
        </InfoPanel>

        <InfoPanel title="Διεύθυνση" accent="bg-chart-3">
          <InfoRow label="Οδός (ADDRESS)" wrap>
            {customer.ADDRESS || "—"}
          </InfoRow>
          <InfoRow label="Πόλη (CITY)">{customer.CITY || "—"}</InfoRow>
          <InfoRow label="Τ.Κ. (ZIP)">{customer.ZIP || "—"}</InfoRow>
          <InfoRow label="Χώρα (COUNTRY)">{customer.COUNTRY || "—"}</InfoRow>
        </InfoPanel>

        <InfoPanel title="Επικοινωνία" accent="bg-chart-4">
          <InfoRow label="Τηλέφωνο (PHONE01)">{customer.PHONE01 || "—"}</InfoRow>
          <InfoRow label="Τηλέφωνο 2 (PHONE02)">{customer.PHONE02 || "—"}</InfoRow>
          <InfoRow label="Email (EMAIL)" wrap>
            {customer.EMAIL || "—"}
          </InfoRow>
          <InfoRow label="Email λογιστηρίου (EMAILACC)" wrap>
            {customer.EMAILACC || "—"}
          </InfoRow>
          <InfoRow label="Ιστοσελίδα (WEBPAGE)" wrap>
            {customer.WEBPAGE || "—"}
          </InfoRow>
        </InfoPanel>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="space-y-4 opacity-0">
      <PageHeader
        title="Πελάτες"
        description="Καρτέλες πελατών από το SoftOne — αναζήτηση, επεξεργασία και συγχρονισμός από το ERP."
        icon={Users}
        className="mb-0"
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                {isSyncing ? <Spinner /> : <RefreshCw />}
                {isSyncing ? "Συγχρονισμός…" : "Συγχρονισμός από ERP"}
              </Button>
              <Button
                onClick={() => {
                  console.log("Add button clicked, opening dialog");
                  setIsAddDialogOpen(true);
                }}
              >
                <Plus />
                Νέος πελάτης
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Πελάτες"
          value={summary.all.toLocaleString("el-GR")}
          hint="σύνολο εγγραφών στη βάση"
          icon={Users}
          tone="blue"
        />
        <KpiTile
          label="Τύπος πελάτη"
          value={summary.clients.toLocaleString("el-GR")}
          hint="εγγραφές με SODTYPE 13"
          icon={UserCheck}
          tone="green"
        />
        <KpiTile
          label="Με ΑΦΜ"
          value={summary.withAfm.toLocaleString("el-GR")}
          hint={`${(summary.all - summary.withAfm).toLocaleString("el-GR")} χωρίς ΑΦΜ`}
          icon={BadgeEuro}
          tone="amber"
        />
        <KpiTile
          label="Με email"
          value={summary.withEmail.toLocaleString("el-GR")}
          hint={`${(summary.all - summary.withEmail).toLocaleString("el-GR")} χωρίς διεύθυνση email`}
          icon={AtSign}
          tone="violet"
        />
      </div>

      <Card role="region" aria-label="Φίλτρα πελατών" className="gap-0 py-0">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση σε επωνυμία, κωδικό, email, ΑΦΜ, πόλη…"
              aria-label="Αναζήτηση πελατών"
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {filteredCustomers.length === 0 ? (
        <EmptyCustomers hasCustomers={customers.length > 0} onClear={() => setSearch("")} />
      ) : (
        <DataTable
          columns={columns}
          data={pageRows}
          getRowId={(row) => String(row.id)}
          expandableContent={expandableContent}
          fixedLayout
          columnVisibility={DEFAULT_COLUMN_VISIBILITY}
          pageSize={pageSize}
          totalItems={filteredCustomers.length}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          showExport={false}
        />
      )}

      {/* Add Customer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Νέος πελάτης</DialogTitle>
          </DialogHeader>
          <CustomerForm
            mode="create"
            onSuccess={() => {
              setIsAddDialogOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Επεξεργασία πελάτη</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <CustomerForm
              mode="edit"
              customer={selectedCustomer}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                setSelectedCustomer(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή πελάτη</AlertDialogTitle>
            <AlertDialogDescription>
              Να διαγραφεί ο πελάτης{" "}
              <span className="font-medium text-foreground">
                {selectedCustomer?.NAME || selectedCustomer?.CODE || "αυτή η εγγραφή"}
              </span>
              ; Η ενέργεια δεν αναιρείται.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sync Progress Modal */}
      <SyncProgressModal
        open={syncProgress.status !== "idle"}
        status={syncProgress.status}
        progress={syncProgress.progress}
        error={syncProgress.error}
      />
    </div>
  );
}

function EmptyCustomers({ hasCustomers, onClear }: { hasCustomers: boolean; onClear: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title={hasCustomers ? "Κανένας πελάτης δεν ταιριάζει" : "Δεν υπάρχουν πελάτες"}
      description={
        hasCustomers
          ? "Δοκιμάστε διαφορετικούς όρους αναζήτησης ή καθαρίστε το φίλτρο."
          : "Τρέξτε συγχρονισμό από το ERP ή προσθέστε πελάτη χειροκίνητα."
      }
      action={
        hasCustomers ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Καθαρισμός αναζήτησης
          </Button>
        ) : undefined
      }
    />
  );
}
