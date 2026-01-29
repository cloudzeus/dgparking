"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/ui/form-dialog";
import { IntegrationRecordForm } from "./integration-record-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
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
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  objectName: string;
  objectCaption: string | null;
  tableName: string;
  tableDbname: string;
  tableCaption: string | null;
  configJson: Record<string, any>;
  connection: {
    id: string;
    name: string;
    registeredName: string;
  };
}

interface IntegrationRecordsClientProps {
  integration: Integration;
  records: any[];
  modelName: string;
  modelFields: Array<{
    name: string;
    type: string;
    isId: boolean;
    isUnique: boolean;
    isRequired: boolean;
  }>;
  relatedData?: {
    countries?: Record<string, string>;
    irsData?: Record<string, string>;
  };
}

export function IntegrationRecordsClient({
  integration,
  records,
  modelName,
  modelFields,
  relatedData = {},
}: IntegrationRecordsClientProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Build columns dynamically based on model fields
  const columns: Column<any>[] = modelFields
    .filter((field) => {
      // Include common fields and exclude some internal fields
      if (field.name === "id" && field.isId) return true;
      if (["createdAt", "updatedAt"].includes(field.name)) return true;
      // Include all other fields except internal Prisma fields
      if (field.name.startsWith("_")) return false;
      return true;
    })
    .map((field) => {
      const column: Column<any> = {
        key: field.name,
        label: field.name.toUpperCase(),
        sortable: true,
      };

      // Custom rendering based on field type and related data
      if (field.type === "DateTime") {
        column.render = (date: Date | null) => (
          <span className="text-xs">
            {date ? format(new Date(date), "MM/dd/yyyy") : "-"}
          </span>
        );
      } else if (field.type === "Boolean") {
        column.render = (value: boolean) => (
          <Badge
            variant={value ? "default" : "secondary"}
            className="text-[8px] font-bold"
          >
            {value ? "YES" : "NO"}
          </Badge>
        );
      } else if (field.type === "Int" || field.type === "Float") {
        column.render = (value: number | null) => (
          <span className="text-xs font-medium">
            {value !== null && value !== undefined ? value.toString() : "-"}
          </span>
        );
      } else if (field.isId) {
        column.className = "font-medium";
      }

      // Handle related fields for CUSTORMER model
      if (modelName === "CUSTORMER") {
        // Show COUNTRY NAME instead of code
        if (field.name === "COUNTRY" && relatedData.countries) {
          column.render = (value: string | null, record: any) => {
            if (!value) return <span className="text-xs">-</span>;
            const countryName = relatedData.countries?.[String(value)] || value;
            return <span className="text-xs">{countryName}</span>;
          };
        }
        // Show IRSDATA NAME instead of code
        if (field.name === "IRSDATA" && relatedData.irsData) {
          column.render = (value: string | null, record: any) => {
            if (!value) return <span className="text-xs">-</span>;
            const irsName = relatedData.irsData?.[value] || value;
            return <span className="text-xs">{irsName}</span>;
          };
        }
      }

      return column;
    });

  // Get default visible columns (first 6-8 fields)
  const defaultVisibleColumns = columns
    .slice(0, 8)
    .map((col) => col.key)
    .filter(Boolean);

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (record: any) => {
    setRecordToDelete(record);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;

    setIsDeleting(true);
    try {
      const primaryKeyField = getPrimaryKeyField(modelName);
      const recordId = recordToDelete[primaryKeyField];

      const response = await fetch(
        `/api/integrations/${integration.id}/records/${recordId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete record");
      }

      toast.success("Record deleted successfully");
      setIsDeleteDialogOpen(false);
      setRecordToDelete(null);
      router.refresh();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete record");
    } finally {
      setIsDeleting(false);
    }
  };

  const getPrimaryKeyField = (modelName: string): string => {
    const primaryKeys: Record<string, string> = {
      CUSTORMER: "id",
      User: "id",
      COUNTRY: "COUNTRY",
      IRSDATA: "IRSDATA",
      VAT: "VAT",
      SOCURRENCY: "SOCURRENCY",
      TRDCATEGORY: "TRDCATEGORY",
      ITEMS: "ITEMS",
      PAYMENT: "PAYMENT",
      INST: "INST",
      INSTLINES: "INSTLINES",
    };
    return primaryKeys[modelName] || "id";
  };

  // Build actions array - include delete only if TRDR/MTRL doesn't exist (for CUSTORMER/ITEMS)
  const getActionsForRecord = (record: any) => {
    const actions = [
      {
        label: "Edit Record",
        onClick: handleEdit,
      },
    ];

    // For CUSTORMER, only show delete if TRDR doesn't exist
    if (modelName === "CUSTORMER") {
      if (!record.TRDR || record.TRDR.trim() === "") {
        actions.push({
          label: "Delete Record",
          onClick: handleDelete,
          variant: "destructive" as const,
          icon: <Trash2 className="h-3 w-3 mr-2" />,
        });
      }
    } else if (modelName === "ITEMS") {
      // For ITEMS, only show delete if MTRL doesn't exist
      if (!record.MTRL || record.MTRL.trim() === "") {
        actions.push({
          label: "Delete Record",
          onClick: handleDelete,
          variant: "destructive" as const,
          icon: <Trash2 className="h-3 w-3 mr-2" />,
        });
      }
    } else {
      // For other models, always show delete
      actions.push({
        label: "Delete Record",
        onClick: handleDelete,
        variant: "destructive" as const,
        icon: <Trash2 className="h-3 w-3 mr-2" />,
      });
    }

    return actions;
  };

  return (
    <div ref={containerRef} className="space-y-6 opacity-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/integrations")}
            className="h-7 px-3 text-[10px] gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK
          </Button>
          <PageHeader
            title={`${integration.name.toUpperCase()} - RECORDS`}
            highlight="RECORDS"
            subtitle={`Viewing ${records.length} record${records.length !== 1 ? "s" : ""} from ${modelName} model`}
          />
        </div>
      </div>

      {/* For INST model, show accordion with INSTLINES nested */}
      {modelName === "INST" ? (
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <div className="p-6">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {records.map((record: any) => {
                const instLinesColumns: Column<any>[] = [
                  { key: "LINENUM", label: "LINE #", sortable: true },
                  { key: "MTRL", label: "MATERIAL", sortable: true },
                  {
                    key: "QTY",
                    label: "QUANTITY",
                    sortable: true,
                    render: (value) => (value ? Number(value).toFixed(2) : "-"),
                  },
                  {
                    key: "PRICE",
                    label: "PRICE",
                    sortable: true,
                    render: (value) => (value ? Number(value).toFixed(2) : "-"),
                  },
                  { key: "MTRUNIT", label: "UNIT", sortable: true },
                  {
                    key: "FROMDATE",
                    label: "FROM DATE",
                    sortable: true,
                    render: (value) => (value ? format(new Date(value), "dd/MM/yyyy") : "-"),
                  },
                  {
                    key: "FINALDATE",
                    label: "FINAL DATE",
                    sortable: true,
                    render: (value) => (value ? format(new Date(value), "dd/MM/yyyy") : "-"),
                  },
                  { key: "COMMENTS", label: "COMMENTS", sortable: false },
                ];

                return (
                  <AccordionItem
                    key={record.INST}
                    value={`inst-${record.INST}`}
                    className="border border-muted-foreground/20 rounded-lg px-4 py-2 bg-card/50"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold uppercase">
                                {record.CODE || `INST-${record.INST}`}
                              </span>
                              {record.ISACTIVE === 1 ? (
                                <Badge variant="default" className="text-[7px] px-1.5 py-0.5">
                                  ACTIVE
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[7px] px-1.5 py-0.5">
                                  INACTIVE
                                </Badge>
                              )}
                              {record.BLOCKED === 1 && (
                                <Badge variant="destructive" className="text-[7px] px-1.5 py-0.5">
                                  BLOCKED
                                </Badge>
                              )}
                            </div>
                            <div className="text-[9px] text-muted-foreground mt-1">
                              {record.NAME || "No name"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-[9px] text-muted-foreground">
                          <div>
                            <span className="font-medium">Lines: </span>
                            {record.lines?.length || 0}
                          </div>
                          {record.FROMDATE && (
                            <div>
                              <span className="font-medium">From: </span>
                              {format(new Date(record.FROMDATE), "dd/MM/yyyy")}
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-4">
                        {record.lines && record.lines.length > 0 ? (
                          <DataTable
                            data={record.lines}
                            columns={instLinesColumns}
                            title=""
                            searchPlaceholder="Search lines..."
                            searchFields={["MTRL", "COMMENTS", "SNCODE"]}
                            defaultVisibleColumns={["LINENUM", "MTRL", "QTY", "PRICE", "MTRUNIT", "FROMDATE", "FINALDATE"]}
                            storageKey={`integration-${integration.id}-inst-${record.INST}-lines`}
                          />
                        ) : (
                          <div className="text-center py-8 text-[9px] text-muted-foreground">
                            No lines found for this installation
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </Card>
      ) : (
        <DataTable
          data={records}
          columns={columns}
          searchPlaceholder={`Search ${integration.name.toLowerCase()}...`}
          searchFields={columns.slice(0, 5).map((col) => col.key)}
          addButtonLabel={`ADD ${integration.objectName || "RECORD"}`}
          onAdd={() => setIsAddDialogOpen(true)}
          onEdit={handleEdit}
          actions={(record) => getActionsForRecord(record)}
          defaultVisibleColumns={defaultVisibleColumns}
          storageKey={`integration-${integration.id}-records`}
        />
      )}

      {/* Add Record Dialog */}
      <FormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title={`ADD NEW ${integration.objectName || "RECORD"}`}
        maxWidth="2xl"
      >
        <IntegrationRecordForm
          mode="create"
          modelName={modelName}
          modelFields={modelFields}
          integrationId={integration.id}
          onSuccess={() => {
            setIsAddDialogOpen(false);
            router.refresh();
          }}
        />
      </FormDialog>

      {/* Edit Record Dialog */}
      <FormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title={`EDIT ${integration.objectName || "RECORD"}`}
        maxWidth="2xl"
      >
        {selectedRecord && (
          <IntegrationRecordForm
            mode="edit"
            record={selectedRecord}
            modelName={modelName}
            modelFields={modelFields}
            integrationId={integration.id}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              setSelectedRecord(null);
              router.refresh();
            }}
          />
        )}
      </FormDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Record</AlertDialogTitle>
            <AlertDialogDescription className="text-[9px]">
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



