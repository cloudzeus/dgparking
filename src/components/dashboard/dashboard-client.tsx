"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { Role, LprRecognitionEvent, LprImage, LprCamera } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Car, ArrowUpRight, ArrowDownRight, Clock, TrendingUp, TrendingDown, FileText, FileCheck, User, X, Search, RefreshCw, Loader2, MoreVertical, LogOut, LogIn, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formFieldStyles } from "@/lib/form-styles";
import { BarChart, Bar, LabelList, XAxis } from "recharts";
import { toast } from "sonner";

interface DashboardStats {
  totalVehicles: number;
  totalIn: number;
  totalOut: number;
  contractsIn: number;
  walkIns: number;
  carsInsideNow?: number;
  /** INST (contracts) that have at least one INSTLINES (plate line) — contract-based */
  contractsWithPlates?: number;
}

type RecognitionEventWithRelations = LprRecognitionEvent & {
  camera: Pick<LprCamera, "name"> | null;
  images: (LprImage & { url: string; imageType: string })[];
  durationMinutes?: number | null;
};

/**
 * Deduplicates recognition events by combining events with the same license plate,
 * same direction, and within a time window (10 seconds).
 * Keeps the most recent event from each group.
 */
function deduplicateEvents(events: RecognitionEventWithRelations[]): RecognitionEventWithRelations[] {
  if (events.length === 0) return [];
  
  // Sort by recognition time (most recent first)
  const sorted = [...events].sort((a, b) => {
    const timeA = new Date(a.recognitionTime).getTime();
    const timeB = new Date(b.recognitionTime).getTime();
    return timeB - timeA; // Descending
  });
  
  const deduplicated: RecognitionEventWithRelations[] = [];
  const processed = new Set<string>();
  const TIME_WINDOW_MS = 10 * 1000; // Reduced to 10 seconds - only combine very close duplicates
  
  for (const event of sorted) {
    const eventId = event.id;
    if (processed.has(eventId)) continue;
    
    const plate = (event.licensePlate || "").trim().toUpperCase();
    const direction = event.direction || "UNKNOWN";
    const eventTime = new Date(event.recognitionTime).getTime();
    
    // Find all duplicates (same plate, same direction, within time window)
    const duplicates = sorted.filter((e) => {
      if (processed.has(e.id)) return false;
      const ePlate = (e.licensePlate || "").trim().toUpperCase();
      const eDirection = e.direction || "UNKNOWN";
      const eTime = new Date(e.recognitionTime).getTime();
      const timeDiff = Math.abs(eventTime - eTime);
      
      return (
        ePlate === plate &&
        eDirection === direction &&
        timeDiff <= TIME_WINDOW_MS
      );
    });
    
    // Mark all duplicates as processed
    duplicates.forEach((e) => processed.add(e.id));
    
    // Keep the most recent event (first in sorted array)
    const bestEvent = duplicates[0];
    deduplicated.push(bestEvent);
  }
  
  if (events.length !== deduplicated.length) {
    console.log(`[DASHBOARD-CLIENT] Deduplicated ${events.length} events to ${deduplicated.length} unique events`);
  }
  
  return deduplicated;
}

/** Format elapsed ms as "Xd Xh Xm" or "Xh Xm" or "Xm" for time-in-parking badge */
function formatTimeInParking(entryTime: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(entryTime).getTime());
  const totalMinutes = Math.floor(ms / (60 * 1000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

/** Format duration in minutes as "Xh Ym" or "Xm" for total time in parking (after exit) */
function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Get license plate from event (camelCase or snake_case from API). */
function getPlate(event: { licensePlate?: string | null } & { license_plate?: string }): string {
  const a = event.licensePlate != null ? String(event.licensePlate).trim() : "";
  const b = event.license_plate != null ? String(event.license_plate).trim() : "";
  return a || b;
}

/** Get display license plate from event (camelCase or snake_case from API). */
function getDisplayPlate(event: { licensePlate?: string | null } & { license_plate?: string }): string {
  const plate = getPlate(event);
  return plate || "—";
}

interface ContractInfo {
  num01: number;
  carsIn: number;
  /** "contract" = within NUM01 limit; "visitor" = over limit, pays regular fee */
  slotType?: "contract" | "visitor";
}

interface DashboardClientProps {
  user: {
    id: string;
    email: string;
    role: Role;
    firstName: string | null;
    lastName: string | null;
  };
  stats: DashboardStats;
  recentEvents: RecognitionEventWithRelations[];
  materialLicensePlates: Set<string>;
  platesInItems?: Set<string>;
  contractInfoByPlate?: Record<string, ContractInfo>;
  /** Plates that have at least one IN event (from full history). Used so "NO IN CAPTURED" is only shown when plate truly never had IN. */
  platesWithIn?: string[];
}

export function DashboardClient({ user, stats, recentEvents, materialLicensePlates, platesInItems = new Set(), contractInfoByPlate = {}, platesWithIn: platesWithInProp = [] }: DashboardClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debug: Log material license plates on mount
  useEffect(() => {
    console.log(`[DASHBOARD-CLIENT] Material license plates Set size: ${materialLicensePlates.size}`);
    if (materialLicensePlates.size > 0) {
      const samplePlates = Array.from(materialLicensePlates).slice(0, 5);
      console.log(`[DASHBOARD-CLIENT] Sample material plates:`, samplePlates);
    }
  }, [materialLicensePlates]);
  
  // Safely initialize events with proper validation
  const safeRecentEvents = Array.isArray(recentEvents) ? recentEvents : [];
  const [events, setEvents] = useState<RecognitionEventWithRelations[]>(safeRecentEvents);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPlates, setSelectedPlates] = useState<Set<string>>(new Set());
  const [markingAllAsLeft, setMarkingAllAsLeft] = useState(false);

  /** Set of plates that are still inside (last 2 days, dedupe by plate, latest event IN and no OUT after). */
  const platesStillInsideSet = useMemo(() => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const recent = (events || []).filter((e) => new Date(e.recognitionTime) >= twoDaysAgo);
    const plateToAllEvents = new Map<string, RecognitionEventWithRelations[]>();
    for (const e of recent) {
      const plate = (e.licensePlate || "").trim().toUpperCase();
      if (plate.length < 2) continue;
      if (!plateToAllEvents.has(plate)) plateToAllEvents.set(plate, []);
      plateToAllEvents.get(plate)!.push(e);
    }
    const stillInside = new Set<string>();
    for (const [, allEvs] of plateToAllEvents) {
      const sorted = [...allEvs].sort((a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime());
      const latest = sorted[0];
      const isStillInside = latest?.direction === "IN" && !sorted.some((e) => e.direction === "OUT" && new Date(e.recognitionTime).getTime() > new Date(latest.recognitionTime).getTime());
      if (isStillInside && latest) {
        const plate = (latest.licensePlate || "").trim().toUpperCase();
        if (plate.length >= 2) stillInside.add(plate);
      }
    }
    return stillInside;
  }, [events]);
  
  // Debug: Log events on mount
  useEffect(() => {
    console.log(`[DASHBOARD-CLIENT] Initial events count: ${safeRecentEvents.length}`);
    console.log(`[DASHBOARD-CLIENT] Events state count: ${events.length}`);
    if (safeRecentEvents.length > 0) {
      const inCount = safeRecentEvents.filter(e => e.direction === "IN").length;
      const outCount = safeRecentEvents.filter(e => e.direction === "OUT").length;
      console.log(`[DASHBOARD-CLIENT] Initial breakdown - IN: ${inCount}, OUT: ${outCount}`);
    }
  }, []);
  const [hourlyStats, setHourlyStats] = useState<Array<{
    hour: string;
    hourNum: number;
    total: number;
    in: number;
    out: number;
    contractsIn: number;
    walkIns: number;
  }>>([]);
  const [loadingHourlyStats, setLoadingHourlyStats] = useState(true);

  // Today's totals from the same data as the charts (07:00–21:00) so card numbers match the chart
  const todayIn = hourlyStats.reduce((s, d) => s + d.in, 0);
  const todayOut = hourlyStats.reduce((s, d) => s + d.out, 0);
  const todayTotal = hourlyStats.reduce((s, d) => s + d.total, 0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(() => {
    // Initialize with the most recent event's time, or current time
    try {
      if (safeRecentEvents && safeRecentEvents.length > 0 && safeRecentEvents[0]?.recognitionTime) {
        const time = new Date(safeRecentEvents[0].recognitionTime);
        if (!isNaN(time.getTime())) {
          return time;
        }
      }
    } catch (error) {
      console.error("[DASHBOARD] Error initializing lastUpdateTime:", error);
    }
    return new Date();
  });
  const [initialEventIds] = useState<Set<string>>(() => {
    // Track initial event IDs to identify new ones
    try {
      return new Set(safeRecentEvents.filter(e => e && e.id).map(e => e.id));
    } catch (error) {
      console.error("[DASHBOARD] Error initializing event IDs:", error);
      return new Set<string>();
    }
  });
  const [platesWithInSet, setPlatesWithInSet] = useState<Set<string>>(() => new Set(platesWithInProp));
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPlatesWithInSet((prev) => {
      const next = new Set(prev);
      for (const plate of platesWithInProp) if (plate?.trim()) next.add(plate.trim().toUpperCase());
      return next;
    });
  }, [platesWithInProp.join(",")]);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  const handleSelectAll = () => {
    if (selectedPlates.size === platesStillInsideSet.size) {
      setSelectedPlates(new Set());
    } else {
      setSelectedPlates(new Set(platesStillInsideSet));
    }
  };

  const handleMarkAllAsLeft = async () => {
    const toMark = [...selectedPlates].filter((p) => platesStillInsideSet.has(p));
    if (toMark.length === 0) {
      toast.info("No selected cards that are still inside.");
      return;
    }
    setMarkingAllAsLeft(true);
    const now = new Date();
    let done = 0;
    for (const plate of toMark) {
      try {
        await handleMarkAsLeft(plate, now);
        done++;
      } catch {
        // toast per plate is handled in handleMarkAsLeft
      }
    }
    setSelectedPlates(new Set());
    setMarkingAllAsLeft(false);
    if (done > 0) toast.success(`Marked ${done} vehicle${done !== 1 ? "s" : ""} as left`);
  };

  /** Mark vehicle as left at a given time (manual OUT). */
  const handleMarkAsLeft = async (licensePlate: string, leftAt: Date) => {
    try {
      const res = await fetch("/api/dashboard/manual-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licensePlate: licensePlate.trim(),
          recognitionTime: leftAt.toISOString(),
        }),
      });
      const data = await res.json();
      if (!data.success || !data.event) {
        toast.error(data.error || "Failed to record");
        return;
      }
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const plateUpper = licensePlate.trim().toUpperCase();
      setEvents((prev) => {
        const newEvent = data.event as RecognitionEventWithRelations;
        const prevIn = prev.find(
          (e) => (e.licensePlate || "").trim().toUpperCase() === plateUpper && e.direction === "IN"
        );
        const outTime = new Date(newEvent.recognitionTime).getTime();
        const durationMinutes =
          prevIn != null
            ? Math.round((outTime - new Date(prevIn.recognitionTime).getTime()) / (60 * 1000))
            : null;
        const eventWithDuration = { ...newEvent, durationMinutes };
        const combined = [eventWithDuration, ...prev].filter(
          (e) => new Date(e.recognitionTime) >= twoDaysAgo
        );
        const byPlate = new Map<string, RecognitionEventWithRelations>();
        for (const e of combined) {
          const plate = (e.licensePlate || "").trim().toUpperCase();
          if (plate.length < 2) continue;
          const existing = byPlate.get(plate);
          if (!existing || new Date(e.recognitionTime).getTime() > new Date(existing.recognitionTime).getTime()) {
            byPlate.set(plate, e);
          }
        }
        return Array.from(byPlate.values()).sort(
          (a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime()
        );
      });
      toast.success("Vehicle marked as left");
    } catch (e) {
      toast.error("Failed to record");
    }
  };

  /** Reevaluate: update an event's license plate (read message again, correct plate). */
  const handleReevaluate = async (eventId: string, newLicensePlate: string) => {
    const plate = newLicensePlate.trim();
    if (plate.length < 2) {
      toast.error("License plate must be at least 2 characters");
      return;
    }
    try {
      const res = await fetch(`/api/dashboard/recognition-event/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licensePlate: plate }),
      });
      const data = await res.json();
      if (!data.success || !data.event) {
        toast.error(data.error || "Failed to update plate");
        return;
      }
      const updated = data.event as RecognitionEventWithRelations;
      setEvents((prev) => {
        const idx = prev.findIndex((e) => e.id === eventId);
        if (idx < 0) return prev;
        const existing = prev[idx];
        const merged: RecognitionEventWithRelations = {
          ...updated,
          images: Array.isArray(updated.images) && updated.images.length > 0 ? updated.images : (existing.images ?? []),
        };
        const next = [...prev];
        next[idx] = merged;
        return next;
      });
      toast.success("License plate updated");
    } catch (e) {
      toast.error("Failed to update plate");
    }
  };

  /** Manual refresh: fetch all recent events and update status so we know which cars are inside. */
  const refreshStatus = async () => {
    setRefreshingStatus(true);
    try {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const response = await fetch(
        `/api/dashboard/new-events?since=${encodeURIComponent(twoDaysAgo.toISOString())}&limit=100`
      );
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (!data?.success || !Array.isArray(data.events)) return;

      setEvents((prev) => {
        const combined = [
          ...(data.events as RecognitionEventWithRelations[]).filter((e) => new Date(e.recognitionTime) >= twoDaysAgo),
          ...prev.filter((e) => new Date(e.recognitionTime) >= twoDaysAgo),
        ];
        const byPlate = new Map<string, RecognitionEventWithRelations>();
        for (const e of combined) {
          const plate = (e.licensePlate || "").trim().toUpperCase();
          if (plate.length < 2) continue;
          const existing = byPlate.get(plate);
          if (!existing || new Date(e.recognitionTime).getTime() > new Date(existing.recognitionTime).getTime()) {
            byPlate.set(plate, e);
          }
        }
        return Array.from(byPlate.values()).sort(
          (a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime()
        );
      });
      const newest = (data.events as RecognitionEventWithRelations[]).sort(
        (a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime()
      )[0];
      if (newest?.recognitionTime) {
        const t = new Date(newest.recognitionTime);
        if (!isNaN(t.getTime())) setLastUpdateTime(t);
      }
    } catch (error) {
      console.warn("[DASHBOARD] Refresh status failed:", error);
    } finally {
      setRefreshingStatus(false);
    }
  };

  /** Live count of cars currently inside (from current events state). */
  const liveCarsInsideCount = useMemo(() => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const recent = (events || []).filter((e) => new Date(e.recognitionTime) >= twoDaysAgo);
    const plateToAllEvents = new Map<string, RecognitionEventWithRelations[]>();
    for (const e of recent) {
      const plate = (e.licensePlate || "").trim().toUpperCase();
      if (plate.length < 2) continue;
      if (!plateToAllEvents.has(plate)) plateToAllEvents.set(plate, []);
      plateToAllEvents.get(plate)!.push(e);
    }
    let count = 0;
    for (const [, allEvs] of plateToAllEvents) {
      const sorted = [...allEvs].sort((a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime());
      const latest = sorted[0];
      const isStillInside = latest?.direction === "IN" && !sorted.some(
        (e) => e.direction === "OUT" && new Date(e.recognitionTime).getTime() > new Date(latest.recognitionTime).getTime()
      );
      if (isStillInside) count++;
    }
    return count;
  }, [events]);

  // Fetch hourly statistics
  useEffect(() => {
    const fetchHourlyStats = async () => {
      try {
        setLoadingHourlyStats(true);
        const response = await fetch("/api/dashboard/hourly-stats");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setHourlyStats(data.data);
          }
        }
      } catch (error) {
        console.error("[DASHBOARD] Error fetching hourly stats:", error);
      } finally {
        setLoadingHourlyStats(false);
      }
    };

    fetchHourlyStats();
    // Refresh hourly stats every 5 minutes
    const interval = setInterval(fetchHourlyStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll for new events every 5 seconds
  useEffect(() => {
    const pollForNewEvents = async () => {
      // Don't poll if page is hidden (saves resources)
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

      try {
        const since = lastUpdateTime.toISOString();
        const response = await fetch(`/api/dashboard/new-events?since=${encodeURIComponent(since)}&limit=10`);
        
        if (!response.ok) {
          const msg = await response.text().catch(() => response.statusText);
          console.warn("[DASHBOARD] Poll new-events non-OK:", response.status, msg || response.statusText);
          return;
        }

        const data = await response.json().catch(() => null);
        if (!data) return;
        
        if (data.success && data.events && Array.isArray(data.events) && data.events.length > 0) {
          console.log(`[DASHBOARD] Found ${data.events.length} new event(s)`);
          
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            let newEvents = data.events.filter((e: RecognitionEventWithRelations) => {
              return e && e.id && !existingIds.has(e.id);
            });
            newEvents = newEvents.filter((e: RecognitionEventWithRelations) => new Date(e.recognitionTime) >= twoDaysAgo);
            
            if (newEvents.length > 0) {
              console.log(`[DASHBOARD] Adding ${newEvents.length} new event(s) to dashboard`);
              setPlatesWithInSet((prev) => {
                const next = new Set(prev);
                for (const e of newEvents) {
                  if (e.direction === "IN") {
                    const plate = (e.licensePlate || "").trim().toUpperCase();
                    if (plate.length >= 2) next.add(plate);
                  }
                }
                return next;
              });
              const mostRecent = newEvents[0];
              if (mostRecent && mostRecent.recognitionTime) {
                try {
                  const newTime = new Date(mostRecent.recognitionTime);
                  if (!isNaN(newTime.getTime())) {
                    setLastUpdateTime(newTime);
                  }
                } catch (timeError) {
                  console.error("[DASHBOARD] Error parsing recognition time:", timeError);
                }
              }
              const combined = [...newEvents, ...prev].filter((e) => new Date(e.recognitionTime) >= twoDaysAgo);
              // One card per license plate: if plate was IN and same plate goes OUT, update that card to OUT (don't add a new card)
              const byPlate = new Map<string, RecognitionEventWithRelations>();
              for (const e of combined) {
                const plate = (e.licensePlate || "").trim().toUpperCase();
                if (plate.length < 2) continue; // same validity as server/display
                const existing = byPlate.get(plate);
                if (!existing || new Date(e.recognitionTime).getTime() > new Date(existing.recognitionTime).getTime()) {
                  byPlate.set(plate, e);
                }
              }
              return Array.from(byPlate.values()).sort(
                (a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime()
              );
            }
            return prev;
          });
        }
      } catch (error) {
        console.warn("[DASHBOARD] Poll new-events failed:", error);
      }
    };

    // Poll immediately, then every 5 seconds
    pollForNewEvents();
    pollingIntervalRef.current = setInterval(pollForNewEvents, 5000);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [lastUpdateTime]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".stat-card",
        { opacity: 0, y: 20, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          stagger: 0.1,
          ease: "power3.out",
        }
      );
    }, el);
    return () => ctx.revert();
  }, []);

  const getRoleGreeting = () => {
    switch (user.role) {
      case "ADMIN":
        return "ADMINISTRATOR DASHBOARD";
      case "MANAGER":
        return "MANAGER DASHBOARD";
      case "EMPLOYEE":
        return "EMPLOYEE DASHBOARD";
      case "CLIENT":
        return "CLIENT DASHBOARD";
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title={`WELCOME BACK ${user.firstName || user.email?.split('@')[0]}`}
        highlight={user.firstName || user.email?.split('@')[0] || ""}
        subtitle={`${getRoleGreeting()}. Here's your overview.`}
      />

      {/* Row 1: Total Vehicles, Total In, Total Out */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative px-6 pt-6">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              TOTAL VEHICLES
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <Car className="h-3.5 w-3.5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative px-6 pb-4 pt-0 space-y-1">
            <div className="text-2xl font-bold">
              {hourlyStats.length > 0 ? todayTotal : stats.totalVehicles}
            </div>
            {hourlyStats.length > 0 && (
              <ChartContainer
                config={{
                  in: { label: "IN (per 30 min)", color: "hsl(262 83% 58%)" },
                } satisfies ChartConfig}
                className="h-[140px] w-full -mx-1"
              >
                <BarChart data={hourlyStats} margin={{ top: 4, right: 4, left: 4, bottom: 24 }}>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <XAxis dataKey="hour" tick={{ fontSize: 6 }} angle={-45} textAnchor="end" height={28} interval={2} />
                  <Bar dataKey="in" fill="hsl(262 83% 58%)" radius={4}>
                    <LabelList position="top" offset={6} className="fill-foreground" fontSize={8} formatter={(value: number) => value > 0 ? value : ""} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {hourlyStats.length > 0 ? "IN per 30 min (e.g. 07:00 = 07:00–07:30)" : "All vehicles detected"}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative px-6 pt-6">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              TOTAL IN
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
              <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative px-6 pb-4 pt-0 space-y-1">
            <div className="text-2xl font-bold">
              {hourlyStats.length > 0 ? todayIn : stats.totalIn}
            </div>
            {hourlyStats.length > 0 && (
              <ChartContainer
                config={{
                  in: { label: "Vehicles in", color: "hsl(142 76% 36%)" },
                } satisfies ChartConfig}
                className="h-[140px] w-full -mx-1"
              >
                <BarChart data={hourlyStats} margin={{ top: 4, right: 4, left: 4, bottom: 24 }}>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <XAxis dataKey="hour" tick={{ fontSize: 6 }} angle={-45} textAnchor="end" height={28} interval={2} />
                  <Bar dataKey="in" fill="hsl(142 76% 36%)" radius={4}>
                    <LabelList position="top" offset={6} className="fill-foreground" fontSize={8} formatter={(value: number) => value > 0 ? value : ""} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {hourlyStats.length > 0 ? "Today 07:00–21:00" : "Vehicles entering"}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-destructive/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative px-6 pt-6">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              TOTAL OUT
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/20">
              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent className="relative px-6 pb-4 pt-0 space-y-1">
            <div className="text-2xl font-bold">
              {hourlyStats.length > 0 ? todayOut : stats.totalOut}
            </div>
            {hourlyStats.length > 0 && (
              <ChartContainer
                config={{
                  out: { label: "Vehicles out", color: "hsl(0 84% 60%)" },
                } satisfies ChartConfig}
                className="h-[140px] w-full -mx-1"
              >
                <BarChart data={hourlyStats} margin={{ top: 4, right: 4, left: 4, bottom: 24 }}>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <XAxis dataKey="hour" tick={{ fontSize: 6 }} angle={-45} textAnchor="end" height={28} interval={2} />
                  <Bar dataKey="out" fill="hsl(0 84% 60%)" radius={4}>
                    <LabelList position="top" offset={6} className="fill-foreground" fontSize={8} formatter={(value: number) => value > 0 ? value : ""} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {hourlyStats.length > 0 ? "Today 07:00–21:00" : "Vehicles exiting"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Cars Inside Now, Contracts In, Contracts (with plates), Walk Ins — compact */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 px-4 py-3">
          <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-[10px] font-medium uppercase text-muted-foreground shrink-0">
              CARS INSIDE NOW
            </CardTitle>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20">
              <Car className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold">{stats.carsInsideNow ?? 0}</span>
            <span className="text-[10px] text-muted-foreground">in parking</span>
          </div>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 px-4 py-3">
          <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-[10px] font-medium uppercase text-muted-foreground shrink-0">
              CONTRACTS IN
            </CardTitle>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold">{stats.contractsIn}</span>
            <span className="text-[10px] text-muted-foreground">contract vehicles</span>
          </div>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 px-4 py-3">
          <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-[10px] font-medium uppercase text-muted-foreground shrink-0">
              CONTRACTS (WITH PLATES)
            </CardTitle>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20">
              <FileCheck className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold">{stats.contractsWithPlates ?? 0}</span>
            <span className="text-[10px] text-muted-foreground">have plate lines</span>
          </div>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 px-4 py-3">
          <div className="absolute inset-0 bg-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-[10px] font-medium uppercase text-muted-foreground shrink-0">
              WALK INS
            </CardTitle>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold">{stats.walkIns}</span>
            <span className="text-[10px] text-muted-foreground">visitor vehicles</span>
          </div>
        </Card>
      </div>

      {/* Live status — most important: clear view of who's inside */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live updates active" aria-hidden />
              Live status — who&apos;s inside
            </h2>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Last updated {format(lastUpdateTime, "HH:mm:ss")} · <strong>{liveCarsInsideCount}</strong> cars inside now. One card per plate; status updates when a car goes OUT.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshStatus}
            disabled={refreshingStatus}
            className="h-8 gap-1.5 text-xs shrink-0"
          >
            {refreshingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {refreshingStatus ? "Checking…" : "Check status"}
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by license plate, direction (IN/OUT), vehicle type, or camera..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-xs h-8"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8 gap-1.5 text-xs"
              >
                <span
                  role="img"
                  aria-hidden
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input dark:bg-input/30 ${
                    platesStillInsideSet.size > 0 && selectedPlates.size === platesStillInsideSet.size
                      ? "bg-primary border-primary text-primary-foreground"
                      : ""
                  }`}
                >
                  {platesStillInsideSet.size > 0 && selectedPlates.size === platesStillInsideSet.size ? (
                    <Check className="h-2.5 w-2.5" />
                  ) : null}
                </span>
                {selectedPlates.size === platesStillInsideSet.size && platesStillInsideSet.size > 0 ? "Deselect all" : "Select all"}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleMarkAllAsLeft}
                disabled={markingAllAsLeft || selectedPlates.size === 0 || [...selectedPlates].filter((p) => platesStillInsideSet.has(p)).length === 0}
                className="h-8 gap-1.5 text-xs"
              >
                {markingAllAsLeft ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                )}
                Mark all as left ({[...selectedPlates].filter((p) => platesStillInsideSet.has(p)).length})
              </Button>
            </div>
          </div>
          {searchQuery.trim() && (
            <p className="text-xs text-muted-foreground">
              {(() => {
                const filteredCount = events && Array.isArray(events) ? events.filter((event) => {
                  const query = searchQuery.trim().toUpperCase();
                  const plate = getPlate(event).toUpperCase();
                  const direction = (event.direction || "").toUpperCase();
                  const vehicleType = (event.vehicleType || "").toUpperCase();
                  const vehicleBrand = (event.vehicleBrand || "").toUpperCase();
                  const vehicleColor = (event.vehicleColor || "").toUpperCase();
                  const cameraName = (event.camera?.name || "").toUpperCase();
                  
                  return (
                    plate.includes(query) ||
                    direction.includes(query) ||
                    vehicleType.includes(query) ||
                    vehicleBrand.includes(query) ||
                    vehicleColor.includes(query) ||
                    cameraName.includes(query)
                  );
                }).length : 0;
                return `Showing ${filteredCount} of ${events.length} events`;
              })()}
            </p>
          )}
        </div>
      </div>

      {/* LPR Recognition Events */}
      <div className="space-y-4">
        {(() => {
          // Only show events from the last 2 days
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          const lastTwoDaysEvents = events && Array.isArray(events)
            ? events.filter((e) => new Date(e.recognitionTime) >= twoDaysAgo)
            : [];
          // Filter by search query
          const searchFiltered = lastTwoDaysEvents.filter((event) => {
            if (!searchQuery.trim()) return true;
            
            const query = searchQuery.trim().toUpperCase();
            const plate = getPlate(event).toUpperCase();
            const direction = (event.direction || "").toUpperCase();
            const vehicleType = (event.vehicleType || "").toUpperCase();
            const vehicleBrand = (event.vehicleBrand || "").toUpperCase();
            const vehicleColor = (event.vehicleColor || "").toUpperCase();
            const cameraName = (event.camera?.name || "").toUpperCase();
            
            return (
              plate.includes(query) ||
              direction.includes(query) ||
              vehicleType.includes(query) ||
              vehicleBrand.includes(query) ||
              vehicleColor.includes(query) ||
              cameraName.includes(query)
            );
          });

          // Only consider valid license plates (>= 2 chars; use both camelCase and snake_case)
          const validPlateEvents = searchFiltered.filter((e) => getPlate(e).toUpperCase().length >= 2);
          // Deduplicate by license plate: keep only the most recent event per plate
          const plateToLatest = new Map<string, RecognitionEventWithRelations>();
          // Also track all events per plate to check if car is still inside
          const plateToAllEvents = new Map<string, RecognitionEventWithRelations[]>();
          for (const event of validPlateEvents) {
            const plate = getPlate(event).toUpperCase();
            const existing = plateToLatest.get(plate);
            const eventTime = new Date(event.recognitionTime).getTime();
            if (!existing || new Date(existing.recognitionTime).getTime() < eventTime) {
              plateToLatest.set(plate, event);
            }
            if (!plateToAllEvents.has(plate)) {
              plateToAllEvents.set(plate, []);
            }
            plateToAllEvents.get(plate)!.push(event);
          }
          // Use server-derived + poll-updated set: plates that have at least one IN (so "NO IN" only when truly no IN)
          
          // Calculate which cars are still inside before sorting
          const plateToStillInside = new Map<string, boolean>();
          for (const [plate, allEvents] of plateToAllEvents.entries()) {
            const sortedEvents = [...allEvents].sort(
              (a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime()
            );
            const latestEvent = sortedEvents[0];
            const isStillInside = latestEvent && latestEvent.direction === "IN" && 
              !sortedEvents.some(e => 
                e.direction === "OUT" && 
                new Date(e.recognitionTime).getTime() > new Date(latestEvent.recognitionTime).getTime()
              );
            plateToStillInside.set(plate, isStillInside || false);
          }

          // Exclude cars that left (OUT) on a past date — show only OUT from same date (today)
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          const latestValues = Array.from(plateToLatest.values());
          const sameDateOrStillInside = latestValues.filter((event) => {
            const plate = getPlate(event).toUpperCase();
            const isStillInside = plateToStillInside.get(plate) || false;
            if (isStillInside) return true;
            const t = new Date(event.recognitionTime).getTime();
            return t >= startOfToday.getTime() && t <= endOfToday.getTime();
          });
          
          // Sort: still inside first, then plates with IN (by time), then OUT-only at bottom (by time)
          const filteredEvents = sameDateOrStillInside.sort((a, b) => {
            const plateA = getPlate(a).toUpperCase();
            const plateB = getPlate(b).toUpperCase();
            const stillInsideA = plateToStillInside.get(plateA) || false;
            const stillInsideB = plateToStillInside.get(plateB) || false;
            const outOnlyA = !platesWithInSet.has(plateA);
            const outOnlyB = !platesWithInSet.has(plateB);
            
            // First priority: still inside cars come first
            if (stillInsideA && !stillInsideB) return -1;
            if (!stillInsideA && stillInsideB) return 1;
            // Second priority: OUT-only (no IN) go to bottom
            if (!outOnlyA && outOnlyB) return -1;
            if (outOnlyA && !outOnlyB) return 1;
            // Third: by recognition time (newest first)
            return new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime();
          });

          return filteredEvents.length > 0 ? (
          <div 
            className="grid gap-4" 
            style={{ 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              width: '100%'
            }}
          >
            {(() => {
              return filteredEvents.map((event) => {
              if (!event || !event.id) return null;
              // Check if license plate exists in materials (use both camelCase and snake_case)
              const normalizedPlate = getPlate(event).toUpperCase();
              const isInContract = normalizedPlate.length > 0 && materialLicensePlates.has(normalizedPlate);
              const eventDate = new Date(event.recognitionTime);
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);
              const isFromPastDate = eventDate < startOfToday;
              
              // Check if car is still inside (already calculated above)
              const isStillInside = plateToStillInside.get(normalizedPlate) || false;
              
              // Debug logging for material matching
              if (normalizedPlate.length > 0 && materialLicensePlates.size > 0) {
                const isMatch = materialLicensePlates.has(normalizedPlate);
                if (isMatch) {
                  console.log(`[DASHBOARD] ✅ License plate "${normalizedPlate}" found in contracts`);
                } else if (events.indexOf(event) < 3) {
                  // Only log first 3 events to avoid spam
                  console.log(`[DASHBOARD] ❌ License plate "${normalizedPlate}" NOT found in contracts. Total contracts: ${materialLicensePlates.size}`);
                }
              }
              
              const contractInfo = contractInfoByPlate[normalizedPlate];
              const contractNum01 = contractInfo?.num01 ?? 0;
              const contractCarsIn = contractInfo?.carsIn ?? 0;
              const slotType = contractInfo?.slotType;
              const isExceeded = isInContract && isStillInside && contractNum01 > 0 && contractCarsIn > contractNum01;
              const isVisitorOverLimit = slotType === "visitor";
              const isInItems = normalizedPlate.length > 0 && platesInItems.has(normalizedPlate);
              const isOutOnly = !platesWithInSet.has(normalizedPlate);

              // When vehicle has left (OUT), find the time they came in (matching IN before this OUT)
              let entryTime: Date | null = null;
              if (!isStillInside && event.direction === "OUT") {
                const allEvs = plateToAllEvents.get(normalizedPlate) ?? [];
                const inBeforeOut = allEvs
                  .filter((e) => e.direction === "IN" && new Date(e.recognitionTime).getTime() < new Date(event.recognitionTime).getTime())
                  .sort((a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime());
                if (inBeforeOut.length > 0) entryTime = new Date(inBeforeOut[0].recognitionTime);
              }

              return (
                <RecognitionEventCard 
                  key={normalizedPlate ? `plate-${normalizedPlate}` : `event-${event.id}`}
                  event={event} 
                  isNew={!initialEventIds.has(event.id)}
                  isInContract={isInContract}
                  isInItems={isInItems}
                  isFromPastDate={isFromPastDate}
                  isStillInside={isStillInside || false}
                  isOutOnly={isOutOnly}
                  entryTime={entryTime}
                  contractNum01={contractNum01}
                  contractCarsIn={contractCarsIn}
                  isExceeded={isExceeded}
                  isVisitorOverLimit={isVisitorOverLimit}
                  isSelected={selectedPlates.has(normalizedPlate)}
                  onToggleSelect={() => {
                    setSelectedPlates((prev) => {
                      const next = new Set(prev);
                      if (next.has(normalizedPlate)) next.delete(normalizedPlate);
                      else next.add(normalizedPlate);
                      return next;
                    });
                  }}
                  onMarkAsLeft={handleMarkAsLeft}
                  onReevaluate={handleReevaluate}
                />
              );
            });
            })()}
          </div>
          ) : (
            <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6 text-center space-y-4">
                <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium">
                    {searchQuery.trim() ? "No events found" : "No recognition events yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {searchQuery.trim() 
                      ? `No events match your search: "${searchQuery}". Try a different search term.`
                      : "Events will appear here once cameras start sending data with license plates."
                    }
                  </p>
                </div>
                {!searchQuery.trim() && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-muted-foreground/20 text-left">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Troubleshooting:</p>
                    <ul className="text-[9px] text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Check if cameras are registered in <strong>LPR Cameras</strong> page</li>
                      <li>Verify camera name/device ID matches webhook payload</li>
                      <li>Check <strong>LPR Logs</strong> page for incoming events</li>
                      <li>Ensure events contain license plate data</li>
                      <li>Check server console logs for detailed error messages</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

function RecognitionEventCard({ event, isNew = false, isInContract = false, isInItems = false, isFromPastDate = false, isStillInside = false, isOutOnly = false, entryTime = null, contractNum01 = 0, contractCarsIn = 0, isExceeded = false, isVisitorOverLimit = false, isSelected = false, onToggleSelect, onMarkAsLeft, onReevaluate }: { event: RecognitionEventWithRelations; isNew?: boolean; isInContract?: boolean; isInItems?: boolean; isFromPastDate?: boolean; isStillInside?: boolean; isOutOnly?: boolean; entryTime?: Date | null; contractNum01?: number; contractCarsIn?: number; isExceeded?: boolean; /** true when car is inside but over contract limit → pays regular visitor fee */ isVisitorOverLimit?: boolean; isSelected?: boolean; onToggleSelect?: () => void; onMarkAsLeft?: (licensePlate: string, leftAt: Date) => Promise<void>; onReevaluate?: (eventId: string, newLicensePlate: string) => Promise<void> }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isLeftModalOpen, setIsLeftModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isReevaluateModalOpen, setIsReevaluateModalOpen] = useState(false);
  const [reevaluatePlate, setReevaluatePlate] = useState("");
  const [savingReevaluate, setSavingReevaluate] = useState(false);
  const [leftAt, setLeftAt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [savingLeft, setSavingLeft] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => setMounted(true), []);

  // Live-updating time for "time in parking" badge (cars still inside)
  useEffect(() => {
    if (!isStillInside) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isStillInside]);

  // Get any available image for avatar (prioritize: plate_image, full_image, snapshot)
  const avatarImage = event.images.find(img => 
    img.imageType === "PLATE_IMAGE" || img.imageType === "FULL_IMAGE" || img.imageType === "SNAPSHOT"
  ) || event.images[0];
  const imageUrl = avatarImage?.url;
  
  // Get full image or snapshot for modal (only FULL_IMAGE or SNAPSHOT, no fallback to other types)
  const fullImage = event.images.find(img => img.imageType === "FULL_IMAGE") || event.images.find(img => img.imageType === "SNAPSHOT");
  const fullImageUrl = fullImage?.url;
  
  // Direction enum values are: IN, OUT, UNKNOWN (not APPROACH/AWAY) — use theme primary/destructive
  const DirectionIcon = event.direction === "IN" ? ArrowUpRight : event.direction === "OUT" ? ArrowDownRight : null;
  const directionColor = event.direction === "IN" ? "text-primary" : event.direction === "OUT" ? "text-destructive" : "text-muted-foreground";
  const directionBgColor = event.direction === "IN" ? "bg-primary/10 border-primary/20" : event.direction === "OUT" ? "bg-destructive/10 border-destructive/20" : "";

  useEffect(() => {
    if (cardRef.current) {
      if (isNew) {
        // New events get a special animation
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, y: -20, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" }
        );
        // Remove the new marker after animation
        setTimeout(() => {
          if (cardRef.current) {
            cardRef.current.removeAttribute("data-new-event");
          }
        }, 500);
      } else {
        // Existing events get normal animation
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
        );
      }
    }
  }, [isNew]);

  // Card state: 4 pastel backgrounds (lavender, lemon yellow for contract, pastel yellow/amber, sky blue)
  // 1) Visitor over limit → pastel yellow (amber)  2) On contract → lemon yellow  3) Past date still in → sky blue  4) Inside → lavender  5) Car left / Past date → sky blue
  const cardBgClass = isVisitorOverLimit
    ? "bg-amber-50/95 dark:bg-amber-900/25 border border-amber-200/60 dark:border-amber-800/50"
    : isInContract && !isVisitorOverLimit
      ? "bg-yellow-100/95 dark:bg-yellow-900/25 border border-yellow-300/60 dark:border-yellow-700/50"
      : isFromPastDate && isStillInside
        ? "bg-sky-100/90 dark:bg-sky-900/25 border border-sky-200/60 dark:border-sky-800/50"
        : isStillInside
          ? "bg-violet-100/90 dark:bg-violet-900/25 border border-violet-200/60 dark:border-violet-800/50"
          : !isStillInside && (event.direction === "OUT" || isOutOnly)
            ? "bg-sky-100/90 dark:bg-sky-900/25 border border-sky-200/60 dark:border-sky-800/50"
            : isFromPastDate
              ? "bg-sky-100/80 dark:bg-sky-900/20 border border-sky-200/50 dark:border-sky-800/40"
              : "bg-card border border-border";

  // State description (palette-style: keywords + "Often used" + explanation)
  const stateLabel = isVisitorOverLimit
    ? { keywords: "Over limit · Visitor fee · Attention", usedFor: "Contract slots full — this car pays regular visitor rate." }
    : isInContract && !isVisitorOverLimit
      ? { keywords: "Contract · Within limit · Authorized", usedFor: "Counts toward contract allowance (included)." }
      : isFromPastDate && isStillInside
        ? { keywords: "Past date · Still inside · Older entry", usedFor: "Entered on a previous day, still in parking." }
        : isStillInside
          ? { keywords: "Inside · Active · Present", usedFor: "Vehicle currently in parking." }
          : !isStillInside && (event.direction === "OUT" || isOutOnly)
            ? { keywords: "Departed · Left · Completed", usedFor: "Vehicle has left the parking." }
            : isFromPastDate
              ? { keywords: "Past · Archived", usedFor: "Event from a previous day." }
              : { keywords: "—", usedFor: "—" };

  return (
    <Card
      ref={cardRef}
      data-new-event={isNew ? "true" : undefined}
      className={`group relative overflow-hidden border-0 card-shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 bg-transparent ${isNew ? "ring-2 ring-primary/50" : ""}`}
      style={{ minWidth: '300px' }}
    >
      {/* Full card background (solid color by state) */}
      <div className={`absolute inset-0 rounded-xl ${cardBgClass}`} />
      <div className="absolute inset-0 rounded-xl bg-white/10 dark:bg-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
      
      <CardContent className="relative p-4 z-10">
        <div className="flex flex-col gap-3">
          {/* License Plate Row with Image - 35px height, 90px width */}
          <div className="flex items-center gap-2">
            {isStillInside && onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="shrink-0 h-4 w-4"
                aria-label={isSelected ? "Deselect card" : "Select card"}
              />
            )}
            {/* License Plate Image */}
            <div className="relative flex-shrink-0">
              {imageUrl ? (
                fullImageUrl ? (
                  <>
                    <div 
                      className="relative h-[35px] w-[100px] rounded-md overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors"
                      onClick={() => setIsImageModalOpen(true)}
                      onMouseOver={() => {
                        // Mouseover action can be added here for different behavior
                        // Currently only click opens the modal
                      }}
                    >
                      <Image
                        src={imageUrl}
                        alt={getDisplayPlate(event) || "Vehicle"}
                        fill
                        className="object-cover"
                        sizes="100px"
                      />
                    </div>
                    <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
                      <DialogContent 
                        className="max-w-[1280px] w-full p-0 bg-transparent border-0 shadow-none sm:max-w-[1280px]"
                        showCloseButton={false}
                      >
                        <DialogTitle className="sr-only">
                          {`${fullImage?.imageType === "FULL_IMAGE" ? "Full image" : "Snapshot"} - ${getDisplayPlate(event) || "Vehicle"}`}
                        </DialogTitle>
                        <div className="relative w-full bg-background/95 backdrop-blur-sm rounded-lg overflow-hidden border-2 border-border shadow-2xl">
                          {/* Close Button */}
                          <button
                            onClick={() => setIsImageModalOpen(false)}
                            className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 backdrop-blur-sm border border-border hover:bg-background transition-colors shadow-lg"
                            aria-label="Close"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          {/* Full Image */}
                          <div className="relative w-full max-h-[90vh] overflow-auto">
                            <Image
                              src={fullImageUrl}
                              alt={`${fullImage?.imageType === "FULL_IMAGE" ? "Full image" : "Snapshot"} - ${getDisplayPlate(event) || "Vehicle"}`}
                              width={1280}
                              height={960}
                              className="w-full max-w-[1280px] h-auto object-contain"
                              sizes="1280px"
                            />
                          </div>
                        </div>
                    </DialogContent>
                  </Dialog>
                  </>
                ) : (
                  <div className="relative h-[35px] w-[100px] rounded-md overflow-hidden border border-border">
                    <Image
                      src={imageUrl}
                      alt={getDisplayPlate(event) || "Vehicle"}
                      fill
                      className="object-cover"
                      sizes="100px"
                    />
                  </div>
                )
              ) : (
                <div className="flex h-[35px] w-[100px] items-center justify-center rounded-md bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-border">
                  <Car className="h-4 w-4 text-blue-600" />
                </div>
              )}
            </div>

            {/* Modal: View message — event payload without images (for checks) */}
            <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
              <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <DialogTitle className="text-sm font-bold uppercase text-muted-foreground">
                  View message
                </DialogTitle>
                <p className="text-[9px] text-muted-foreground">
                  Received event data (without image parts) for checks
                </p>
                <div className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3">
                  <pre className="text-[9px] whitespace-pre-wrap break-words font-mono">
                    {(() => {
                      try {
                        const { images: _img, ...rest } = event as RecognitionEventWithRelations & { images?: unknown };
                        const rec = event.recognitionTime ? new Date(event.recognitionTime) : null;
                        const safeFormat = (d: Date | null) => (d && !isNaN(d.getTime()) ? format(d, "yyyy-MM-dd HH:mm:ss") : null);
                        const createdAtVal = (rest as { createdAt?: unknown }).createdAt;
                        const createdAtStr = createdAtVal != null ? safeFormat(new Date(createdAtVal as string | Date)) : null;
                        return JSON.stringify(
                          {
                            id: rest.id,
                            licensePlate: rest.licensePlate,
                            direction: rest.direction,
                            recognitionTime: rec && !isNaN(rec.getTime()) ? rec.toISOString() : String(event.recognitionTime ?? ""),
                            recognitionTimeLocal: safeFormat(rec),
                            vehicleType: rest.vehicleType ?? null,
                            vehicleBrand: rest.vehicleBrand ?? null,
                            vehicleColor: rest.vehicleColor ?? null,
                            plateColor: rest.plateColor ?? null,
                            plateType: rest.plateType ?? null,
                            confidence: rest.confidence ?? null,
                            speed: rest.speed ?? null,
                            region: rest.region ?? null,
                            camera: rest.camera?.name ?? null,
                            durationMinutes: rest.durationMinutes ?? null,
                            coordinateX1: rest.coordinateX1 ?? null,
                            coordinateY1: rest.coordinateY1 ?? null,
                            coordinateX2: rest.coordinateX2 ?? null,
                            coordinateY2: rest.coordinateY2 ?? null,
                            resolutionWidth: rest.resolutionWidth ?? null,
                            resolutionHeight: rest.resolutionHeight ?? null,
                            distance: rest.distance ?? null,
                            azimuth: rest.azimuth ?? null,
                            vehicleCount: rest.vehicleCount ?? null,
                            plateLength: rest.plateLength ?? null,
                            roiId: rest.roiId ?? null,
                            createdAt: createdAtStr,
                          },
                          null,
                          2
                        );
                      } catch (e) {
                        return `Error displaying message: ${e instanceof Error ? e.message : String(e)}`;
                      }
                    })()}
                  </pre>
                </div>
              </DialogContent>
            </Dialog>

            {/* Modal: Set time vehicle left (outside image block to avoid nesting) */}
            {onMarkAsLeft && (
              <Dialog open={isLeftModalOpen} onOpenChange={setIsLeftModalOpen}>
                <DialogContent className="sm:max-w-sm">
                  <DialogTitle className="text-sm font-bold uppercase text-muted-foreground">
                    Set time vehicle left
                  </DialogTitle>
                  <div className={formFieldStyles.formSpacing}>
                    <div className={formFieldStyles.fieldSpacing}>
                      <Label htmlFor={`left-at-${event.id}`} className={formFieldStyles.label}>
                        DATE & TIME
                      </Label>
                      <Input
                        id={`left-at-${event.id}`}
                        type="datetime-local"
                        value={leftAt}
                        onChange={(e) => setLeftAt(e.target.value)}
                        className={formFieldStyles.input}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLeftModalOpen(false)}
                        className={formFieldStyles.button}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingLeft}
                        onClick={async () => {
                          const plate = getPlate(event);
                              if (!plate) return;
                              setSavingLeft(true);
                              try {
                                await onMarkAsLeft(plate, new Date(leftAt));
                            setIsLeftModalOpen(false);
                          } finally {
                            setSavingLeft(false);
                          }
                        }}
                        className={formFieldStyles.button}
                      >
                        {savingLeft ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className={formFieldStyles.buttonIcon} />}
                        {savingLeft ? "Saving…" : "Mark as left"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Modal: Reevaluate — read message again and set/correct license plate */}
            {onReevaluate && (
              <Dialog open={isReevaluateModalOpen} onOpenChange={setIsReevaluateModalOpen}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                  <DialogTitle className="text-sm font-bold uppercase text-muted-foreground">
                    Reevaluate
                  </DialogTitle>
                  <p className="text-[9px] text-muted-foreground">
                    Read the event message again and add or correct the license plate.
                  </p>
                  <div className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3 min-h-[120px]">
                    <pre className="text-[9px] whitespace-pre-wrap break-words font-mono">
                      {(() => {
                        try {
                          const { images: _img, ...rest } = event as RecognitionEventWithRelations & { images?: unknown };
                          const rec = event.recognitionTime ? new Date(event.recognitionTime) : null;
                          const safeFormat = (d: Date | null) => (d && !isNaN(d.getTime()) ? format(d, "yyyy-MM-dd HH:mm:ss") : null);
                          const createdAtVal = (rest as { createdAt?: unknown }).createdAt;
                          const createdAtStr = createdAtVal != null ? safeFormat(new Date(createdAtVal as string | Date)) : null;
                          return JSON.stringify(
                            {
                              id: rest.id,
                              licensePlate: rest.licensePlate,
                              direction: rest.direction,
                              recognitionTime: rec && !isNaN(rec.getTime()) ? rec.toISOString() : String(event.recognitionTime ?? ""),
                              recognitionTimeLocal: safeFormat(rec),
                              vehicleType: rest.vehicleType ?? null,
                              vehicleBrand: rest.vehicleBrand ?? null,
                              vehicleColor: rest.vehicleColor ?? null,
                              plateColor: rest.plateColor ?? null,
                              plateType: rest.plateType ?? null,
                              confidence: rest.confidence ?? null,
                              speed: rest.speed ?? null,
                              region: rest.region ?? null,
                              camera: rest.camera?.name ?? null,
                              durationMinutes: rest.durationMinutes ?? null,
                              coordinateX1: rest.coordinateX1 ?? null,
                              coordinateY1: rest.coordinateY1 ?? null,
                              coordinateX2: rest.coordinateX2 ?? null,
                              coordinateY2: rest.coordinateY2 ?? null,
                              resolutionWidth: rest.resolutionWidth ?? null,
                              resolutionHeight: rest.resolutionHeight ?? null,
                              distance: rest.distance ?? null,
                              azimuth: rest.azimuth ?? null,
                              vehicleCount: rest.vehicleCount ?? null,
                              plateLength: rest.plateLength ?? null,
                              roiId: rest.roiId ?? null,
                              createdAt: createdAtStr,
                            },
                            null,
                            2
                          );
                        } catch (e) {
                          return `Error displaying message: ${e instanceof Error ? e.message : String(e)}`;
                        }
                      })()}
                    </pre>
                  </div>
                  <div className={formFieldStyles.fieldSpacing}>
                    <Label htmlFor={`reevaluate-plate-${event.id}`} className={formFieldStyles.label}>
                      LICENSE PLATE
                    </Label>
                    <Input
                      id={`reevaluate-plate-${event.id}`}
                      value={reevaluatePlate}
                      onChange={(e) => setReevaluatePlate(e.target.value)}
                      placeholder="e.g. ABC-1234"
                      className={formFieldStyles.input}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsReevaluateModalOpen(false)}
                      className={formFieldStyles.button}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingReevaluate || reevaluatePlate.trim().length < 2}
                      onClick={async () => {
                        setSavingReevaluate(true);
                        try {
                          await onReevaluate(event.id, reevaluatePlate.trim());
                          setIsReevaluateModalOpen(false);
                        } finally {
                          setSavingReevaluate(false);
                        }
                      }}
                      className={formFieldStyles.button}
                    >
                      {savingReevaluate ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className={formFieldStyles.buttonIcon} />}
                      {savingReevaluate ? "Saving…" : "Save plate"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Two rows: row1 = plate + dropdown, row2 = badges (ERP, direction, contract, INSIDE, etc.) */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {/* Row 1: license plate text + dropdown */}
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase text-foreground truncate min-w-0" title={getDisplayPlate(event)}>
                  {getDisplayPlate(event)}
                </h3>
                <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 rounded-md text-xs"
                  aria-label="Actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setIsMessageModalOpen(true);
                  }}
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  View message
                </DropdownMenuItem>
                {onReevaluate && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setReevaluatePlate(getPlate(event));
                      setIsReevaluateModalOpen(true);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Reevaluate
                  </DropdownMenuItem>
                )}
                {onMarkAsLeft && isStillInside && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setIsLeftModalOpen(true);
                      const d = new Date();
                      setLeftAt(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2" />
                    Left
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
              </div>

              {/* Row 2: ERP, direction icon, contract num01, INSIDE, other badges — text-[9px] bold */}
              <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
              {isInItems && (
                <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5 bg-muted text-muted-foreground border border-border">
                  ERP
                </Badge>
              )}
              {DirectionIcon && (
                <div
                  className={`flex items-center justify-center h-5 w-5 rounded border ${directionBgColor} ${directionColor} flex-shrink-0`}
                  title={event.direction === "IN" ? "Approach (coming in)" : "Away (leaving)"}
                >
                  <DirectionIcon className="h-3 w-3" />
                </div>
              )}
              {isInContract && contractNum01 > 0 && !isVisitorOverLimit && (
                <Badge
                  variant="secondary"
                  className={`text-[9px] font-bold px-1.5 py-0.5 border ${isExceeded ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-primary/15 text-primary border-primary/30"}`}
                >
                  {contractCarsIn}/{contractNum01}
                </Badge>
              )}
              {isInContract && isVisitorOverLimit && (
                <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5 bg-muted text-muted-foreground border border-border">
                  Visitor
                </Badge>
              )}
              {isInContract && contractNum01 === 0 && !isVisitorOverLimit && (
                <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30">
                  CONTRACT
                </Badge>
              )}
              {isStillInside && !isExceeded && (
                <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30">
                  INSIDE
                </Badge>
              )}
              {isExceeded && (
                <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5 bg-destructive/15 text-destructive border border-destructive/30">
                  EXCEEDED
                </Badge>
              )}
              {isOutOnly && (
                <>
                  <Badge
                    variant="secondary"
                    className="text-[9px] font-bold px-1.5 py-0.5 bg-destructive/15 text-destructive border border-destructive/30"
                    title="Abnormal: no IN capture"
                  >
                    NO IN
                  </Badge>
                  <Link href={`/reports/out-without-in?plate=${encodeURIComponent(getPlate(event).toUpperCase())}`} className="text-[9px] font-bold text-primary hover:underline">
                    Report
                  </Link>
                </>
              )}
              </div>
            </div>
          </div>

          {/* State description (palette-style) */}
          <div className="rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-2 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/90">
              {stateLabel.keywords}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-foreground/10 dark:bg-foreground/20 px-2 py-1 text-xs font-bold text-foreground">
                Often used
              </span>
              <span className="text-[10px] text-muted-foreground">
                {stateLabel.usedFor}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1.5">

            {/* Vehicle Details */}
            <div className="space-y-0.5 text-xs">
              {(event.vehicleBrand || event.vehicleType || event.vehicleColor || event.plateColor) ? (
                <>
                  {event.vehicleBrand && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Brand:</span>
                      <span className="font-medium text-foreground">{event.vehicleBrand}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {event.vehicleType && (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-xs font-medium uppercase">
                        {event.vehicleType}
                      </span>
                    )}
                    {event.vehicleColor && (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-xs font-medium">
                        {event.vehicleColor}
                      </span>
                    )}
                    {event.plateColor && (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-xs font-medium">
                        {event.plateColor} Plate
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  Vehicle details not available
                </div>
              )}
            </div>

            {/* Time and Camera — same card: when OUT, show Left at + Came in at */}
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground pt-1 border-t border-border/50">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.direction === "OUT" ? (
                  <span>Left at: {format(new Date(event.recognitionTime), "dd/MM HH:mm:ss")}</span>
                ) : (
                  <span>Recognized at: {format(new Date(event.recognitionTime), "HH:mm:ss")}</span>
                )}
              </div>
              {entryTime && event.direction === "OUT" && (
                <Badge
                  variant="secondary"
                  className="text-xs font-bold px-2 py-1 bg-muted text-muted-foreground border border-border inline-flex items-center gap-1"
                >
                  Came in at: {format(entryTime, "dd/MM HH:mm")}
                </Badge>
              )}
              {isStillInside && (
                <Badge
                  variant="secondary"
                  className="text-xs font-bold px-2 py-1 bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-1.5"
                  suppressHydrationWarning
                >
                  <Clock className="h-3.5 w-3.5" />
                  {mounted ? formatTimeInParking(event.recognitionTime, now) : "—"} in parking
                </Badge>
              )}
              {event.camera?.name && (
                <span className="truncate">{event.camera.name}</span>
              )}
              {event.direction && (
                <span
                  className={`uppercase font-medium ${directionColor}`}
                  title={event.direction === "IN" ? "From camera: Approach = coming in (IN)" : event.direction === "OUT" ? "From camera: Away = leaving (OUT)" : undefined}
                >
                  {event.direction}
                </span>
              )}
              {!isStillInside && event.direction === "OUT" && (() => {
                const totalMinutes =
                  event.durationMinutes != null
                    ? event.durationMinutes
                    : entryTime
                      ? Math.round((new Date(event.recognitionTime).getTime() - new Date(entryTime).getTime()) / (60 * 1000))
                      : null;
                return totalMinutes != null && totalMinutes >= 0 ? (
                  <Badge
                    variant="secondary"
                    className="text-xs font-bold px-2 py-1 bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    Time in parking: {formatDurationMinutes(totalMinutes)}
                  </Badge>
                ) : null;
              })()}
            </div>

            {/* Additional Info — speed only (confidence and region removed) */}
            {(event.speed !== null && event.speed !== undefined) ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Speed: {typeof event.speed === "number" ? `${event.speed} km/h` : event.speed}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

