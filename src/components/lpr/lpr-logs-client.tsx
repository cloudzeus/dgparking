"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import gsap from "gsap";
import { PageHeader, KpiTile, EmptyState, InfoPanel, InfoRow } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  RefreshCw,
  Camera,
  CheckCircle,
  XCircle,
  AlertCircle,
  ScrollText,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LogEntry {
  timestamp: string;
  receivedAt: number;
  event: string;
  device?: string;
  data: any;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    processingTime?: number;
    success?: boolean;
    error?: string;
    headers?: Record<string, string>;
  };
}

/** Ώρα Ελλάδας — σύντομη μορφή για τη λίστα. */
function formatShort(value: string | number) {
  return new Date(value).toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Ώρα Ελλάδας — πλήρης μορφή για τις λεπτομέρειες. */
function formatFull(value: string | number) {
  return new Date(value).toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    dateStyle: "long",
    timeStyle: "medium",
  });
}

export function LprLogsClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(500);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lpr-logs?limit=${limit}&days=30`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.entries);
        toast.success(
          `Φορτώθηκαν ${result.entries.length.toLocaleString("el-GR")} καταγραφές από ${result.filesRead} αρχείο/α`
        );
      } else {
        toast.error(result.error || "Η φόρτωση των καταγραφών απέτυχε");
      }
    } catch (error) {
      toast.error("Η ανάκτηση των καταγραφών απέτυχε");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [limit]);

  // Filter logs based on search
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const searchLower = search.toLowerCase();
    return logs.filter(
      (log) =>
        log.event?.toLowerCase().includes(searchLower) ||
        log.device?.toLowerCase().includes(searchLower) ||
        log.data?.plate?.toLowerCase().includes(searchLower) ||
        log.metadata?.ipAddress?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.data).toLowerCase().includes(searchLower)
    );
  }, [logs, search]);

  const successCount = filteredLogs.filter((l) => l.metadata?.success !== false).length;
  const errorCount = filteredLogs.filter(
    (l) => l.metadata?.success === false || l.metadata?.error
  ).length;

  const getStatusBadge = (entry: LogEntry) => {
    if (entry.metadata?.success === false) {
      return (
        <Badge variant="danger">
          <XCircle aria-hidden />
          Σφάλμα
        </Badge>
      );
    }
    if (entry.metadata?.error) {
      return (
        <Badge variant="warning">
          <AlertCircle aria-hidden />
          Προειδοποίηση
        </Badge>
      );
    }
    return (
      <Badge variant="success">
        <CheckCircle aria-hidden />
        Επιτυχία
      </Badge>
    );
  };

  return (
    <div ref={containerRef} className="space-y-4">
      <PageHeader
        title="Καταγραφές καμερών LPR"
        description="Όλα τα εισερχόμενα μηνύματα από τις κάμερες αναγνώρισης πινακίδων των τελευταίων 30 ημερών."
        icon={ScrollText}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            title="Ανανέωση καταγραφών"
          >
            {loading ? <Spinner data-icon="inline-start" /> : <RefreshCw className="size-4" />}
            Ανανέωση
          </Button>
        }
      />

      {/* Αριθμοί */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Φορτωμένες καταγραφές"
          value={logs.length.toLocaleString("el-GR")}
          hint="Όσες επέστρεψε η τελευταία ανάγνωση"
          icon={ScrollText}
          tone="blue"
        />
        <KpiTile
          label="Εμφανίζονται"
          value={filteredLogs.length.toLocaleString("el-GR")}
          hint={search ? "Μετά την αναζήτηση" : "Χωρίς φίλτρο αναζήτησης"}
          icon={ListChecks}
          tone="violet"
        />
        <KpiTile
          label="Επιτυχημένες"
          value={successCount.toLocaleString("el-GR")}
          hint="Μηνύματα που έγιναν δεκτά"
          icon={CheckCircle}
          tone="green"
        />
        <KpiTile
          label="Σφάλματα"
          value={errorCount.toLocaleString("el-GR")}
          hint="Μηνύματα με σφάλμα ή προειδοποίηση"
          icon={AlertCircle}
          tone="red"
        />
      </div>

      {/* Φίλτρα */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              placeholder="Αναζήτηση σε συμβάν, συσκευή, πινακίδα, IP…"
              aria-label="Αναζήτηση καταγραφών"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lpr-logs-limit" className="text-xs text-muted-foreground">
                Πλήθος εγγραφών
              </Label>
              <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                <SelectTrigger id="lpr-logs-limit" className="w-44" aria-label="Πλήθος εγγραφών">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="100">Τελευταίες 100</SelectItem>
                    <SelectItem value="500">Τελευταίες 500</SelectItem>
                    <SelectItem value="1000">Τελευταίες 1.000</SelectItem>
                    <SelectItem value="5000">Τελευταίες 5.000</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Λίστα καταγραφών */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={Camera}
          title={search ? "Καμία καταγραφή για την αναζήτηση" : "Δεν βρέθηκαν καταγραφές"}
          description={
            search
              ? "Δοκιμάστε διαφορετικό όρο αναζήτησης ή μεγαλύτερο πλήθος εγγραφών."
              : "Δεν υπάρχουν μηνύματα από τις κάμερες για την περίοδο των τελευταίων 30 ημερών."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filteredLogs.map((entry, index) => (
            <Card key={`${entry.receivedAt}-${index}`} className="py-0">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={`log-${index}`} className="border-b-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 pr-2">
                      {getStatusBadge(entry)}
                      <Badge variant="outline" className="font-mono">
                        {entry.event || "unknown"}
                      </Badge>
                      {entry.device && (
                        <span className="min-w-0 truncate text-xs text-muted-foreground" title={entry.device}>
                          {entry.device}
                        </span>
                      )}
                      {entry.data?.plate && (
                        <span className="min-w-0 truncate font-mono text-xs uppercase tabular-nums">
                          {entry.data.plate}
                        </span>
                      )}
                      <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatShort(entry.timestamp || entry.receivedAt)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="flex flex-col gap-3 pt-1">
                      {entry.metadata && (
                        <InfoPanel title="Στοιχεία μηνύματος">
                          {entry.metadata.ipAddress && (
                            <InfoRow label="Διεύθυνση IP" mono>
                              {entry.metadata.ipAddress}
                            </InfoRow>
                          )}
                          {entry.metadata.processingTime !== undefined && (
                            <InfoRow label="Χρόνος επεξεργασίας">
                              {`${entry.metadata.processingTime.toLocaleString("el-GR")} ms`}
                            </InfoRow>
                          )}
                          {entry.metadata.error && (
                            <InfoRow label="Σφάλμα" wrap>
                              <span className="text-destructive">{entry.metadata.error}</span>
                            </InfoRow>
                          )}
                          <InfoRow label="Παραλήφθηκε">
                            {formatFull(entry.timestamp || entry.receivedAt)}
                          </InfoRow>
                        </InfoPanel>
                      )}

                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-semibold text-muted-foreground">
                          Πλήρες μήνυμα
                        </h4>
                        <div className="rounded-md border bg-muted/50 p-3">
                          <pre className="overflow-x-auto font-mono text-xs break-words whitespace-pre-wrap">
                            {JSON.stringify(entry.data, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {!entry.metadata && (
                        <p className="text-xs text-muted-foreground">
                          Παραλήφθηκε: {formatFull(entry.timestamp || entry.receivedAt)}
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
