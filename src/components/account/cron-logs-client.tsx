"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { Search, RefreshCw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CronJobLog {
  id: string;
  userId: string;
  integrationId: string | null;
  jobType: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  stats: any;
  error: string | null;
  details: any;
  createdAt: Date;
  integration: {
    id: string;
    name: string;
    objectName: string;
    tableName: string;
  } | null;
}

interface CronLogsClientProps {
  logs: CronJobLog[];
  currentUserRole: Role;
}

export function CronLogsClient({
  logs,
  currentUserRole,
}: CronLogsClientProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

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

  const fetchDebugInfo = async () => {
    setLoadingDebug(true);
    try {
      const response = await fetch("/api/cron/debug");
      const data = await response.json();
      if (data.success) {
        setDebugInfo(data.debug);
        toast.success("Debug info loaded");
      } else {
        toast.error(data.error || "Failed to load debug info");
      }
    } catch (error) {
      toast.error("Failed to fetch debug info");
      console.error(error);
    } finally {
      setLoadingDebug(false);
    }
  };

  // Filter logs based on search
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const searchLower = search.toLowerCase();
    return logs.filter(
      (log) =>
        log.jobType?.toLowerCase().includes(searchLower) ||
        log.integration?.name?.toLowerCase().includes(searchLower) ||
        log.status?.toLowerCase().includes(searchLower) ||
        log.error?.toLowerCase().includes(searchLower)
    );
  }, [logs, search]);

  // Expanded content for each log (accordion)
  const renderLogDetails = (log: CronJobLog) => {
    const stats = log.stats as any;
    const erpToApp = stats?.erpToApp || {};
    const appToErp = stats?.appToErp || {};
    const details = log.details as any || {};

    return (
      <div className="space-y-4 p-4 bg-muted/30 rounded-md">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[9px] font-medium text-muted-foreground mb-1">
              STARTED AT
            </div>
            <div className="text-[9px]">
              {format(new Date(log.startedAt), "yyyy-MM-dd HH:mm:ss")}
            </div>
          </div>
          {log.completedAt && (
            <div>
              <div className="text-[9px] font-medium text-muted-foreground mb-1">
                COMPLETED AT
              </div>
              <div className="text-[9px]">
                {format(new Date(log.completedAt), "yyyy-MM-dd HH:mm:ss")}
              </div>
            </div>
          )}
          <div>
            <div className="text-[9px] font-medium text-muted-foreground mb-1">
              DURATION
            </div>
            <div className="text-[9px]">
              {log.duration ? `${(log.duration / 1000).toFixed(2)}s` : "N/A"}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-medium text-muted-foreground mb-1">
              JOB TYPE
            </div>
            <div className="text-[9px]">{log.jobType}</div>
          </div>
        </div>

        {/* Integration Details */}
        {log.integration && (
          <div>
            <div className="text-[9px] font-medium text-muted-foreground mb-1">
              INTEGRATION
            </div>
            <div className="text-[9px] space-y-1">
              <div>Name: {log.integration.name}</div>
              <div>Object: {log.integration.objectName}</div>
              <div>Table: {log.integration.tableName}</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div>
          <div className="text-[9px] font-medium text-muted-foreground mb-2">
            SYNC STATISTICS
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* ERP to App Stats */}
            <div className="space-y-2">
              <div className="text-[9px] font-semibold">ERP → App</div>
              <div className="text-[9px] space-y-1 pl-2">
                <div>Total: {erpToApp.total || 0}</div>
                <div className="text-green-600">Created: {erpToApp.created || 0}</div>
                <div className="text-blue-600">Updated: {erpToApp.updated || 0}</div>
                <div>Synced: {erpToApp.synced || 0}</div>
                {erpToApp.errors > 0 && (
                  <div className="text-red-600">Errors: {erpToApp.errors || 0}</div>
                )}
              </div>
            </div>

            {/* App to ERP Stats (if two-way) */}
            {appToErp && Object.keys(appToErp).length > 0 && (
              <div className="space-y-2">
                <div className="text-[9px] font-semibold">App → ERP</div>
                <div className="text-[9px] space-y-1 pl-2">
                  <div>Total: {appToErp.total || 0}</div>
                  <div className="text-green-600">Created: {appToErp.created || 0}</div>
                  <div className="text-blue-600">Updated: {appToErp.updated || 0}</div>
                  <div>Synced: {appToErp.synced || 0}</div>
                  {appToErp.errors > 0 && (
                    <div className="text-red-600">Errors: {appToErp.errors || 0}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Additional Details */}
        {details && Object.keys(details).length > 0 && (
          <div>
            <div className="text-[9px] font-medium text-muted-foreground mb-2">
              ADDITIONAL DETAILS
            </div>
            <div className="text-[9px] space-y-1 bg-background p-2 rounded border">
              {Object.entries(details).map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium">{key}:</span>{" "}
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {log.error && (
          <div>
            <div className="text-[9px] font-medium text-red-600 mb-1">
              ERROR MESSAGE
            </div>
            <div className="text-[9px] bg-red-50 dark:bg-red-950/20 p-2 rounded border border-red-200 dark:border-red-800">
              {log.error}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-6 opacity-0">
      <PageHeader
        title="CRON JOB LOGS"
        highlight="LOGS"
        subtitle={`Viewing ${filteredLogs.length} log${filteredLogs.length !== 1 ? "s" : ""}`}
      />

      {/* Search Box and Debug */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs by job type, integration, status, or error..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 border-muted-foreground/20 focus:border-violet-500/50 text-[11px]"
          />
        </div>
        <Button
          onClick={fetchDebugInfo}
          disabled={loadingDebug}
          variant="outline"
          size="sm"
          className="h-9 text-[10px]"
        >
          {loadingDebug ? (
            <>
              <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
              LOADING...
            </>
          ) : (
            <>
              <Bug className="h-3 w-3 mr-2" />
              DEBUG INFO
            </>
          )}
        </Button>
      </div>

      {/* Debug Info Display */}
      {debugInfo && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="text-[9px] space-y-2">
              <div className="font-bold mb-2">DEBUG INFORMATION</div>
              <div><strong>Active Integrations:</strong> {debugInfo.activeIntegrations.length}</div>
              <div><strong>Total Logs in System:</strong> {debugInfo.totalLogsInSystem}</div>
              <div><strong>Your Logs:</strong> {debugInfo.userLogsCount}</div>
              <div><strong>Integration Logs:</strong> {debugInfo.integrationLogsCount}</div>
              {debugInfo.activeIntegrations.length > 0 && (
                <div className="mt-3">
                  <div className="font-bold mb-1">Active Integrations:</div>
                  {debugInfo.activeIntegrations.map((int: any) => (
                    <div key={int.id} className="ml-2 text-[8px]">
                      • {int.name} (cron: {int.cronExpression || "none"}) - User: {int.userId === debugInfo.currentUser.id ? "YOU" : int.userId}
                    </div>
                  ))}
                </div>
              )}
              {debugInfo.recentLogs.length > 0 && (
                <div className="mt-3">
                  <div className="font-bold mb-1">Recent Logs (first 5):</div>
                  {debugInfo.recentLogs.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="ml-2 text-[8px]">
                      • {log.integrationName || log.jobType} - User: {log.userEmail || log.userId} - Status: {log.status} - Triggered: {log.triggeredBy}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Accordion type="single" collapsible className="w-full">
            {filteredLogs.map((log) => {
              const stats = log.stats as any;
              const erpToApp = stats?.erpToApp || {};
              const appToErp = stats?.appToErp || {};
              const totalCreated = (erpToApp.created || 0) + (appToErp.created || 0);
              const totalUpdated = (erpToApp.updated || 0) + (appToErp.updated || 0);
              const totalErrors = (erpToApp.errors || 0) + (appToErp.errors || 0);
              
              return (
                <AccordionItem key={log.id} value={log.id} className="border-b">
                  <AccordionTrigger className="hover:no-underline px-4 py-3">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4 flex-1 text-left">
                        <div className="text-[9px] w-40 font-mono">
                          {format(new Date(log.startedAt), "yyyy-MM-dd HH:mm:ss")}
                        </div>
                        <div className="text-[9px] font-medium w-48">
                          {log.integration?.name || log.jobType}
                        </div>
                        <Badge
                          className={`text-[8px] ${
                            log.status === "success"
                              ? "bg-green-500/10 text-green-700 dark:text-green-400"
                              : log.status === "error"
                              ? "bg-red-500/10 text-red-700 dark:text-red-400"
                              : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </Badge>
                        <div className="text-[9px] text-muted-foreground w-20">
                          {log.duration ? `${(log.duration / 1000).toFixed(2)}s` : "N/A"}
                        </div>
                        <div className="text-[9px] space-x-2">
                          <span className="text-green-600 font-medium">+{totalCreated}</span>
                          <span className="text-blue-600 font-medium">~{totalUpdated}</span>
                          {totalErrors > 0 && (
                            <span className="text-red-600 font-medium">!{totalErrors}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {renderLogDetails(log)}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-[9px] text-muted-foreground">
              {search ? "No logs found matching your search." : "No cron job logs found."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


