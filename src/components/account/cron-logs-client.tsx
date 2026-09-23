"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import gsap from "gsap";
import type { Role } from "@prisma/client";
import { PageHeader, StatCard, StatGrid, StatusBadge, EmptyState, InfoPanel, InfoRow } from "@/components/admin/page";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, Bug, History, CheckCircle2, XCircle, Clock } from "lucide-react";
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

/** Ημερομηνία/ώρα εκτέλεσης σε ελληνική μορφή, ζώνη Αθήνας. */
const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Athens",
  });

/** Διάρκεια σε δευτερόλεπτα, με ελληνικό δεκαδικό. */
const formatDuration = (ms: number | null) =>
  ms == null ? "—" : `${(ms / 1000).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} δευτ.`;

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
        toast.success("Τα στοιχεία διάγνωσης φορτώθηκαν");
      } else {
        toast.error(data.error || "Η φόρτωση των στοιχείων διάγνωσης απέτυχε");
      }
    } catch (error) {
      toast.error("Η φόρτωση των στοιχείων διάγνωσης απέτυχε");
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

  // Σύνοψη για την κορυφή της σελίδας (μόνο παρουσίαση).
  const summary = useMemo(() => {
    const failed = logs.filter((l) => l.status?.toLowerCase() === "error").length;
    const succeeded = logs.filter((l) => l.status?.toLowerCase() === "success").length;
    return {
      total: logs.length,
      succeeded,
      failed,
      last: logs[0]?.startedAt ?? null,
    };
  }, [logs]);

  // Expanded content for each log (accordion)
  const renderLogDetails = (log: CronJobLog) => {
    const stats = log.stats as any;
    const erpToApp = stats?.erpToApp || {};
    const appToErp = stats?.appToErp || {};
    const details = log.details as any || {};

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <InfoPanel title="Εκτέλεση">
            <InfoRow label="Έναρξη">{formatDateTime(log.startedAt)}</InfoRow>
            {log.completedAt && <InfoRow label="Ολοκλήρωση">{formatDateTime(log.completedAt)}</InfoRow>}
            <InfoRow label="Διάρκεια">{formatDuration(log.duration)}</InfoRow>
            <InfoRow label="Τύπος εργασίας" mono>
              {log.jobType}
            </InfoRow>
          </InfoPanel>

          {log.integration && (
            <InfoPanel title="Διασύνδεση" accent="bg-chart-2">
              <InfoRow label="Όνομα" wrap>
                {log.integration.name}
              </InfoRow>
              <InfoRow label="Αντικείμενο" mono>
                {log.integration.objectName}
              </InfoRow>
              <InfoRow label="Πίνακας" mono>
                {log.integration.tableName}
              </InfoRow>
            </InfoPanel>
          )}

          <InfoPanel title="ERP → Εφαρμογή" accent="bg-chart-3">
            <InfoRow label="Σύνολο">{(erpToApp.total || 0).toLocaleString("el-GR")}</InfoRow>
            <InfoRow label="Δημιουργήθηκαν">{(erpToApp.created || 0).toLocaleString("el-GR")}</InfoRow>
            <InfoRow label="Ενημερώθηκαν">{(erpToApp.updated || 0).toLocaleString("el-GR")}</InfoRow>
            <InfoRow label="Συγχρονίστηκαν">{(erpToApp.synced || 0).toLocaleString("el-GR")}</InfoRow>
            {erpToApp.errors > 0 && (
              <InfoRow label="Σφάλματα">
                <span className="text-destructive">{(erpToApp.errors || 0).toLocaleString("el-GR")}</span>
              </InfoRow>
            )}
          </InfoPanel>

          {appToErp && Object.keys(appToErp).length > 0 && (
            <InfoPanel title="Εφαρμογή → ERP" accent="bg-chart-4">
              <InfoRow label="Σύνολο">{(appToErp.total || 0).toLocaleString("el-GR")}</InfoRow>
              <InfoRow label="Δημιουργήθηκαν">{(appToErp.created || 0).toLocaleString("el-GR")}</InfoRow>
              <InfoRow label="Ενημερώθηκαν">{(appToErp.updated || 0).toLocaleString("el-GR")}</InfoRow>
              <InfoRow label="Συγχρονίστηκαν">{(appToErp.synced || 0).toLocaleString("el-GR")}</InfoRow>
              {appToErp.errors > 0 && (
                <InfoRow label="Σφάλματα">
                  <span className="text-destructive">{(appToErp.errors || 0).toLocaleString("el-GR")}</span>
                </InfoRow>
              )}
            </InfoPanel>
          )}
        </div>

        {details && Object.keys(details).length > 0 && (
          <InfoPanel title="Πρόσθετα στοιχεία" accent="bg-chart-5">
            {Object.entries(details).map(([key, value]) => (
              <InfoRow key={key} label={key} wrap>
                {String(value)}
              </InfoRow>
            ))}
          </InfoPanel>
        )}

        {log.error && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Μήνυμα σφάλματος</AlertTitle>
            <AlertDescription className="break-words">{log.error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-4 opacity-0">
      <PageHeader
        title="Αρχείο εκτελέσεων cron"
        description="Κάθε αυτόματη εκτέλεση συγχρονισμού: πότε έτρεξε, πόσο κράτησε και τι άλλαξε."
        icon={History}
        actions={
          <Button
            onClick={fetchDebugInfo}
            disabled={loadingDebug}
            variant="outline"
            title="Φόρτωση στοιχείων διάγνωσης"
          >
            {loadingDebug ? <Spinner /> : <Bug />}
            {loadingDebug ? "Φόρτωση…" : "Στοιχεία διάγνωσης"}
          </Button>
        }
      />

      <StatGrid cols={4}>
        <StatCard label="Εκτελέσεις" value={summary.total} icon={History} hint="Συνολικές καταγραφές" />
        <StatCard
          label="Επιτυχείς"
          value={summary.succeeded}
          icon={CheckCircle2}
          tone={summary.succeeded > 0 ? "success" : "default"}
          hint="Ολοκληρώθηκαν χωρίς σφάλμα"
        />
        <StatCard
          label="Με σφάλμα"
          value={summary.failed}
          icon={XCircle}
          tone={summary.failed > 0 ? "danger" : "default"}
          hint={summary.failed > 0 ? "Χρειάζονται έλεγχο" : "Δεν υπάρχουν σφάλματα"}
        />
        <StatCard
          label="Τελευταία εκτέλεση"
          value={<span className="text-sm">{summary.last ? formatDateTime(summary.last) : "—"}</span>}
          icon={Clock}
          hint="Ώρα Ελλάδας"
        />
      </StatGrid>

      {/* Αναζήτηση */}
      <Card>
        <CardContent>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Αναζήτηση σε τύπο εργασίας, διασύνδεση, κατάσταση ή σφάλμα…"
              aria-label="Αναζήτηση εκτελέσεων"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Στοιχεία διάγνωσης */}
      {debugInfo && (
        <Card>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="text-sm font-semibold">Στοιχεία διάγνωσης</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <InfoPanel title="Σύνοψη συστήματος">
                <InfoRow label="Ενεργές διασυνδέσεις">
                  {Number(debugInfo.activeIntegrations.length).toLocaleString("el-GR")}
                </InfoRow>
                <InfoRow label="Σύνολο καταγραφών">
                  {Number(debugInfo.totalLogsInSystem).toLocaleString("el-GR")}
                </InfoRow>
                <InfoRow label="Δικές σας καταγραφές">
                  {Number(debugInfo.userLogsCount).toLocaleString("el-GR")}
                </InfoRow>
                <InfoRow label="Καταγραφές διασυνδέσεων">
                  {Number(debugInfo.integrationLogsCount).toLocaleString("el-GR")}
                </InfoRow>
              </InfoPanel>

              {debugInfo.activeIntegrations.length > 0 && (
                <InfoPanel title="Ενεργές διασυνδέσεις" accent="bg-chart-2">
                  {debugInfo.activeIntegrations.map((int: any) => (
                    <InfoRow key={int.id} label={int.name} wrap>
                      <span className="font-mono">{int.cronExpression || "—"}</span>
                      {" · "}
                      {int.userId === debugInfo.currentUser.id ? "Εσείς" : int.userId}
                    </InfoRow>
                  ))}
                </InfoPanel>
              )}

              {debugInfo.recentLogs.length > 0 && (
                <InfoPanel title="Πρόσφατες εκτελέσεις" accent="bg-chart-3" className="xl:col-span-2">
                  {debugInfo.recentLogs.slice(0, 5).map((log: any) => (
                    <InfoRow key={log.id} label={log.integrationName || log.jobType} wrap>
                      {log.userEmail || log.userId} · {log.status} · {log.triggeredBy}
                    </InfoRow>
                  ))}
                </InfoPanel>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title={search ? "Καμία εκτέλεση δεν ταιριάζει" : "Δεν υπάρχουν εκτελέσεις"}
          description={
            search
              ? "Δοκιμάστε διαφορετικό όρο αναζήτησης ή καθαρίστε το πεδίο."
              : "Μόλις τρέξει η πρώτη αυτόματη εργασία, θα εμφανιστεί εδώ."
          }
          action={
            search ? (
              <Button variant="outline" onClick={() => setSearch("")} title="Καθαρισμός αναζήτησης">
                Καθαρισμός αναζήτησης
              </Button>
            ) : undefined
          }
        />
      ) : (
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
                  <AccordionItem key={log.id} value={log.id} className="border-b last:border-b-0">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-3 text-left text-xs">
                        <span className="tabular-nums text-muted-foreground">
                          {formatDateTime(log.startedAt)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {log.integration?.name || log.jobType}
                        </span>
                        <StatusBadge status={log.status} />
                        <span className="tabular-nums text-muted-foreground">
                          {formatDuration(log.duration)}
                        </span>
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <span className="text-muted-foreground">
                            Νέα {totalCreated.toLocaleString("el-GR")}
                          </span>
                          <span className="text-muted-foreground">
                            Ενημ. {totalUpdated.toLocaleString("el-GR")}
                          </span>
                          {totalErrors > 0 && (
                            <span className="text-destructive">
                              Σφάλματα {totalErrors.toLocaleString("el-GR")}
                            </span>
                          )}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      {renderLogDetails(log)}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
