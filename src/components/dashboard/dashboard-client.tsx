"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { Role, LprRecognitionEvent, LprImage, LprCamera } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, KpiTile, PageHeader } from "@/components/admin/page";
import { BarTrendChart, ChartCard } from "@/components/admin/charts";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Car,
  Check,
  Clock,
  FileCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Αριθμοί στα ελληνικά. */
const numberFormat = new Intl.NumberFormat("el-GR");

/** Ώρα (ωω:λλ:δδ) σε ζώνη Ελλάδας. */
const formatClock = (value: Date | string) =>
  new Date(value).toLocaleTimeString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Athens",
  });

/** Ημέρα και ώρα (ηη/μμ ωω:λλ) σε ζώνη Ελλάδας. */
const formatDayTime = (value: Date | string) =>
  new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  });

/** Ημέρα, ώρα και δευτερόλεπτα σε ζώνη Ελλάδας. */
const formatDayClock = (value: Date | string) =>
  new Date(value).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Athens",
  });

/**
 * ΩΡΕΣ ΚΑΜΕΡΩΝ — ρολόι τοίχου.
 *
 * Το `recognitionTime` αποθηκεύεται ως τοπική ώρα Αθήνας γραμμένη στα πεδία UTC
 * (βλ. lib/parking-time.ts). Οι παραπάνω formatters ΜΕΤΑΤΡΕΠΟΥΝ σε ζώνη Αθήνας,
 * οπότε πάνω σε τέτοια τιμή πρόσθεταν ξανά το offset: ένα πέρασμα στις 11:45
 * εμφανιζόταν ως 14:45. Εδώ διαβάζουμε τα μέρη UTC αυτούσια.
 *
 * Χρησιμοποίησε αυτούς ΜΟΝΟ για ώρες που προέρχονται από τις κάμερες ή το ERP.
 * Για πραγματικά timestamps (π.χ. `new Date()` στον φυλλομετρητή) οι από πάνω
 * είναι οι σωστοί.
 */
const pad2 = (n: number) => String(n).padStart(2, "0");

const formatWallClock = (value: Date | string) => {
  const d = new Date(value);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};

const formatWallDayTime = (value: Date | string) => {
  const d = new Date(value);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};

const formatWallDayClock = (value: Date | string) => {
  const d = new Date(value);
  return `${formatWallDayTime(d)}:${pad2(d.getUTCSeconds())}`;
};

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
  if (days > 0) parts.push(`${days} ημ`);
  if (hours > 0) parts.push(`${hours} ω`);
  parts.push(`${minutes} λ`);
  return parts.join(" ");
}

/** Format duration in minutes as "Xh Ym" or "Xm" for total time in parking (after exit) */
function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} λ`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} ω`;
  return `${hours} ω ${minutes} λ`;
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
      toast.info("Δεν έχεις επιλέξει κάρτες οχημάτων που βρίσκονται μέσα.");
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
    if (done > 0) toast.success(`Καταγράφηκε η αποχώρηση ${done === 1 ? "1 οχήματος" : `${numberFormat.format(done)} οχημάτων`}`);
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
        toast.error(data.error || "Η καταγραφή απέτυχε");
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
      toast.success("Το όχημα καταγράφηκε ως αποχωρήσαν");
    } catch (e) {
      toast.error("Η καταγραφή απέτυχε");
    }
  };

  /** Reevaluate: update an event's license plate (read message again, correct plate). */
  const handleReevaluate = async (eventId: string, newLicensePlate: string) => {
    const plate = newLicensePlate.trim();
    if (plate.length < 2) {
      toast.error("Η πινακίδα πρέπει να έχει τουλάχιστον 2 χαρακτήρες");
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
        toast.error(data.error || "Η ενημέρωση της πινακίδας απέτυχε");
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
      toast.success("Η πινακίδα ενημερώθηκε");
    } catch (e) {
      toast.error("Η ενημέρωση της πινακίδας απέτυχε");
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

  const getRoleGreeting = () => {
    switch (user.role) {
      case "ADMIN":
        return "Διαχειριστής";
      case "MANAGER":
        return "Υπεύθυνος";
      case "EMPLOYEE":
        return "Υπάλληλος";
      case "CLIENT":
        return "Πελάτης";
    }
  };

  const displayName = user.firstName || user.email?.split("@")[0] || "";
  const hasHourlyStats = hourlyStats.length > 0;

  return (
    <div ref={containerRef} className="space-y-4">
      <PageHeader
        title={`Καλώς ήρθες, ${displayName}`}
        description={`${getRoleGreeting()} · επισκόπηση της κίνησης του πάρκινγκ σε πραγματικό χρόνο.`}
        icon={LayoutDashboard}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshStatus}
            disabled={refreshingStatus}
            title="Έλεγχος κατάστασης οχημάτων"
          >
            {refreshingStatus ? <Spinner data-icon="inline-start" /> : <RefreshCw aria-hidden />}
            {refreshingStatus ? "Έλεγχος…" : "Έλεγχος κατάστασης"}
          </Button>
        }
      />

      {/* Κάρτες αριθμών */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Σύνολο οχημάτων"
          value={numberFormat.format(hasHourlyStats ? todayTotal : stats.totalVehicles)}
          hint={hasHourlyStats ? "αναγνωρίσεις σήμερα" : "όλες οι αναγνωρίσεις"}
          icon={Car}
          tone="blue"
        />
        <KpiTile
          label="Είσοδοι"
          value={numberFormat.format(hasHourlyStats ? todayIn : stats.totalIn)}
          hint={hasHourlyStats ? "οχήματα που μπήκαν σήμερα" : "οχήματα που μπήκαν"}
          icon={ArrowUpRight}
          tone="green"
        />
        <KpiTile
          label="Έξοδοι"
          value={numberFormat.format(hasHourlyStats ? todayOut : stats.totalOut)}
          hint={hasHourlyStats ? "οχήματα που βγήκαν σήμερα" : "οχήματα που βγήκαν"}
          icon={ArrowDownRight}
          tone="red"
        />
        <KpiTile
          label="Οχήματα εντός"
          value={numberFormat.format(stats.carsInsideNow ?? 0)}
          hint="αυτή τη στιγμή στο πάρκινγκ"
          icon={Car}
          tone="amber"
        />
        <KpiTile
          label="Συμβόλαια εντός"
          value={numberFormat.format(stats.contractsIn)}
          hint="οχήματα με συμβόλαιο"
          icon={FileText}
          tone="violet"
        />
        <KpiTile
          label="Συμβόλαια με πινακίδες"
          value={numberFormat.format(stats.contractsWithPlates ?? 0)}
          hint="συμβόλαια που έχουν γραμμές πινακίδων"
          icon={FileCheck}
          tone="blue"
        />
        <KpiTile
          label="Επισκέπτες"
          value={numberFormat.format(stats.walkIns)}
          hint="οχήματα επισκεπτών, 06:00–23:00"
          icon={User}
          tone="amber"
        />
      </div>

      {/* Γράφημα κίνησης */}
      <ChartCard
        title="Κίνηση ανά 30 λεπτά"
        description="Σήμερα 07:00–21:00 — είσοδοι και έξοδοι οχημάτων (π.χ. 07:00 = 07:00–07:30)."
      >
        {loadingHourlyStats ? (
          <Skeleton className="h-60 w-full" />
        ) : hasHourlyStats ? (
          <BarTrendChart
            data={hourlyStats}
            xKey="hour"
            height={240}
            series={[
              { key: "in", label: "Είσοδοι", color: "var(--chart-2)" },
              { key: "out", label: "Έξοδοι", color: "var(--chart-5)" },
            ]}
          />
        ) : (
          <EmptyState
            icon={Clock}
            title="Δεν υπάρχουν στοιχεία κίνησης για σήμερα"
            description="Μόλις οι κάμερες στείλουν αναγνωρίσεις, η κίνηση ανά 30 λεπτά θα εμφανιστεί εδώ."
          />
        )}
      </ChartCard>

      {/* Ζωντανή κατάσταση — ποια οχήματα βρίσκονται μέσα */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span
                className="inline-flex size-2 shrink-0 animate-pulse rounded-full bg-chart-2"
                title="Οι ενημερώσεις γίνονται ζωντανά"
                aria-hidden
              />
              Ζωντανή κατάσταση — ποια οχήματα είναι μέσα
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Τελευταία ενημέρωση {formatClock(lastUpdateTime)} · <strong>{numberFormat.format(liveCarsInsideCount)}</strong> οχήματα
              μέσα τώρα. Μία κάρτα ανά πινακίδα· η κατάσταση αλλάζει μόλις το όχημα βγει.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="text"
                placeholder="Αναζήτηση με πινακίδα, κατεύθυνση (IN/OUT), τύπο οχήματος ή κάμερα…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-xs"
                aria-label="Αναζήτηση αναγνωρίσεων"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                <Check aria-hidden />
                {selectedPlates.size === platesStillInsideSet.size && platesStillInsideSet.size > 0
                  ? "Αποεπιλογή όλων"
                  : "Επιλογή όλων"}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleMarkAllAsLeft}
                disabled={markingAllAsLeft || selectedPlates.size === 0 || [...selectedPlates].filter((p) => platesStillInsideSet.has(p)).length === 0}
              >
                {markingAllAsLeft ? <Spinner data-icon="inline-start" /> : <LogOut aria-hidden />}
                Αποχώρηση επιλεγμένων ({numberFormat.format([...selectedPlates].filter((p) => platesStillInsideSet.has(p)).length)})
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
                return `Εμφανίζονται ${numberFormat.format(filteredCount)} από ${numberFormat.format(events.length)} αναγνωρίσεις`;
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
            <EmptyState
              icon={Search}
              title={searchQuery.trim() ? "Δεν βρέθηκαν αναγνωρίσεις" : "Δεν υπάρχουν ακόμη αναγνωρίσεις"}
              description={
                searchQuery.trim()
                  ? `Καμία αναγνώριση δεν ταιριάζει με την αναζήτηση «${searchQuery}». Δοκίμασε διαφορετικό όρο.`
                  : "Οι αναγνωρίσεις θα εμφανιστούν εδώ μόλις οι κάμερες αρχίσουν να στέλνουν δεδομένα με πινακίδες."
              }
              action={
                !searchQuery.trim() ? (
                  <ul className="list-inside list-disc space-y-1 text-left text-xs text-muted-foreground">
                    <li>Έλεγξε αν οι κάμερες είναι καταχωρημένες στη σελίδα «Κάμερες LPR».</li>
                    <li>Βεβαιώσου ότι το όνομα ή το device ID της κάμερας ταιριάζει με το webhook.</li>
                    <li>Δες τη σελίδα «Αρχεία LPR» για εισερχόμενα συμβάντα.</li>
                    <li>Βεβαιώσου ότι τα συμβάντα περιέχουν δεδομένα πινακίδας.</li>
                  </ul>
                ) : undefined
              }
            />
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

  // Κατάσταση κάρτας: ετικέτα + μία φράση εξήγησης (χρώμα μόνο μέσω Badge).
  const cardState = isVisitorOverLimit
    ? {
        label: "Υπέρβαση ορίου",
        variant: "warning" as const,
        description: "Οι θέσεις του συμβολαίου είναι πλήρεις — το όχημα χρεώνεται ως επισκέπτης.",
      }
    : isInContract
      ? {
          label: "Συμβόλαιο",
          variant: "info" as const,
          description: "Μετράει στις θέσεις του συμβολαίου (περιλαμβάνεται).",
        }
      : isFromPastDate && isStillInside
        ? {
            label: "Μέσα από προηγούμενη ημέρα",
            variant: "warning" as const,
            description: "Μπήκε προηγούμενη ημέρα και βρίσκεται ακόμη στο πάρκινγκ.",
          }
        : isStillInside
          ? {
              label: "Μέσα",
              variant: "success" as const,
              description: "Το όχημα βρίσκεται αυτή τη στιγμή στο πάρκινγκ.",
            }
          : !isStillInside && (event.direction === "OUT" || isOutOnly)
            ? {
                label: "Αποχώρησε",
                variant: "neutral" as const,
                description: "Το όχημα έχει βγει από το πάρκινγκ.",
              }
            : isFromPastDate
              ? {
                  label: "Προηγούμενη ημέρα",
                  variant: "neutral" as const,
                  description: "Συμβάν από προηγούμενη ημέρα.",
                }
              : { label: "—", variant: "neutral" as const, description: "—" };

  return (
    <Card
      ref={cardRef}
      data-new-event={isNew ? "true" : undefined}
      className={cn("relative min-w-0 overflow-hidden", isNew && "ring-2 ring-primary/50")}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* License Plate Row with Image - 35px height, 90px width */}
          <div className="flex items-center gap-2">
            {isStillInside && onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="size-4 shrink-0"
                aria-label={isSelected ? "Αποεπιλογή κάρτας" : "Επιλογή κάρτας"}
              />
            )}
            {/* License Plate Image */}
            <div className="relative flex-shrink-0">
              {imageUrl ? (
                fullImageUrl ? (
                  <>
                    <div 
                      className="relative h-[35px] w-[100px] cursor-pointer overflow-hidden rounded-md border transition-colors hover:border-primary"
                      title="Προβολή πλήρους εικόνας"
                      onClick={() => setIsImageModalOpen(true)}
                      onMouseOver={() => {
                        // Mouseover action can be added here for different behavior
                        // Currently only click opens the modal
                      }}
                    >
                      <Image
                        src={imageUrl}
                        alt={`Πινακίδα ${getDisplayPlate(event)}`}
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
                          {`${fullImage?.imageType === "FULL_IMAGE" ? "Πλήρης εικόνα" : "Στιγμιότυπο"} — ${getDisplayPlate(event)}`}
                        </DialogTitle>
                        <div className="relative w-full bg-background/95 backdrop-blur-sm rounded-lg overflow-hidden border-2 border-border shadow-2xl">
                          {/* Close Button */}
                          <button
                            onClick={() => setIsImageModalOpen(false)}
                            className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border bg-background shadow-xs transition-colors hover:bg-accent"
                            aria-label="Κλείσιμο"
                            title="Κλείσιμο"
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                          {/* Full Image */}
                          <div className="relative w-full max-h-[90vh] overflow-auto">
                            <Image
                              src={fullImageUrl}
                              alt={`${fullImage?.imageType === "FULL_IMAGE" ? "Πλήρης εικόνα" : "Στιγμιότυπο"} — ${getDisplayPlate(event)}`}
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
                  <div className="relative h-[35px] w-[100px] overflow-hidden rounded-md border">
                    <Image
                      src={imageUrl}
                      alt={`Πινακίδα ${getDisplayPlate(event)}`}
                      fill
                      className="object-cover"
                      sizes="100px"
                    />
                  </div>
                )
              ) : (
                <div className="flex h-[35px] w-[100px] items-center justify-center rounded-md border bg-muted" title="Χωρίς εικόνα">
                  <Car className="size-4 text-muted-foreground" aria-hidden />
                </div>
              )}
            </div>

            {/* Modal: View message — event payload without images (for checks) */}
            <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
              <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <DialogTitle className="text-base">Προβολή μηνύματος</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Δεδομένα του συμβάντος όπως ελήφθησαν (χωρίς τις εικόνες), για έλεγχο.
                </p>
                <div className="flex-1 overflow-auto rounded-md border bg-muted/30 p-3">
                  <pre className="font-mono text-xs break-words whitespace-pre-wrap">
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
                        return `Σφάλμα εμφάνισης μηνύματος: ${e instanceof Error ? e.message : String(e)}`;
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
                  <DialogTitle className="text-base">Ώρα αποχώρησης οχήματος</DialogTitle>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`left-at-${event.id}`} className="text-xs">
                        Ημερομηνία και ώρα
                      </Label>
                      <Input
                        id={`left-at-${event.id}`}
                        type="datetime-local"
                        value={leftAt}
                        onChange={(e) => setLeftAt(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLeftModalOpen(false)}
                      >
                        Ακύρωση
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
                      >
                        {savingLeft ? <Spinner data-icon="inline-start" /> : <LogOut aria-hidden />}
                        {savingLeft ? "Αποθήκευση…" : "Καταγραφή αποχώρησης"}
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
                  <DialogTitle className="text-base">Επανεκτίμηση</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Διάβασε ξανά το μήνυμα του συμβάντος και συμπλήρωσε ή διόρθωσε την πινακίδα.
                  </p>
                  <div className="min-h-[120px] flex-1 overflow-auto rounded-md border bg-muted/30 p-3">
                    <pre className="font-mono text-xs break-words whitespace-pre-wrap">
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
                          return `Σφάλμα εμφάνισης μηνύματος: ${e instanceof Error ? e.message : String(e)}`;
                        }
                      })()}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`reevaluate-plate-${event.id}`} className="text-xs">
                      Πινακίδα
                    </Label>
                    <Input
                      id={`reevaluate-plate-${event.id}`}
                      value={reevaluatePlate}
                      onChange={(e) => setReevaluatePlate(e.target.value)}
                      placeholder="π.χ. ΑΒΧ-1234"
                      className="h-8 font-mono text-xs uppercase tabular-nums"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsReevaluateModalOpen(false)}
                    >
                      Ακύρωση
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
                    >
                      {savingReevaluate ? <Spinner data-icon="inline-start" /> : <RefreshCw aria-hidden />}
                      {savingReevaluate ? "Αποθήκευση…" : "Αποθήκευση πινακίδας"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Δύο γραμμές: πινακίδα + ενέργειες, από κάτω οι ετικέτες κατάστασης */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {/* Γραμμή 1: πινακίδα + μενού ενεργειών */}
              <div className="flex items-center gap-2">
                <h3
                  className="min-w-0 truncate font-mono text-xs font-semibold uppercase tabular-nums"
                  title={getDisplayPlate(event)}
                >
                  {getDisplayPlate(event)}
                </h3>
                <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Ενέργειες οχήματος" title="Ενέργειες οχήματος">
                  <MoreVertical aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setIsMessageModalOpen(true);
                  }}
                >
                  <FileText className="mr-2 size-4" aria-hidden />
                  Προβολή μηνύματος
                </DropdownMenuItem>
                {onReevaluate && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setReevaluatePlate(getPlate(event));
                      setIsReevaluateModalOpen(true);
                    }}
                  >
                    <RefreshCw className="mr-2 size-4" aria-hidden />
                    Επανεκτίμηση
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
                    <LogOut className="mr-2 size-4" aria-hidden />
                    Αποχώρηση
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
              </div>

              {/* Γραμμή 2: ετικέτες — ERP, κατεύθυνση, συμβόλαιο, κατάσταση */}
              <div className="flex flex-wrap items-center gap-1.5">
              {isInItems && (
                <Badge variant="neutral" title="Η πινακίδα υπάρχει ως είδος στο ERP">
                  ERP
                </Badge>
              )}
              {DirectionIcon && (
                <Badge
                  variant={event.direction === "IN" ? "success" : "danger"}
                  title={event.direction === "IN" ? "Είσοδος στο πάρκινγκ" : "Έξοδος από το πάρκινγκ"}
                >
                  <DirectionIcon aria-hidden />
                  {event.direction === "IN" ? "Είσοδος" : "Έξοδος"}
                </Badge>
              )}
              {isInContract && contractNum01 > 0 && !isVisitorOverLimit && (
                <Badge
                  variant={isExceeded ? "danger" : "info"}
                  className="tabular-nums"
                  title="Οχήματα εντός προς θέσεις συμβολαίου"
                >
                  {contractCarsIn}/{contractNum01}
                </Badge>
              )}
              {isInContract && isVisitorOverLimit && <Badge variant="warning">Επισκέπτης</Badge>}
              {isInContract && contractNum01 === 0 && !isVisitorOverLimit && <Badge variant="info">Συμβόλαιο</Badge>}
              {isStillInside && !isExceeded && <Badge variant="success">Μέσα</Badge>}
              {isExceeded && <Badge variant="danger">Υπέρβαση</Badge>}
              {isOutOnly && (
                <>
                  <Badge variant="danger" title="Μη φυσιολογικό: δεν καταγράφηκε είσοδος">
                    Χωρίς είσοδο
                  </Badge>
                  <Link
                    href={`/reports/out-without-in?plate=${encodeURIComponent(getPlate(event).toUpperCase())}`}
                    className="text-xs font-medium text-primary hover:underline"
                    title="Άνοιγμα αναφοράς εξόδων χωρίς είσοδο"
                  >
                    Αναφορά
                  </Link>
                </>
              )}
              </div>
            </div>
          </div>

          {/* Περιγραφή κατάστασης */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2">
            <Badge variant={cardState.variant}>{cardState.label}</Badge>
            <span className="min-w-0 text-xs text-muted-foreground">{cardState.description}</span>
          </div>

          {/* Στοιχεία */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">

            {/* Στοιχεία οχήματος */}
            <div className="flex flex-col gap-1 text-xs">
              {(event.vehicleBrand || event.vehicleType || event.vehicleColor || event.plateColor) ? (
                <>
                  {event.vehicleBrand && (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-muted-foreground">Μάρκα:</span>
                      <span className="truncate font-medium">{event.vehicleBrand}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-1.5">
                    {event.vehicleType && <Badge variant="outline">{event.vehicleType}</Badge>}
                    {event.vehicleColor && <Badge variant="outline">{event.vehicleColor}</Badge>}
                    {event.plateColor && <Badge variant="outline">Πινακίδα {event.plateColor}</Badge>}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Δεν υπάρχουν στοιχεία οχήματος
                </div>
              )}
            </div>

            {/* Ώρα και κάμερα — στην έξοδο δείχνει και την ώρα εισόδου */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="size-4" aria-hidden />
                {event.direction === "OUT" ? (
                  <span className="tabular-nums">Αποχώρησε: {formatWallDayClock(event.recognitionTime)}</span>
                ) : (
                  <span className="tabular-nums">Αναγνωρίστηκε: {formatWallClock(event.recognitionTime)}</span>
                )}
              </div>
              {entryTime && event.direction === "OUT" && (
                <Badge variant="neutral" className="tabular-nums">
                  Μπήκε: {formatWallDayTime(entryTime)}
                </Badge>
              )}
              {isStillInside && (
                <Badge variant="success" className="tabular-nums" suppressHydrationWarning>
                  <Clock aria-hidden />
                  {mounted ? formatTimeInParking(event.recognitionTime, now) : "—"} στο πάρκινγκ
                </Badge>
              )}
              {event.camera?.name && (
                <span className="min-w-0 truncate" title={event.camera.name}>{event.camera.name}</span>
              )}
              {event.direction && (
                <span
                  className="font-medium"
                  title={event.direction === "IN" ? "Από την κάμερα: Approach = είσοδος (IN)" : event.direction === "OUT" ? "Από την κάμερα: Away = έξοδος (OUT)" : undefined}
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
                  <Badge variant="info" className="tabular-nums">
                    <Clock aria-hidden />
                    Χρόνος στο πάρκινγκ: {formatDurationMinutes(totalMinutes)}
                  </Badge>
                ) : null;
              })()}
            </div>

            {/* Πρόσθετα στοιχεία — μόνο ταχύτητα */}
            {(event.speed !== null && event.speed !== undefined) ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  Ταχύτητα: {typeof event.speed === "number" ? `${numberFormat.format(event.speed)} χλμ/ώρα` : event.speed}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

