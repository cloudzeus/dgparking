"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Edit,
  Eye,
  Clock,
  ArrowRightLeft,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
  List,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SoftOneIntegrationWizard } from "@/components/softone/softone-integration-wizard";
import { toast } from "sonner";
import { formFieldStyles } from "@/lib/form-styles";
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
        toast.error(data.error || "Failed to delete integration");
        return;
      }

      setIntegrations((prev) => prev.filter((int) => int.id !== id));
      toast.success("Integration deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete integration");
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
        toast.error(data.error || "Failed to sync integration");
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

      let message = `Sync completed: ${created} created, ${updated} updated.`;
      if (skipped && skipped.count > 0) {
        const instNotFound = skipped.reasons?.INST_not_found ?? 0;
        const instNoTrdr = skipped.reasons?.INST_missing_TRDR ?? 0;
        message += ` ${skipped.count} skipped (INST not in DB or no customer). Sync INST (contracts) first, then sync INSTLINES again to get all plates.`;
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
      toast.error("Failed to sync integration");
    } finally {
      setSyncingIntegrationId(null);
    }
  };

  const handleWizardCreated = async (integration: { id: string; name: string }) => {
    toast.success(`Integration "${integration.name}" created successfully`);
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
    if (!schedule) return "Not scheduled";

    const presetSchedule = schedule.presetSchedule;
    const cronExpression = schedule.cronExpression;
    const scheduleTime = schedule.scheduleTime;
    const scheduleDay = schedule.scheduleDay;

    if (presetSchedule) {
      switch (presetSchedule) {
        case "every-15-min":
          return "Every 15 minutes";
        case "every-30-min":
          return "Every 30 minutes";
        case "hourly":
          return "Every hour";
        case "every-6-hours":
          return "Once per 6 hours";
        case "every-12-hours":
          return "Once per 12 hours";
        case "daily":
          return scheduleTime ? `Daily at ${scheduleTime}` : "Daily";
        case "weekly": {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const dayName = days[parseInt(scheduleDay || "1")] || "Monday";
          return scheduleTime ? `Weekly on ${dayName} at ${scheduleTime}` : `Weekly on ${dayName}`;
        }
        default:
          return cronExpression || "Custom schedule";
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
          return `Every ${minutes} minutes`;
        }
        
        // Every X hours
        if (minute === "0" && hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
          const hours = hour.replace("*/", "");
          return `Once per ${hours} hours`;
        }
        
        // Daily at specific time
        if (minute !== "*" && hour !== "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
          return `Daily at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
        }
        
        // Weekly
        if (dayOfWeek !== "*" && dayOfWeek !== "0" && dayOfWeek !== "7") {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const dayName = days[parseInt(dayOfWeek)] || "Monday";
          if (minute !== "*" && hour !== "*") {
            return `Weekly on ${dayName} at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
          }
          return `Weekly on ${dayName}`;
        }
      }
      
      return cronExpression;
    }

    return "Not scheduled";
  };

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">MY INTEGRATIONS</h2>
          <p className="text-[9px] text-muted-foreground mt-1">
            {integrations.length} integration{integrations.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className={formFieldStyles.button}>
          <Plus className={formFieldStyles.buttonIcon} />
          NEW INTEGRATION
        </Button>
      </div>

      {/* Integrations Grid */}
      {integrations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 px-6">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-sm font-semibold mb-2">No integrations yet</h3>
            <p className="text-[9px] text-muted-foreground text-center mb-4 max-w-sm">
              Create a SoftOne integration to sync ERP data (e.g. INST contracts, INSTLINES license plates). The wizard will let you authenticate, pick a table, and map fields.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-center">
              <Button
                variant="outline"
                size="sm"
                className={formFieldStyles.button}
                onClick={() => router.push("/softone")}
              >
                SoftOne ERP
              </Button>
              <Button onClick={() => setWizardOpen(true)} className={formFieldStyles.button}>
                <Plus className={formFieldStyles.buttonIcon} />
                CREATE INTEGRATION
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
              <Card
                key={integration.id}
                className="group relative overflow-hidden border bg-card hover:shadow-md transition-all duration-200"
              >
                <CardHeader className="relative p-2 pb-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-[10px] font-bold truncate">
                        {integration.name}
                      </CardTitle>
                      <CardDescription className="text-[8px] text-muted-foreground truncate">
                        {integration.connection.name}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Sync Status Badge */}
                      {integration.lastSyncAt ? (
                        <Badge 
                          variant="secondary" 
                          className="text-[7px] px-1.5 py-0.5 h-4 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700 flex items-center gap-1 shrink-0"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span className="font-medium whitespace-nowrap">
                            {new Date(integration.lastSyncAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {recordCounts[integration.id] !== undefined && (
                            <>
                              <span className="mx-0.5">•</span>
                              <span className="whitespace-nowrap">{recordCounts[integration.id]} records</span>
                            </>
                          )}
                        </Badge>
                      ) : (
                        <Badge 
                          variant="secondary" 
                          className="text-[7px] px-1.5 py-0.5 h-4 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700 flex items-center gap-1 shrink-0"
                        >
                          <XCircle className="h-2.5 w-2.5" />
                          <span className="whitespace-nowrap">Never synced</span>
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="!h-2.5 !w-2.5 !p-0 !min-w-0 flex items-center justify-center hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Actions"
                          >
                            <MoreHorizontal className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-[9px]">ACTIONS</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[9px] cursor-pointer"
                            onClick={() => {
                              router.push(`/integrations/${integration.id}/records`);
                            }}
                          >
                            <List className="h-3 w-3 mr-2 text-indigo-600" />
                            View Records
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-[9px] cursor-pointer"
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-2 text-primary" />
                            View Integration
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-[9px] cursor-pointer"
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setEditWizardOpen(true);
                            }}
                          >
                            <Edit className="h-3 w-3 mr-2 text-blue-600" />
                            Edit Integration
                          </DropdownMenuItem>
                          {modelName === "INSTLINES" && (
                            <DropdownMenuItem
                              className="text-[9px] cursor-pointer"
                              onClick={() => {
                                toast.info("INSTLINES full sync started. This may take 15–30 min. Do not close this tab.");
                                handleSyncNow(integration.id, { fullSync: true });
                              }}
                              disabled={syncingIntegrationId === integration.id}
                            >
                              {syncingIntegrationId === integration.id ? (
                                <Loader2 className="h-3 w-3 mr-2 text-amber-600 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-2 text-amber-600" />
                              )}
                              Full sync (delete all & re-import ~32k)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-[9px] cursor-pointer"
                            onClick={() => handleSyncNow(integration.id)}
                            disabled={syncingIntegrationId === integration.id}
                          >
                            {syncingIntegrationId === integration.id ? (
                              <Loader2 className="h-3 w-3 mr-2 text-green-600 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-2 text-green-600" />
                            )}
                            Sync Now
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[9px] cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeletingId(integration.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete Integration
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative p-2 pt-0 space-y-1">
                  {/* Object & Table on same row */}
                  <div className="flex items-center gap-2 text-[8px]">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Database className="h-2.5 w-2.5 text-blue-600 shrink-0" />
                      <span className="font-medium text-muted-foreground">OBJ:</span>
                      <span className="truncate font-semibold">{integration.objectName}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Table className="h-2.5 w-2.5 text-purple-600 shrink-0" />
                      <span className="font-medium text-muted-foreground">TBL:</span>
                      <span className="truncate font-semibold">{integration.tableName}</span>
                      <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                        {integration.tableDbname}
                      </Badge>
                    </div>
                  </div>

                  {/* Model & Sync Direction on same row */}
                  <div className="flex items-center gap-2 text-[8px]">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <MapPin className="h-2.5 w-2.5 text-green-600 shrink-0" />
                      <span className="font-medium text-muted-foreground">MODEL:</span>
                      <span className="truncate font-semibold">{modelName}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <ArrowRightLeft className="h-2.5 w-2.5 text-orange-600 shrink-0" />
                      <span className="font-medium text-muted-foreground">SYNC:</span>
                      <Badge 
                        variant={syncDirection === "two-way" ? "default" : "secondary"} 
                        className={`text-[7px] px-1 py-0 h-3 ${
                          syncDirection === "two-way" 
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700" 
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                        }`}
                      >
                        {syncDirection === "two-way" ? "↔" : "→"}
                      </Badge>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="flex items-center gap-1.5 text-[8px]">
                    <Clock className="h-2.5 w-2.5 text-cyan-600 shrink-0" />
                    <span className="font-medium text-muted-foreground">SCHEDULE:</span>
                    <span className="truncate text-[7px] bg-cyan-50 dark:bg-cyan-950/20 px-1 py-0.5 rounded">{readableSchedule}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 pt-1 border-t text-[7px] text-muted-foreground">
                    <span>{selectedFieldsCount} fields</span>
                    <span>•</span>
                    <span>{fieldMappingsCount} mapped</span>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">INTEGRATION DETAILS</DialogTitle>
          </DialogHeader>
          {selectedIntegration && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase text-muted-foreground">BASIC INFORMATION</h3>
                <div className="grid grid-cols-2 gap-3 text-[9px]">
                  <div>
                    <span className="font-medium text-muted-foreground">Name:</span>
                    <div className="font-semibold">{selectedIntegration.name}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Connection:</span>
                    <div className="font-semibold">{selectedIntegration.connection.name}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Object:</span>
                    <div className="font-semibold">{selectedIntegration.objectName}</div>
                    {selectedIntegration.objectCaption && (
                      <div className="text-muted-foreground">{selectedIntegration.objectCaption}</div>
                    )}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Table:</span>
                    <div className="font-semibold">{selectedIntegration.tableName}</div>
                    <Badge variant="secondary" className="text-[8px] mt-0.5">
                      {selectedIntegration.tableDbname}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Model Mapping */}
              {selectedIntegration.configJson && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase text-muted-foreground">MODEL MAPPING</h3>
                  <div className="bg-muted/50 p-3 rounded-md space-y-2 text-[9px]">
                    <div>
                      <span className="font-medium text-muted-foreground">Target Model:</span>{" "}
                      <span className="font-semibold">{(selectedIntegration.configJson as any).modelMapping?.modelName || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Sync Direction:</span>{" "}
                      <Badge variant={(selectedIntegration.configJson as any).modelMapping?.syncDirection === "two-way" ? "default" : "secondary"} className="text-[8px]">
                        {(selectedIntegration.configJson as any).modelMapping?.syncDirection === "two-way" ? "Two-way (ERP ↔ App)" : "One-way (ERP → App)"}
                      </Badge>
                    </div>
                    {(selectedIntegration.configJson as any).modelMapping?.uniqueIdentifier && (
                      <div>
                        <span className="font-medium text-muted-foreground">Unique Identifiers:</span>
                        <div className="mt-1 space-y-1">
                          <div className="font-mono text-[8px]">
                            ERP: <span className="font-semibold">{(selectedIntegration.configJson as any).modelMapping.uniqueIdentifier.erpField}</span>
                          </div>
                          <div className="font-mono text-[8px]">
                            Model: <span className="font-semibold">{(selectedIntegration.configJson as any).modelMapping.uniqueIdentifier.modelField}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-muted-foreground">Field Mappings:</span>{" "}
                      <span className="font-semibold">
                        {Object.keys((selectedIntegration.configJson as any).modelMapping?.fieldMappings || {}).length} configured
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule */}
              {selectedIntegration.configJson && (selectedIntegration.configJson as any).schedule && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase text-muted-foreground">SCHEDULE</h3>
                  <div className="bg-muted/50 p-3 rounded-md space-y-1 text-[9px]">
                    <div>
                      <span className="font-medium text-muted-foreground">Schedule:</span>{" "}
                      <span className="font-semibold">{getReadableSchedule(selectedIntegration.configJson)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Cron Expression:</span>
                      <div className="font-mono text-[8px] mt-1">{(selectedIntegration.configJson as any).schedule.cronExpression}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Fields */}
              {selectedIntegration.configJson && (selectedIntegration.configJson as any).selectedFields && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase text-muted-foreground">
                    SELECTED FIELDS ({(selectedIntegration.configJson as any).selectedFields.length})
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {(selectedIntegration.configJson as any).selectedFields.map((field: string) => (
                      <Badge key={field} variant="outline" className="text-[8px] px-1.5 py-0.5">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="space-y-2 pt-2 border-t">
                <div className="grid grid-cols-2 gap-3 text-[8px] text-muted-foreground">
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(selectedIntegration.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Updated:</span>{" "}
                    {new Date(selectedIntegration.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Integration</AlertDialogTitle>
            <AlertDialogDescription className="text-[9px]">
              Are you sure you want to delete this integration? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className={formFieldStyles.button}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              disabled={isDeleting}
              className={`${formFieldStyles.button} bg-destructive text-destructive-foreground hover:bg-destructive/90`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className={formFieldStyles.buttonIcon} />
                  DELETING...
                </>
              ) : (
                <>
                  <Trash2 className={formFieldStyles.buttonIcon} />
                  DELETE
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

