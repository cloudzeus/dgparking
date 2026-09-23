"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader, EmptyState, InfoPanel, InfoRow, StatusBadge } from "@/components/admin/page";
import { ArrowLeft, Database, Plus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormDialog } from "@/components/ui/form-dialog";
import { IntegrationRecordForm } from "./integration-record-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

interface ModelField {
  name: string;
  type: string;
  isId: boolean;
  isUnique: boolean;
  isRequired: boolean;
}

interface IntegrationRecordsClientProps {
  integration: Integration;
  records: any[];
  modelName: string;
  modelFields: ModelField[];
  relatedData?: {
    countries?: Record<string, string>;
    irsData?: Record<string, string>;
  };
}

const DASH = "—";

/** Ημερομηνία στα ελληνικά, ζώνη Αθήνας. */
function formatDate(value: unknown) {
  if (!value) return DASH;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return DASH;
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num.toLocaleString("el-GR");
}

const PRIMARY_KEYS: Record<string, string> = {
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);

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

  const getPrimaryKeyField = (model: string): string => PRIMARY_KEYS[model] || "id";

  const visibleFields = useMemo(
    () => modelFields.filter((field) => !field.name.startsWith("_")),
    [modelFields]
  );

  /** Η στήλη που παίρνει τον χώρο που περισσεύει: όνομα ή η πρώτη στήλη κειμένου. */
  const flexFieldName = useMemo(() => {
    const named = visibleFields.find((field) => field.name === "NAME");
    if (named) return named.name;
    const text = visibleFields.find((field) => field.type === "String" && !field.isId);
    return text?.name;
  }, [visibleFields]);

  const renderValue = (field: ModelField, value: any) => {
    if (field.type === "DateTime") {
      return <span className="tabular-nums">{formatDate(value)}</span>;
    }
    if (field.type === "Boolean") {
      return <Badge variant={value ? "success" : "neutral"}>{value ? "Ναι" : "Όχι"}</Badge>;
    }
    if (field.type === "Int" || field.type === "Float") {
      return <span className="tabular-nums">{formatNumber(value)}</span>;
    }
    if (modelName === "CUSTORMER" && field.name === "COUNTRY" && relatedData.countries) {
      if (!value) return DASH;
      return relatedData.countries[String(value)] || String(value);
    }
    if (modelName === "CUSTORMER" && field.name === "IRSDATA" && relatedData.irsData) {
      if (!value) return DASH;
      return relatedData.irsData[String(value)] || String(value);
    }
    if (value === null || value === undefined || value === "") return DASH;
    return String(value);
  };

  const columns = useMemo<ColumnDef<any>[]>(
    () =>
      visibleFields.map((field) => {
        const isNumeric = field.type === "Int" || field.type === "Float";
        const isFlex = field.name === flexFieldName;
        return {
          accessorKey: field.name,
          header: field.name,
          size: isFlex ? 240 : isNumeric ? 100 : field.type === "DateTime" ? 110 : 140,
          meta: {
            label: field.name,
            flex: isFlex,
            align: isNumeric ? ("right" as const) : ("left" as const),
          },
          cell: ({ row }) => {
            const value = row.original[field.name];
            const content = renderValue(field, value);
            return (
              <div
                className={
                  isNumeric
                    ? "truncate text-right tabular-nums"
                    : field.isId
                      ? "truncate font-mono"
                      : "truncate"
                }
                title={value === null || value === undefined ? undefined : String(value)}
              >
                {content}
              </div>
            );
          },
        } satisfies ColumnDef<any>;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleFields, flexFieldName, modelName, relatedData]
  );

  /** Δευτερεύουσες στήλες κρυμμένες εξ ορισμού, ώστε ο πίνακας να χωρά χωρίς κύλιση. */
  const defaultColumnVisibility = useMemo<VisibilityState>(() => {
    const hidden: VisibilityState = {};
    visibleFields.slice(8).forEach((field) => {
      hidden[field.name] = false;
    });
    return hidden;
  }, [visibleFields]);

  const searchFields = useMemo(
    () => visibleFields.slice(0, 5).map((field) => field.name),
    [visibleFields]
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      searchFields.some((name) => String(record?.[name] ?? "").toLowerCase().includes(query))
    );
  }, [records, search, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = useMemo(
    () => filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRecords, currentPage, pageSize]
  );

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
        throw new Error(data.error || "Η διαγραφή της εγγραφής απέτυχε");
      }

      toast.success("Η εγγραφή διαγράφηκε");
      setIsDeleteDialogOpen(false);
      setRecordToDelete(null);
      router.refresh();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error(error instanceof Error ? error.message : "Η διαγραφή της εγγραφής απέτυχε");
    } finally {
      setIsDeleting(false);
    }
  };

  /** Η διαγραφή επιτρέπεται μόνο όταν η εγγραφή δεν έχει ταυτότητα στο ERP. */
  const canDeleteRecord = (record: any): boolean => {
    if (modelName === "CUSTORMER") return !record.TRDR || String(record.TRDR).trim() === "";
    if (modelName === "ITEMS") return !record.MTRL || String(record.MTRL).trim() === "";
    return true;
  };

  const expandableContent = (record: any) => {
    const primaryKeyField = getPrimaryKeyField(modelName);
    const chunkSize = Math.ceil(visibleFields.length / 4) || 1;
    const groups: ModelField[][] = [];
    for (let i = 0; i < visibleFields.length; i += chunkSize) {
      groups.push(visibleFields.slice(i, i + chunkSize));
    }
    const accents = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"];

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">
            {record.NAME || record.CODE || `${modelName} ${record[primaryKeyField]}`}
          </span>
          {record.ISACTIVE !== undefined && (
            <StatusBadge status={record.ISACTIVE === 1 ? "ACTIVE" : "INACTIVE"} />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {primaryKeyField}: {String(record[primaryKeyField] ?? DASH)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => handleEdit(record)}>
            <Pencil />
            Επεξεργασία
          </Button>
          {canDeleteRecord(record) && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={() => handleDelete(record)}
            >
              <Trash2 />
              Διαγραφή
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((group, index) => (
            <InfoPanel
              key={index}
              title={`Στοιχεία ${index + 1}`}
              accent={accents[index % accents.length]}
            >
              {group.map((field) => (
                <InfoRow key={field.name} label={field.name} wrap>
                  {renderValue(field, record[field.name])}
                </InfoRow>
              ))}
            </InfoPanel>
          ))}
        </div>
      </div>
    );
  };

  const headerActions = (
    <>
      <Button variant="outline" onClick={() => router.push("/integrations")}>
        <ArrowLeft />
        Πίσω
      </Button>
      {modelName !== "INST" && (
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus />
          Νέα εγγραφή
        </Button>
      )}
    </>
  );

  return (
    <div ref={containerRef} className="flex flex-col gap-4 opacity-0">
      <PageHeader
        title={`${integration.name} — Εγγραφές`}
        description={`${records.length.toLocaleString("el-GR")} ${records.length === 1 ? "εγγραφή" : "εγγραφές"} από το μοντέλο ${modelName}.`}
        icon={Database}
        actions={headerActions}
      />

      {/* Για το μοντέλο INST: πτυσσόμενη λίστα με τις γραμμές INSTLINES από κάτω */}
      {modelName === "INST" ? (
        records.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Καμία εγγραφή"
            description="Δεν βρέθηκαν συμβόλαια για αυτή την ενσωμάτωση. Εκτελέστε συγχρονισμό από τη σελίδα ενσωματώσεων."
          />
        ) : (
          <Accordion type="single" collapsible className="flex w-full flex-col gap-2">
            {records.map((record: any) => {
              const instLinesColumns: ColumnDef<any>[] = [
                {
                  accessorKey: "LINENUM",
                  header: "LINENUM",
                  size: 90,
                  meta: { label: "Γραμμή", align: "right" },
                  cell: ({ row }) => (
                    <div className="text-right tabular-nums">{formatNumber(row.original.LINENUM)}</div>
                  ),
                },
                {
                  accessorKey: "MTRL",
                  header: "MTRL",
                  size: 120,
                  meta: { label: "Είδος" },
                  cell: ({ row }) => (
                    <span className="font-mono">{row.original.MTRL ?? DASH}</span>
                  ),
                },
                {
                  accessorKey: "QTY",
                  header: "QTY",
                  size: 90,
                  meta: { label: "Ποσότητα", align: "right" },
                  cell: ({ row }) => (
                    <div className="text-right tabular-nums">
                      {row.original.QTY != null
                        ? Number(row.original.QTY).toLocaleString("el-GR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : DASH}
                    </div>
                  ),
                },
                {
                  accessorKey: "PRICE",
                  header: "PRICE",
                  size: 100,
                  meta: { label: "Τιμή", align: "right" },
                  cell: ({ row }) => (
                    <div className="text-right tabular-nums">
                      {row.original.PRICE != null
                        ? Number(row.original.PRICE).toLocaleString("el-GR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : DASH}
                    </div>
                  ),
                },
                {
                  accessorKey: "MTRUNIT",
                  header: "MTRUNIT",
                  size: 100,
                  meta: { label: "Μονάδα" },
                },
                {
                  accessorKey: "FROMDATE",
                  header: "FROMDATE",
                  size: 110,
                  meta: { label: "Από" },
                  cell: ({ row }) => (
                    <span className="tabular-nums">{formatDate(row.original.FROMDATE)}</span>
                  ),
                },
                {
                  accessorKey: "FINALDATE",
                  header: "FINALDATE",
                  size: 110,
                  meta: { label: "Έως" },
                  cell: ({ row }) => (
                    <span className="tabular-nums">{formatDate(row.original.FINALDATE)}</span>
                  ),
                },
                {
                  accessorKey: "COMMENTS",
                  header: "COMMENTS",
                  size: 220,
                  enableSorting: false,
                  meta: { label: "Σχόλια", flex: true },
                  cell: ({ row }) => (
                    <div className="truncate" title={row.original.COMMENTS ?? undefined}>
                      {row.original.COMMENTS || DASH}
                    </div>
                  ),
                },
              ];

              const lines = record.lines ?? [];

              return (
                <AccordionItem
                  key={record.INST}
                  value={`inst-${record.INST}`}
                  className="rounded-md border bg-card px-3"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-2">
                      <div className="min-w-0 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {record.CODE || `INST-${record.INST}`}
                          </span>
                          <StatusBadge status={record.ISACTIVE === 1 ? "ACTIVE" : "INACTIVE"} />
                          {record.BLOCKED === 1 && (
                            <Badge variant="danger">Σε φραγή</Badge>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {record.NAME || "Χωρίς ονομασία"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span>Γραμμές: {lines.length.toLocaleString("el-GR")}</span>
                        {record.FROMDATE && <span>Από: {formatDate(record.FROMDATE)}</span>}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      {lines.length > 0 ? (
                        <DataTable
                          data={lines}
                          columns={instLinesColumns}
                          title={`${lines.length.toLocaleString("el-GR")} γραμμές`}
                          showExport={false}
                          fixedLayout
                          totalItems={lines.length}
                          pageSize={lines.length}
                          currentPage={1}
                          totalPages={1}
                          columnVisibilityStorageKey={`integration-${integration.id}-inst-lines`}
                        />
                      ) : (
                        <EmptyState
                          title="Καμία γραμμή"
                          description="Το συμβόλαιο δεν έχει γραμμές INSTLINES."
                        />
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )
      ) : records.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Καμία εγγραφή"
          description={`Δεν βρέθηκαν εγγραφές για το μοντέλο ${modelName}. Εκτελέστε συγχρονισμό ή προσθέστε νέα εγγραφή.`}
          action={
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus />
              Νέα εγγραφή
            </Button>
          }
        />
      ) : (
        <DataTable
          data={pageRecords}
          columns={columns}
          fixedLayout
          searchPlaceholder={`Αναζήτηση σε ${integration.name}…`}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          totalItems={filteredRecords.length}
          pageSize={pageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          showExport={false}
          columnVisibility={defaultColumnVisibility}
          columnVisibilityStorageKey={`integration-${integration.id}-records`}
          getRowId={(row, index) =>
            String(row?.[getPrimaryKeyField(modelName)] ?? index)
          }
          expandableContent={expandableContent}
        />
      )}

      {/* Προσθήκη εγγραφής */}
      <FormDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        title="Νέα εγγραφή"
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

      {/* Επεξεργασία εγγραφής */}
      <FormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="Επεξεργασία εγγραφής"
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

      {/* Επιβεβαίωση διαγραφής */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή εγγραφής</AlertDialogTitle>
            <AlertDialogDescription>
              Θέλετε σίγουρα να διαγράψετε αυτή την εγγραφή; Η ενέργεια δεν αναιρείται.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Διαγραφή…
                </>
              ) : (
                "Διαγραφή"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
