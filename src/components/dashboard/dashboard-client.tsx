"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Role, LprRecognitionEvent, LprImage, LprCamera } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Car, ArrowUpRight, ArrowDownRight, Clock, TrendingUp, TrendingDown, FileText, FileCheck, User, X, Search } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, LabelList, XAxis } from "recharts";

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
}

export function DashboardClient({ user, stats, recentEvents, materialLicensePlates, platesInItems = new Set(), contractInfoByPlate = {} }: DashboardClientProps) {
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          console.error("[DASHBOARD] Failed to fetch new events:", response.statusText);
          return;
        }

        const data = await response.json();
        
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
              // Deduplicate by plate (keep latest per plate) so state doesn't grow with duplicates
              const byPlate = new Map<string, RecognitionEventWithRelations>();
              for (const e of combined) {
                const plate = (e.licensePlate || "").trim().toUpperCase();
                if (plate.length === 0) continue;
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
        console.error("[DASHBOARD] Error polling for new events:", error);
        // Don't throw - just log the error to prevent breaking the component
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

      {/* Row 1: Total Vehicles, Total In, Total Out — with colored bar charts and tooltips */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-violet-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative px-6 pt-6">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              TOTAL VEHICLES
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20">
              <Car className="h-3.5 w-3.5 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent className="relative px-6 pb-4 pt-0 space-y-1">
            <div className="text-2xl font-bold">
              {hourlyStats.length > 0 ? todayTotal : stats.totalVehicles}
            </div>
            {hourlyStats.length > 0 && (
              <ChartContainer
                config={{
                  total: { label: "Total vehicles", color: "hsl(262 83% 58%)" },
                } satisfies ChartConfig}
                className="h-[140px] w-full -mx-1"
              >
                <BarChart data={hourlyStats} margin={{ top: 4, right: 4, left: 4, bottom: 24 }}>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <XAxis dataKey="hour" tick={{ fontSize: 6 }} angle={-45} textAnchor="end" height={28} interval={2} />
                  <Bar dataKey="total" fill="hsl(262 83% 58%)" radius={4}>
                    <LabelList position="top" offset={6} className="fill-foreground" fontSize={8} formatter={(value: number) => value > 0 ? value : ""} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {hourlyStats.length > 0 ? "Today 07:00–21:00" : "All vehicles detected"}
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-green-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative px-6 pt-6">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              TOTAL IN
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20">
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
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
          <div className="absolute inset-0 bg-red-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative px-6 pt-6">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              TOTAL OUT
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20">
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
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

      {/* Row 2: Cars Inside Now, Contracts In, Contracts (with plates), Walk Ins — no graphs */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-amber-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              CARS INSIDE NOW
            </CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
              <Car className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="relative space-y-2">
            <div className="text-3xl font-bold">{stats.carsInsideNow ?? 0}</div>
            <p className="text-xs text-muted-foreground">Currently in parking</p>
          </CardContent>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              CONTRACTS IN
            </CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="relative space-y-2">
            <div className="text-3xl font-bold">{stats.contractsIn}</div>
            <p className="text-xs text-muted-foreground">Contract vehicles in</p>
          </CardContent>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              CONTRACTS (WITH PLATES)
            </CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <FileCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="relative space-y-2">
            <div className="text-3xl font-bold">{stats.contractsWithPlates ?? 0}</div>
            <p className="text-xs text-muted-foreground">Have plate lines</p>
          </CardContent>
        </Card>

        <Card className="stat-card group relative overflow-hidden border-0 card-shadow-xl bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              WALK INS
            </CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
              <User className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="relative space-y-2">
            <div className="text-3xl font-bold">{stats.walkIns}</div>
            <p className="text-xs text-muted-foreground">Visitor vehicles in</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Field */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase text-muted-foreground">Recent License Plate Recognitions</h2>
            <p className="text-[9px] text-muted-foreground mt-0.5">Normal: every OUT has a previous IN. We keep track of vehicles that left without an IN capture (abnormal) — see Reports → OUT Without IN.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live updates active" />
            <span className="text-[9px] text-muted-foreground">Live</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by license plate, direction (IN/OUT), vehicle type, or camera..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-xs h-8"
            />
          </div>
          {searchQuery.trim() && (
            <p className="text-xs text-muted-foreground">
              {(() => {
                const filteredCount = events && Array.isArray(events) ? events.filter((event) => {
                  const query = searchQuery.trim().toUpperCase();
                  const plate = (event.licensePlate || "").toUpperCase();
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
            const plate = (event.licensePlate || "").toUpperCase();
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

          // Only consider valid license plates (>= 2 chars; no empty or single-digit/junk)
          const validPlateEvents = searchFiltered.filter((e) => ((e.licensePlate || "").trim().toUpperCase().length >= 2));
          // Deduplicate by license plate: keep only the most recent event per plate
          const plateToLatest = new Map<string, RecognitionEventWithRelations>();
          // Also track all events per plate to check if car is still inside
          const plateToAllEvents = new Map<string, RecognitionEventWithRelations[]>();
          for (const event of validPlateEvents) {
            const plate = (event.licensePlate || "").trim().toUpperCase();
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
          // OUT-only plates (no IN ever) — show on dashboard with "NO IN" badge, sort to bottom
          const platesWithIn = new Set(
            [...plateToAllEvents.entries()]
              .filter(([, evs]) => evs.some((e) => e.direction === "IN"))
              .map(([plate]) => plate)
          );
          
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
          
          // Sort: still inside first, then plates with IN (by time), then OUT-only at bottom (by time)
          const filteredEvents = Array.from(plateToLatest.values()).sort((a, b) => {
            const plateA = (a.licensePlate || "").trim().toUpperCase();
            const plateB = (b.licensePlate || "").trim().toUpperCase();
            const stillInsideA = plateToStillInside.get(plateA) || false;
            const stillInsideB = plateToStillInside.get(plateB) || false;
            const outOnlyA = !platesWithIn.has(plateA);
            const outOnlyB = !platesWithIn.has(plateB);
            
            // First priority: still inside cars come first
            if (stillInsideA && !stillInsideB) return -1;
            if (!stillInsideA && stillInsideB) return 1;
            // Second priority: OUT-only (no IN) go to bottom
            if (!outOnlyA && outOnlyB) return -1;
            if (outOnlyA && !outOnlyB) return 1;
            // Third: by recognition time (newest first)
            return new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime();
          });
          
          console.log(`[DASHBOARD-CLIENT] Showing ${filteredEvents.length} unique plates (last 2 days, search: "${searchQuery}") from ${lastTwoDaysEvents.length} events`);
          
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
              // Check if license plate exists in materials (normalize for comparison)
              const normalizedPlate = event.licensePlate?.trim().toUpperCase() || "";
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
              const isOutOnly = !platesWithIn.has(normalizedPlate);

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
                  key={event.id} 
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

function RecognitionEventCard({ event, isNew = false, isInContract = false, isInItems = false, isFromPastDate = false, isStillInside = false, isOutOnly = false, entryTime = null, contractNum01 = 0, contractCarsIn = 0, isExceeded = false, isVisitorOverLimit = false }: { event: RecognitionEventWithRelations; isNew?: boolean; isInContract?: boolean; isInItems?: boolean; isFromPastDate?: boolean; isStillInside?: boolean; isOutOnly?: boolean; entryTime?: Date | null; contractNum01?: number; contractCarsIn?: number; isExceeded?: boolean; /** true when car is inside but over contract limit → pays regular visitor fee */ isVisitorOverLimit?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
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
  
  // Direction enum values are: IN, OUT, UNKNOWN (not APPROACH/AWAY)
  const DirectionIcon = event.direction === "IN" ? ArrowUpRight : event.direction === "OUT" ? ArrowDownRight : null;
  const directionColor = event.direction === "IN" ? "text-green-500" : event.direction === "OUT" ? "text-red-500" : "text-muted-foreground";
  const directionBgColor = event.direction === "IN" ? "bg-green-500/10 border-green-500/20" : event.direction === "OUT" ? "bg-red-500/10 border-red-500/20" : "";

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

  // Card state: solid colors (no gradients) for clear distinction
  // 1) Visitor over limit  2) On contract (within)  3) Past date still in  4) Inside parking  5) Car left (OUT)  6) Past date (left)
  const cardBgClass = isVisitorOverLimit
    ? "bg-amber-100 dark:bg-amber-900/40 border border-amber-400 dark:border-amber-600"
    : isInContract && !isVisitorOverLimit
      ? "bg-blue-100 dark:bg-blue-900/40 border border-blue-400 dark:border-blue-600"
      : isFromPastDate && isStillInside
        ? "bg-sky-100 dark:bg-sky-900/40 border border-sky-400 dark:border-sky-600"
        : isStillInside
          ? "bg-violet-100 dark:bg-violet-900/40 border border-violet-400 dark:border-violet-600"
          : !isStillInside && (event.direction === "OUT" || isOutOnly)
            ? "bg-slate-200 dark:bg-slate-700/50 border border-slate-400 dark:border-slate-600"
            : isFromPastDate
              ? "bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600"
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
      className={`group relative overflow-hidden border-0 card-shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 bg-transparent ${isNew ? "ring-2 ring-green-500/50" : ""}`}
      style={{ minWidth: '300px' }}
    >
      {/* Full card background (solid color by state) */}
      <div className={`absolute inset-0 rounded-xl ${cardBgClass}`} />
      <div className="absolute inset-0 rounded-xl bg-white/10 dark:bg-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
      
      <CardContent className="relative p-4 z-10">
        <div className="flex flex-col gap-3">
          {/* License Plate Row with Image - 35px height, 90px width */}
          <div className="flex items-center gap-2">
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
                        alt={event.licensePlate || "Vehicle"}
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
                          {`${fullImage?.imageType === "FULL_IMAGE" ? "Full image" : "Snapshot"} - ${event.licensePlate || "Vehicle"}`}
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
                              alt={`${fullImage?.imageType === "FULL_IMAGE" ? "Full image" : "Snapshot"} - ${event.licensePlate || "Vehicle"}`}
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
                      alt={event.licensePlate || "Vehicle"}
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

            {/* License Plate and Badge */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="text-xs font-bold uppercase text-foreground truncate">
                {event.licensePlate || "UNKNOWN"}
              </h3>
              {isInContract && contractNum01 > 0 && !isVisitorOverLimit && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs font-bold px-2 py-1 ${isExceeded ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"}`}
                >
                  {contractCarsIn}/{contractNum01}
                </Badge>
              )}
              {isInContract && isVisitorOverLimit && (
                <Badge 
                  variant="secondary" 
                  className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                >
                  Visitor (regular fee)
                </Badge>
              )}
              {isInContract && contractNum01 === 0 && !isVisitorOverLimit && (
                <Badge 
                  variant="secondary" 
                  className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                >
                  CONTRACT
                </Badge>
              )}
              {isInItems && (
                <Badge 
                  variant="secondary" 
                  className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                >
                  ERP
                </Badge>
              )}
              {isStillInside && !isExceeded && (
                <Badge 
                  variant="secondary" 
                  className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                >
                  INSIDE
                </Badge>
              )}
              {isExceeded && (
                <Badge 
                  variant="secondary" 
                  className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
                >
                  EXCEEDED
                </Badge>
              )}
              {isOutOnly && (
                <Badge 
                  variant="secondary" 
                  className="text-xs font-bold px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                  title="Abnormal: no IN capture — we keep track of these"
                >
                  NO IN CAPTURED
                </Badge>
              )}
            </div>

            {/* Direction Icon — from camera: Approach = IN (coming), Away = OUT (leaving) */}
            {DirectionIcon && (
              <div
                className={`flex items-center justify-center h-6 w-6 rounded-md border ${directionBgColor} ${directionColor} flex-shrink-0`}
                title={event.direction === "IN" ? "Approach (coming in)" : "Away (leaving)"}
              >
                <DirectionIcon className="h-4 w-4" />
              </div>
            )}
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
                  className="text-xs font-bold px-2 py-1 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800 inline-flex items-center gap-1"
                >
                  Came in at: {format(entryTime, "dd/MM HH:mm")}
                </Badge>
              )}
              {isStillInside && (
                <Badge
                  variant="secondary"
                  className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 inline-flex items-center gap-1.5"
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
              {event.durationMinutes !== null && event.durationMinutes !== undefined && !isStillInside && event.direction === "OUT" && (
                <Badge
                  variant="secondary"
                  className="text-xs font-bold px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800 inline-flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" />
                  Time in parking: {formatDurationMinutes(event.durationMinutes)}
                </Badge>
              )}
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

