"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader, StatusBadge, EmptyState, InfoPanel, InfoRow } from "@/components/admin/page";
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
  Plus,
  Database,
  Table,
  Trash2,
  Edit,
  Eye,
  Clock,
  ArrowRightLeft,
  MapPin,
  RefreshCw,
  List,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SoftOneIntegrationWizard } from "@/components/softone/softone-integration-wizard";
import { toast } from "sonner";
import gsap from "gsap";
import { useRouter } from "next/navigation";

interface Integration {
  id: string;
  name: string;
  objectName: string;
  objectCaption: string | null;
  tableName: string;
  tableDbname: string;
  tableCaption: string | null;
  configJson: Record<string, any>;
  isActive: boolean;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  connection: {
    id: string;
    name: string;
    registeredName: string;
  };
}

interface IntegrationsClientProps {
  initialIntegrations: Integration[];
  connections: Array<{ id: string; name: string }>;
  userId: string;
}

/** Ημερομηνία/ώρα στα ελληνικά, ζώνη Αθήνας. */
function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const WEEKDAYS = [
  "Κυριακή",
  "Δευτέρα",
  "Τρίτη",
  "Τετάρτη",
  "Πέμπτη",
  "Παρασκευή",
  "Σάββατο",
];

export function IntegrationsClient({
  initialIntegrations,
  connections,
  userId,
}: IntegrationsClientProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editWizardOpen, setEditWizardOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [syncingIntegrationId, setSyncingIntegrationId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const router = useRouter();
  const cardsRef = useRef<HTMLDivElement>(null);

  // Sync with server data when initialIntegrations changes (after refresh)
  useEffect(() => {
    // Always use server data as source of truth, but merge with any local updates that haven't been synced yet
    setIntegrations((prev) => {
      // Create a map of server integrations by ID
      const serverMap = new Map(initialIntegrations.map((int) => [int.id, int]));

      // Update existing integrations with server data, but keep local lastSyncAt if it's more recent
      return prev.map((currentInt) => {
        const serverInt = serverMap.get(currentInt.id);
        if (serverInt) {
          // Use server data, but if we have a local lastSyncAt that's more recent, use that
          if (currentInt.lastSyncAt && serverInt.lastSyncAt) {
            const currentTime = new Date(currentInt.lastSyncAt).getTime();
            const serverTime = new Date(serverInt.lastSyncAt).getTime();
            if (currentTime > serverTime) {
              return { ...serverInt, lastSyncAt: currentInt.lastSyncAt };
            }
          }
          return serverInt;
        }
        return currentInt;
      }).concat(
        // Add any new integrations from server that aren't in current state
        initialIntegrations.filter((serverInt) =>
          !prev.some((currentInt) => currentInt.id === serverInt.id)
        )
      );
    });
  }, [initialIntegrations]);

  // Animate cards on mount or when integrations change
  useEffect(() => {
    if (cardsRef.current) {
      const cards = cardsRef.current.children;
      gsap.fromTo(
        Array.from(cards),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" }
      );
    }
  }, [integrations]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/softone/integrations/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || "Η διαγραφή της ενσωμάτωσης απέτυχε");
        return;
      }

      setIntegrations((prev) => prev.filter((int) => int.id !== id));
      toast.success("Η ενσωμάτωση διαγράφηκε");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Η διαγραφή της ενσωμάτωσης απέτυχε");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSyncNow = async (integrationId: string, options?: { fullSync?: boolean }) => {
    setSyncingIntegrationId(integrationId);
    try {
      const body: { integrationId: string; fullSync?: boolean } = { integrationId };
      if (options?.fullSync) body.fullSync = true;

      const response = await fetch("/api/cron/sync-integration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || "Ο συγχρονισμός απέτυχε");
        return;
      }

      const created = data.stats?.erpToApp?.created ?? data.stats?.created ?? 0;
      const updated = data.stats?.erpToApp?.updated ?? data.stats?.updated ?? 0;
      const skipped = data.instlinesSkipped as { count: number; reasons: Record<string, number> } | undefined;

      if (data.stats?.totalRecords !== undefined) {
        setRecordCounts((prev) => ({
          ...prev,
          [integrationId]: data.stats.totalRecords,
        }));
      }

      let message = `Ο συγχρονισμός ολοκληρώθηκε: ${created.toLocaleString("el-GR")} νέες, ${updated.toLocaleString("el-GR")} ενημερωμένες.`;
      if (skipped && skipped.count > 0) {
        const instNotFound = skipped.reasons?.INST_not_found ?? 0;
        const instNoTrdr = skipped.reasons?.INST_missing_TRDR ?? 0;
        message += ` Παραλείφθηκαν ${skipped.count.toLocaleString("el-GR")} γραμμές (το INST δεν υπάρχει στη βάση ή δεν έχει πελάτη). Συγχρονίστε πρώτα το INST (συμβόλαια) και μετά ξανά το INSTLINES για να έρθουν όλες οι πινακίδες.`;
        toast.warning(message, { duration: 8000 });
      } else {
        toast.success(message);
      }

      if (data.lastSyncAt) {
        setIntegrations((prev) =>
          prev.map((int) =>
            int.id === integrationId
              ? { ...int, lastSyncAt: new Date(data.lastSyncAt) }
              : int
          )
        );
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to sync integration:", error);
      toast.error("Ο συγχρονισμός απέτυχε");
    } finally {
      setSyncingIntegrationId(null);
    }
  };

  const handleWizardCreated = async (integration: { id: string; name: string }) => {
    toast.success(`Η ενσωμάτωση «${integration.name}» αποθηκεύτηκε`);
    // Refresh the page to get updated integrations
    router.refresh();
    // Also fetch the new integration to add to local state (only if not already present)
    try {
      const response = await fetch(`/api/softone/integrations/${integration.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.integration) {
          setIntegrations((prev) => {
            // Check if integration already exists to avoid duplicates
            const exists = prev.some((int) => int.id === data.integration.id);
            if (exists) {
              return prev; // Already exists, don't add again
            }
            return [data.integration, ...prev];
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch new integration:", error);
      // Still refresh the page as fallback
    }
  };

  // Convert cron expression to readable text
  const getReadableSchedule = (config: Record<string, any>): string => {
    const schedule = config?.schedule;
    if (!schedule) return "Χωρίς προγραμματισμό";

    const presetSchedule = schedule.presetSchedule;
    const cronExpression = schedule.cronExpression;
    const scheduleTime = schedule.scheduleTime;
    const scheduleDay = schedule.scheduleDay;

    if (presetSchedule) {
      switch (presetSchedule) {
        case "every-15-min":
          return "Κάθε 15 λεπτά";
        case "every-30-min":
          return "Κάθε 30 λεπτά";
        case "hourly":
          return "Κάθε ώρα";
        case "every-6-hours":
          return "Κάθε 6 ώρες";
        case "every-12-hours":
          return "Κάθε 12 ώρες";
        case "daily":
          return scheduleTime ? `Καθημερινά στις ${scheduleTime}` : "Καθημερινά";
        case "weekly": {
          const dayName = WEEKDAYS[parseInt(scheduleDay || "1")] || "Δευτέρα";
          return scheduleTime ? `Κάθε ${dayName} στις ${scheduleTime}` : `Κάθε ${dayName}`;
        }
        default:
          return cronExpression || "Προσαρμοσμένος προγραμματισμός";
      }
    }

    // Try to parse common cron patterns
    if (cronExpression) {
      const parts = cronExpression.split(" ");
      if (parts.length >= 5) {
        const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

        // Every X minutes
        if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
          const minutes = minute.replace("*/", "");
          return `Κάθε ${minutes} λεπτά`;
        }

        // Every X hours
        if (minute === "0" && hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
          const hours = hour.replace("*/", "");
          return `Κάθε ${hours} ώρες`;
        }

        // Daily at specific time
        if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
          return `Καθημερινά στις ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
        }

        // Weekly
        if (dayOfWeek !== "*" && dayOfWeek !== "0" && dayOfWeek !== "7") {
          const dayName = WEEKDAYS[parseInt(dayOfWeek)] || "Δευτέρα";
          if (minute !== "*" && hour !== "*") {
            return `Κάθε ${dayName} στις ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
          }
          return `Κάθε ${dayName}`;
        }
      }

      return cronExpression;
    }

    return "Χωρίς προγραμματισμό";
  };

  const selectedConfig = (selectedIntegration?.configJson ?? {}) as any;
  const selectedModelMapping = selectedConfig.modelMapping ?? {};

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ενσωματώσεις SoftOne"
        description={`Συγχρονισμός δεδομένων του ERP με την εφαρμογή. ${integrations.length.toLocaleString("el-GR")} ${integrations.length === 1 ? "ενσωμάτωση" : "ενσωματώσεις"}.`}
        icon={Database}
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus />
            Νέα ενσωμάτωση
          </Button>
        }
      />

      {/* Integrations Grid */}
      {integrations.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Καμία ενσωμάτωση ακόμη"
          description="Δημιουργήστε μια ενσωμάτωση SoftOne για να συγχρονίζετε δεδομένα του ERP (π.χ. συμβόλαια INST, πινακίδες INSTLINES). Ο οδηγός σας καθοδηγεί στην ταυτοποίηση, στην επιλογή πίνακα και στην αντιστοίχιση πεδίων."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => router.push("/softone")}>
                Ρυθμίσεις SoftOne
              </Button>
              <Button onClick={() => setWizardOpen(true)}>
                <Plus />
                Δημιουργία ενσωμάτωσης
              </Button>
            </div>
          }
        />
      ) : (
        <div ref={cardsRef} className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {integrations.map((integration) => {
            const config = integration.configJson as any;
            const modelMapping = config?.modelMapping || {};
            const schedule = config?.schedule || {};
            const syncDirection = modelMapping?.syncDirection || "one-way";
            const modelName = modelMapping?.modelName || "N/A";
            const readableSchedule = getReadableSchedule(config);
            const fieldMappingsCount = Object.keys(modelMapping?.fieldMappings || {}).length;
            const selectedFieldsCount = config?.selectedFields?.length || 0;

            return (
              <Card key={integration.id} className="group gap-0 py-3">
                <CardHeader className="gap-1 px-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-sm" title={integration.name}>
                        {integration.name}
                      </CardTitle>
                      <CardDescription className="truncate text-xs" title={integration.connection.name}>
                        {integration.connection.name}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Ενέργειες ενσωμάτωσης"
                          title="Ενέργειες ενσωμάτωσης"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Ενέργειες</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => {
                              router.push(`/integrations/${integration.id}/records`);
                            }}
                          >
                            <List />
                            Προβολή εγγραφών
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye />
                            Στοιχεία ενσωμάτωσης
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setEditWizardOpen(true);
                            }}
                          >
                            <Edit />
                            Επεξεργασία ενσωμάτωσης
                          </DropdownMenuItem>
                          {modelName === "INSTLINES" && (
                            <DropdownMenuItem
                              onClick={() => {
                                toast.info("Ξεκίνησε πλήρης συγχρονισμός INSTLINES. Μπορεί να διαρκέσει 15–30 λεπτά. Μην κλείσετε αυτή την καρτέλα.");
                                handleSyncNow(integration.id, { fullSync: true });
                              }}
                              disabled={syncingIntegrationId === integration.id}
                            >
                              {syncingIntegrationId === integration.id ? <Spinner /> : <RefreshCw />}
                              Πλήρης συγχρονισμός (διαγραφή όλων & επανεισαγωγή)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleSyncNow(integration.id)}
                            disabled={syncingIntegrationId === integration.id}
                          >
                            {syncingIntegrationId === integration.id ? <Spinner /> : <RefreshCw />}
                            Συγχρονισμός τώρα
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeletingId(integration.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 />
                          Διαγραφή ενσωμάτωσης
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {integration.lastSyncAt ? (
                      <StatusBadge
                        variant="success"
                        label={`Συγχρονίστηκε ${formatDateTime(integration.lastSyncAt)}`}
                      />
                    ) : (
                      <StatusBadge variant="neutral" label="Χωρίς συγχρονισμό" />
                    )}
                    {recordCounts[integration.id] !== undefined && (
                      <Badge variant="outline" className="tabular-nums">
                        {recordCounts[integration.id].toLocaleString("el-GR")} εγγραφές
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5 px-3 pt-3 text-xs">
                  {/* Object & Table */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex min-w-0 items-center gap-1">
                      <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">Αντικείμενο:</span>
                      <span className="truncate font-mono" title={integration.objectName}>
                        {integration.objectName}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <Table className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">Πίνακας:</span>
                      <span className="truncate font-mono" title={integration.tableName}>
                        {integration.tableName}
                      </span>
                      <Badge variant="outline" className="font-mono">
                        {integration.tableDbname}
                      </Badge>
                    </span>
                  </div>

                  {/* Model & Sync Direction */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex min-w-0 items-center gap-1">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">Μοντέλο:</span>
                      <span className="truncate font-mono" title={modelName}>
                        {modelName}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <ArrowRightLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">Συγχρονισμός:</span>
                      <Badge variant={syncDirection === "two-way" ? "info" : "neutral"}>
                        {syncDirection === "two-way" ? "Αμφίδρομος" : "Μονόδρομος"}
                      </Badge>
                    </span>
                  </div>

                  {/* Schedule */}
                  <div className="flex min-w-0 items-center gap-1">
                    <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-muted-foreground">Πρόγραμμα:</span>
                    <span className="truncate" title={readableSchedule}>
                      {readableSchedule}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 border-t pt-1.5 text-xs text-muted-foreground tabular-nums">
                    <span>{selectedFieldsCount.toLocaleString("el-GR")} πεδία</span>
                    <span aria-hidden>•</span>
                    <span>{fieldMappingsCount.toLocaleString("el-GR")} αντιστοιχισμένα</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Wizard Modal */}
      <SoftOneIntegrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        userId={userId}
        onCreated={handleWizardCreated}
      />

      {/* Edit Wizard Modal */}
      <SoftOneIntegrationWizard
        open={editWizardOpen}
        onOpenChange={(open) => {
          setEditWizardOpen(open);
          if (!open) setSelectedIntegration(null);
        }}
        userId={userId}
        initialConnectionId={selectedIntegration?.connection.id}
        initialIntegration={selectedIntegration || undefined}
        onCreated={handleWizardCreated}
      />

      {/* View Integration Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Στοιχεία ενσωμάτωσης</DialogTitle>
            <DialogDescription>
              Ρυθμίσεις αντιστοίχισης και προγραμματισμού της ενσωμάτωσης.
            </DialogDescription>
          </DialogHeader>
          {selectedIntegration && (
            <div className="flex flex-col gap-2">
              <InfoPanel title="Βασικά στοιχεία">
                <InfoRow label="Όνομα" wrap>
                  {selectedIntegration.name}
                </InfoRow>
                <InfoRow label="Σύνδεση" wrap>
                  {selectedIntegration.connection.name}
                </InfoRow>
                <InfoRow label="Αντικείμενο" mono>
                  {selectedIntegration.objectName}
                </InfoRow>
                {selectedIntegration.objectCaption && (
                  <InfoRow label="Περιγραφή αντικειμένου" wrap>
                    {selectedIntegration.objectCaption}
                  </InfoRow>
                )}
                <InfoRow label="Πίνακας" mono>
                  {selectedIntegration.tableName}
                </InfoRow>
                <InfoRow label="Πίνακας βάσης" mono>
                  {selectedIntegration.tableDbname}
                </InfoRow>
              </InfoPanel>

              {selectedIntegration.configJson && (
                <InfoPanel title="Αντιστοίχιση μοντέλου" accent="bg-chart-2">
                  <InfoRow label="Μοντέλο προορισμού" mono>
                    {selectedModelMapping.modelName || "—"}
                  </InfoRow>
                  <InfoRow label="Κατεύθυνση">
                    <Badge variant={selectedModelMapping.syncDirection === "two-way" ? "info" : "neutral"}>
                      {selectedModelMapping.syncDirection === "two-way"
                        ? "Αμφίδρομος (ERP ↔ Εφαρμογή)"
                        : "Μονόδρομος (ERP → Εφαρμογή)"}
                    </Badge>
                  </InfoRow>
                  {selectedModelMapping.uniqueIdentifier && (
                    <>
                      <InfoRow label="Μοναδικό πεδίο ERP" mono>
                        {selectedModelMapping.uniqueIdentifier.erpField}
                      </InfoRow>
                      <InfoRow label="Μοναδικό πεδίο μοντέλου" mono>
                        {selectedModelMapping.uniqueIdentifier.modelField}
                      </InfoRow>
                    </>
                  )}
                  <InfoRow label="Αντιστοιχίσεις πεδίων">
                    {Object.keys(selectedModelMapping.fieldMappings || {}).length.toLocaleString("el-GR")}
                  </InfoRow>
                </InfoPanel>
              )}

              {selectedConfig.schedule && (
                <InfoPanel title="Προγραμματισμός" accent="bg-chart-3">
                  <InfoRow label="Συχνότητα" wrap>
                    {getReadableSchedule(selectedIntegration.configJson)}
                  </InfoRow>
                  <InfoRow label="Έκφραση cron" mono wrap>
                    {selectedConfig.schedule.cronExpression}
                  </InfoRow>
                </InfoPanel>
              )}

              {selectedConfig.selectedFields && (
                <section className="rounded-md border bg-card p-3">
                  <h4 className="mb-2 text-xs font-semibold">
                    Επιλεγμένα πεδία ({(selectedConfig.selectedFields as string[]).length.toLocaleString("el-GR")})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {(selectedConfig.selectedFields as string[]).map((field: string) => (
                      <Badge key={field} variant="outline" className="font-mono">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              <InfoPanel title="Χρονικά στοιχεία" accent="bg-chart-4">
                <InfoRow label="Δημιουργήθηκε">{formatDateTime(selectedIntegration.createdAt)}</InfoRow>
                <InfoRow label="Ενημερώθηκε">{formatDateTime(selectedIntegration.updatedAt)}</InfoRow>
              </InfoPanel>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή ενσωμάτωσης</AlertDialogTitle>
            <AlertDialogDescription>
              Θέλετε σίγουρα να διαγράψετε αυτή την ενσωμάτωση; Η ενέργεια δεν αναιρείται.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Διαγραφή…
                </>
              ) : (
                <>
                  <Trash2 />
                  Διαγραφή
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
