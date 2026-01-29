"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { Role } from "@prisma/client";
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
import { FormDialog } from "@/components/ui/form-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { CustomerForm } from "./customer-form";
import { SyncProgressModal } from "./sync-progress-modal";
import { deleteCustomer, syncCustomersFromERP } from "@/lib/actions/customers";
import { toast } from "sonner";
import { Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

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

export function CustomersClient({ customers, currentUserRole }: CustomersClientProps) {
  const router = useRouter();
  const isAdmin = currentUserRole === "ADMIN";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
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
      toast.success("Customer deleted successfully");
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
          `Sync completed: ${result.synced} new customers added, ${result.skipped} skipped (${result.total} total)`
        );
        
        router.refresh();
        
        // Auto-close success modal after 2 seconds
        setTimeout(() => {
          setSyncProgress({ status: "idle" });
          setIsSyncing(false);
        }, 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sync customers from ERP";
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

  const columns: Column<Customer>[] = [
    {
      key: "CODE",
      label: "CODE",
      sortable: true,
      className: "font-medium",
      render: (code) => code || "-",
    },
    {
      key: "NAME",
      label: "NAME",
      sortable: true,
      className: "font-medium",
      render: (name) => name || "-",
    },
    {
      key: "SODTYPE",
      label: "SODTYPE",
      sortable: true,
      render: (sodtype: number) => (
        <Badge
          className={`text-[8px] font-bold border ${
            sodtype === 13
              ? "bg-green-500/10 text-green-600 border-green-500/20"
              : "bg-blue-500/10 text-blue-600 border-blue-500/20"
          }`}
        >
          {sodtype}
        </Badge>
      ),
    },
    {
      key: "AFM",
      label: "AFM",
      sortable: true,
      render: (afm) => afm || "-",
    },
    {
      key: "EMAIL",
      label: "EMAIL",
      sortable: true,
      render: (email) => email || "-",
    },
    {
      key: "PHONE01",
      label: "PHONE",
      sortable: true,
      render: (phone01, customer) => phone01 || customer.PHONE02 || "-",
    },
    {
      key: "CITY",
      label: "CITY",
      sortable: true,
      render: (city) => city || "-",
    },
    {
      key: "COUNTRY",
      label: "COUNTRY",
      sortable: true,
      render: (country) => country || "-",
    },
    {
      key: "INSDATE",
      label: "INSERT DATE",
      sortable: true,
      render: (insdate: Date | null) => {
        if (!insdate) return "-";
        return (
          <Badge className="text-[8px] font-bold gap-1 bg-muted text-muted-foreground border">
            <Clock className="h-3 w-3" />
            {format(new Date(insdate), "dd/MM/yyyy HH:mm")}
          </Badge>
        );
      },
    },
    {
      key: "UPDDATE",
      label: "UPDATE DATE",
      sortable: true,
      render: (upddate: Date | null) => {
        if (!upddate) return "-";
        return (
          <Badge className="text-[8px] font-bold gap-1 bg-muted text-muted-foreground border">
            <Clock className="h-3 w-3" />
            {format(new Date(upddate), "dd/MM/yyyy HH:mm")}
          </Badge>
        );
      },
    },
    {
      key: "createdAt",
      label: "CREATED",
      sortable: true,
      render: (date: Date) => format(new Date(date), "MM/dd/yyyy"),
    },
  ];

  const actions = [
    {
      label: "Edit Customer",
      onClick: handleEdit,
    },
    {
      label: "Delete Customer",
      onClick: handleDelete,
      variant: "destructive" as const,
    },
  ];

  return (
    <div ref={containerRef} className="space-y-6 opacity-0">
      <PageHeader
        title="CUSTOMERS"
        highlight="CUSTOMERS"
        subtitle="Manage customer records and information"
      />

      <DataTable
        data={customers}
        columns={columns}
        searchPlaceholder="Search customers..."
        searchFields={["NAME", "CODE", "EMAIL", "AFM", "CITY"]}
        addButtonLabel={isAdmin ? "ADD CUSTOMER" : undefined}
        onAdd={isAdmin ? () => {
          console.log("Add button clicked, opening dialog");
          setIsAddDialogOpen(true);
        } : undefined}
        onEdit={isAdmin ? handleEdit : undefined}
        storageKey="customers-table"
        onDelete={isAdmin ? handleDelete : undefined}
        actions={isAdmin ? actions : undefined}
        defaultVisibleColumns={["CODE", "NAME", "SODTYPE", "EMAIL", "PHONE01", "CITY", "INSDATE", "UPDDATE"]}
        customButtons={
          isAdmin ? (
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size="sm"
              className="h-9 gap-2 px-6 py-3 text-xs font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              variant="outline"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  SYNCING...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3" />
                  SYNC FROM ERP
                </>
              )}
            </Button>
          ) : undefined
        }
      />

      {/* Add Customer Dialog */}
      <FormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title="ADD NEW CUSTOMER"
        maxWidth="lg"
      >
        <CustomerForm
          mode="create"
          onSuccess={() => {
            setIsAddDialogOpen(false);
            router.refresh();
          }}
        />
      </FormDialog>

      {/* Edit Customer Dialog */}
      <FormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="EDIT CUSTOMER"
        maxWidth="lg"
      >
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
      </FormDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm uppercase font-bold">DELETE CUSTOMER</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium">
                {selectedCustomer?.NAME || selectedCustomer?.CODE || "this customer"}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 px-3 text-[10px]">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="h-7 px-3 text-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              DELETE
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

