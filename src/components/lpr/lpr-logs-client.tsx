"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import gsap from "gsap";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { Search, RefreshCw, Camera, CheckCircle, XCircle, AlertCircle } from "lucide-react";
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
        toast.success(`Loaded ${result.entries.length} log entries from ${result.filesRead} file(s)`);
      } else {
        toast.error(result.error || "Failed to load logs");
      }
    } catch (error) {
      toast.error("Failed to fetch logs");
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

  const getStatusBadge = (entry: LogEntry) => {
    if (entry.metadata?.success === false) {
      return (
        <Badge variant="destructive" className="text-[0.5rem] px-1.5 py-0.5">
          <XCircle className="h-2.5 w-2.5 mr-1" />
          ERROR
        </Badge>
      );
    }
    if (entry.metadata?.error) {
      return (
        <Badge variant="destructive" className="text-[0.5rem] px-1.5 py-0.5">
          <AlertCircle className="h-2.5 w-2.5 mr-1" />
          WARNING
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="text-[0.5rem] px-1.5 py-0.5 bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle className="h-2.5 w-2.5 mr-1" />
        SUCCESS
      </Badge>
    );
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title="LPR CAMERA LOGS"
        subtitle="View all incoming messages from LPR cameras"
      />

      {/* Controls */}
      <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search by event, device, plate, IP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-[9px]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-7 px-2 text-[9px] rounded-md border border-input bg-background"
              >
                <option value={100}>Last 100</option>
                <option value={500}>Last 500</option>
                <option value={1000}>Last 1000</option>
                <option value={5000}>Last 5000</option>
              </select>
              <Button
                onClick={fetchLogs}
                disabled={loading}
                size="sm"
                className="h-7 px-3 text-[10px] gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                REFRESH
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Total Logs</div>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
          </CardContent>
        </Card>
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Successful</div>
            <div className="text-2xl font-bold text-green-600">
              {filteredLogs.filter((l) => l.metadata?.success !== false).length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-600">
              {filteredLogs.filter((l) => l.metadata?.success === false || l.metadata?.error).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs List */}
      {loading ? (
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading logs...</p>
          </CardContent>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search ? "No logs match your search." : "No logs found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((entry, index) => (
            <Card
              key={`${entry.receivedAt}-${index}`}
              className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm"
            >
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={`log-${index}`} className="border-0">
                  <AccordionTrigger className="hover:no-underline px-4 py-3">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getStatusBadge(entry)}
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[0.5rem] px-1.5 py-0.5">
                            {entry.event || "unknown"}
                          </Badge>
                          {entry.device && (
                            <span className="text-[9px] text-muted-foreground truncate">
                              {entry.device}
                            </span>
                          )}
                          {entry.data?.plate && (
                            <span className="text-[9px] font-medium truncate">
                              {entry.data.plate}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.timestamp || entry.receivedAt), "MMM dd, HH:mm:ss")}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 pt-2">
                      {/* Metadata */}
                      {entry.metadata && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold uppercase text-muted-foreground">
                            Metadata
                          </h4>
                          <div className="bg-muted/50 rounded-md p-3 space-y-1.5 text-[9px]">
                            {entry.metadata.ipAddress && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">IP Address:</span>
                                <span className="font-medium">{entry.metadata.ipAddress}</span>
                              </div>
                            )}
                            {entry.metadata.processingTime !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Processing Time:</span>
                                <span className="font-medium">{entry.metadata.processingTime}ms</span>
                              </div>
                            )}
                            {entry.metadata.error && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Error:</span>
                                <span className="font-medium text-red-600">{entry.metadata.error}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Full Message Data */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold uppercase text-muted-foreground">
                          Full Message
                        </h4>
                        <div className="bg-muted/50 rounded-md p-3">
                          <pre className="text-[8px] overflow-x-auto whitespace-pre-wrap break-words font-mono">
                            {JSON.stringify(entry.data, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="text-[9px] text-muted-foreground">
                        Received: {format(new Date(entry.timestamp || entry.receivedAt), "PPpp")}
                      </div>
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
