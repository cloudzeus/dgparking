import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getContractInfoByPlate } from "@/lib/contract-cars";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

/**
 * Deduplicates recognition events by combining events with the same license plate,
 * same direction, and within a time window (60 seconds).
 * Keeps the most recent event from each group.
 */
function deduplicateEvents(events: any[]): any[] {
  if (events.length === 0) return [];
  
  // Sort by recognition time (most recent first)
  const sorted = [...events].sort((a, b) => {
    const timeA = new Date(a.recognitionTime).getTime();
    const timeB = new Date(b.recognitionTime).getTime();
    return timeB - timeA; // Descending
  });
  
  const deduplicated: any[] = [];
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
  
  console.log(`[DASHBOARD] Deduplicated ${events.length} events to ${deduplicated.length} unique events`);
  
  return deduplicated;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const twoDaysAgoForQuery = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const DASHBOARD_EVENTS_LIMIT = 2000;

  // Run stats and recent events in parallel for faster load
  const [stats, allRecentEventsFromDb] = await Promise.all([
    getDashboardStats(session.user.role),
    prisma.lprRecognitionEvent.findMany({
      where: { recognitionTime: { gte: twoDaysAgoForQuery } },
      orderBy: { recognitionTime: "desc" },
      take: DASHBOARD_EVENTS_LIMIT,
      include: {
        camera: { select: { name: true } },
      },
    }),
  ]);

  let recognitionEvents: any[] = [];
  let allRecentEvents: any[] = allRecentEventsFromDb;

  try {
    // Filter events with valid license plates: non-empty, at least 2 characters
    const validEvents = allRecentEvents.filter((event) => {
      const plate = event.licensePlate;
      const trimmed = plate && typeof plate === "string" ? plate.trim() : "";
      return trimmed.length >= 2;
    });
    recognitionEvents = validEvents;
  } catch (error) {
    console.error(`[DASHBOARD] ❌ Error processing recognition events:`, error);
  }

  const eventIds = recognitionEvents.map((e) => e.id);
  const now = new Date();

  // Run all secondary data fetches in parallel for faster dashboard load
  const [
    fetchedImages,
    itemsWithCodeForPlatesInItems,
    activeInstWithLines,
    itemsWithCodeForContract,
    contractInfoMap,
    contractsWithPlatesCount,
  ] = await Promise.all([
    eventIds.length > 0
      ? prisma.lprImage.findMany({
          where: { eventType: "recognition", eventId: { in: eventIds } },
          select: { eventId: true, url: true, imageType: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.iTEMS.findMany({
      where: { CODE: { not: null } },
      select: { CODE: true },
    }),
    prisma.iNST.findMany({
      where: { WDATETO: { gte: now }, ISACTIVE: 1, lines: { some: {} } },
      select: { lines: { select: { MTRL: true } } },
    }),
    prisma.iTEMS.findMany({
      where: { CODE: { not: null } },
      select: { MTRL: true, CODE: true },
    }),
    getContractInfoByPlate(),
    prisma.iNST.count({ where: { lines: { some: {} } } }),
  ]);

  type ImageRow = { eventId: string; url: string; imageType: string };
  const images: ImageRow[] = fetchedImages;

  // Group images by eventId and prioritize: PLATE_IMAGE > FULL_IMAGE > SNAPSHOT > others
  const imagesByEventId = new Map<string, ImageRow[]>();
  const imagePriority: Record<string, number> = {
    PLATE_IMAGE: 1,
    FULL_IMAGE: 2,
    SNAPSHOT: 3,
    EVIDENCE_IMAGE0: 4,
    EVIDENCE_IMAGE1: 5,
  };
  
  for (const image of images) {
    if (!imagesByEventId.has(image.eventId)) {
      imagesByEventId.set(image.eventId, []);
    }
    imagesByEventId.get(image.eventId)!.push(image);
  }
  
  // Sort images by priority for each event
  for (const [eventId, eventImages] of imagesByEventId.entries()) {
    eventImages.sort((a, b) => {
      const priorityA = imagePriority[a.imageType] || 999;
      const priorityB = imagePriority[b.imageType] || 999;
      return priorityA - priorityB;
    });
  }

  // Normalize plate for matching (same card: vehicle was IN, then OUT — stop counting, show total time)
  const norm = (p: string | null) => (p || "").trim().toUpperCase();
  // Calculate durations for IN/OUT pairs: when vehicle goes OUT, match to same plate's IN, stop counting, set total time
  const eventsWithDurations = recognitionEvents.map((event) => {
    let durationMinutes: number | null = null;
    const eventPlate = norm(event.licensePlate);
    if (eventPlate.length >= 2 && event.direction) {
      try {
        if (event.direction === "OUT") {
          // Vehicle going away: find the IN event for this plate (same card was counting time), compute total
          const matchingInEvent = recognitionEvents
            .filter((e) =>
              norm(e.licensePlate) === eventPlate &&
              e.direction === "IN" &&
              new Date(e.recognitionTime).getTime() < new Date(event.recognitionTime).getTime()
            )
            .sort((a, b) =>
              new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime()
            )[0];
          if (matchingInEvent) {
            const durationMs = new Date(event.recognitionTime).getTime() - new Date(matchingInEvent.recognitionTime).getTime();
            durationMinutes = Math.round(durationMs / (1000 * 60));
          }
        } else if (event.direction === "IN") {
          const matchingOutEvent = recognitionEvents
            .filter((e) =>
              norm(e.licensePlate) === eventPlate &&
              e.direction === "OUT" &&
              new Date(e.recognitionTime).getTime() > new Date(event.recognitionTime).getTime()
            )
            .sort((a, b) =>
              new Date(a.recognitionTime).getTime() - new Date(b.recognitionTime).getTime()
            )[0];
          if (matchingOutEvent) {
            const durationMs = new Date(matchingOutEvent.recognitionTime).getTime() - new Date(event.recognitionTime).getTime();
            durationMinutes = Math.round(durationMs / (1000 * 60));
          }
        }
      } catch (error) {
        console.error(`[DASHBOARD] Error calculating duration for event ${event.id}:`, error);
      }
    }
    return {
      ...event,
      images: imagesByEventId.get(event.id) || [],
      durationMinutes,
    };
  });

  // Only show events from the last 2 days
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const lastTwoDays = eventsWithDurations.filter(
    (e) => new Date(e.recognitionTime) >= twoDaysAgo
  );
  // Build plate -> events (valid plate >= 2 chars) for cars-inside count and IN-only card filter
  const plateToEvents = new Map<string, typeof lastTwoDays>();
  for (const e of lastTwoDays) {
    const plate = (e.licensePlate || "").trim().toUpperCase();
    if (plate.length < 2) continue;
    if (!plateToEvents.has(plate)) plateToEvents.set(plate, []);
    plateToEvents.get(plate)!.push(e);
  }
  // Cars inside now: valid plate, at least one IN, latest IN with no OUT after
  let carsInsideNow = 0;
  for (const [, evs] of plateToEvents) {
    const hasIn = evs.some((e) => e.direction === "IN");
    if (!hasIn) continue;
    const sorted = [...evs].sort((a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime());
    const latest = sorted[0];
    if (latest?.direction === "IN" && !sorted.some((e) => e.direction === "OUT" && new Date(e.recognitionTime).getTime() > new Date(latest.recognitionTime).getTime())) {
      carsInsideNow++;
    }
  }
  // Plates that have at least one IN event (in full history per plate) — used for "NO IN CAPTURED" badge
  const platesWithIn = new Set<string>(
    [...plateToEvents.entries()]
      .filter(([, evs]) => evs.some((e) => e.direction === "IN"))
      .map(([plate]) => plate)
  );

  // Deduplicate by license plate: keep only the most recent event per plate (valid plate >= 2 chars)
  const plateToLatest = new Map<string, (typeof lastTwoDays)[0]>();
  for (const event of lastTwoDays) {
    const plate = (event.licensePlate || "").trim().toUpperCase();
    if (plate.length < 2) continue;
    const existing = plateToLatest.get(plate);
    const eventTime = new Date(event.recognitionTime).getTime();
    if (!existing || new Date(existing.recognitionTime).getTime() < eventTime) {
      plateToLatest.set(plate, event);
    }
  }
  // One event per plate (latest); then exclude cars that left (OUT) on a past date — show only OUT from same date (today)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const allLatest = Array.from(plateToLatest.values());
  const recentRecognitionEvents = allLatest
    .filter((event) => {
      const plate = (event.licensePlate || "").trim().toUpperCase();
      if (plate.length < 2) return false;
      const evs = plateToEvents.get(plate) ?? [];
      const sorted = [...evs].sort((a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime());
      const latest = sorted[0];
      const isStillInside =
        latest?.direction === "IN" &&
        !sorted.some((e) => e.direction === "OUT" && new Date(e.recognitionTime).getTime() > new Date(latest.recognitionTime).getTime());
      if (isStillInside) return true;
      // Left (OUT): only show if the OUT event is from today
      const t = new Date(event.recognitionTime).getTime();
      return t >= startOfToday.getTime() && t <= endOfToday.getTime();
    })
    .sort((a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime());

  // Plates registered in ITEMS (CODE = license plate) — from parallel fetch
  const platesInItems = new Set<string>();
  for (const item of itemsWithCodeForPlatesInItems) {
    if (item.CODE && typeof item.CODE === "string") {
      const plate = item.CODE.trim().toUpperCase();
      if (plate.length > 0) platesInItems.add(plate);
    }
  }

  // Contract license plates: from parallel fetch (INST + ITEMS)
  const erpLicensePlates = new Set<string>();
  const mtrlSet = new Set<string>();
  for (const inst of activeInstWithLines) {
    for (const line of inst.lines) {
      if (line.MTRL && String(line.MTRL).trim() !== "") {
        const normalized = String(line.MTRL).replace(/^0+/, "") || String(line.MTRL);
        mtrlSet.add(normalized);
        mtrlSet.add(line.MTRL.trim());
      }
    }
  }
  for (const item of itemsWithCodeForContract) {
    if (!item.CODE || typeof item.CODE !== "string") continue;
    const normalizedMtrl = item.MTRL ? (String(item.MTRL).replace(/^0+/, "") || item.MTRL.trim()) : "";
    const inContract = (normalizedMtrl && mtrlSet.has(normalizedMtrl)) || (item.MTRL && mtrlSet.has(item.MTRL.trim()));
    if (inContract) {
      const plate = item.CODE.trim().toUpperCase();
      if (plate.length > 0) erpLicensePlates.add(plate);
    }
  }

  const contractInfoByPlate: Record<string, { num01: number; carsIn: number; slotType?: "contract" | "visitor" }> = {};
  for (const [plate, info] of contractInfoMap.entries()) {
    contractInfoByPlate[plate] = { num01: info.num01, carsIn: info.carsIn, slotType: info.slotType };
  }

  const contractsWithPlates = contractsWithPlatesCount;

  const statsWithCarsInside = { ...stats, carsInsideNow, contractsWithPlates };

  console.log(`[DASHBOARD] Final: ${recentRecognitionEvents.length} events, cars inside now: ${carsInsideNow}`);

  return (
    <DashboardClient 
      user={session.user} 
      stats={statsWithCarsInside} 
      recentEvents={recentRecognitionEvents}
      materialLicensePlates={erpLicensePlates}
      platesInItems={platesInItems}
      contractInfoByPlate={contractInfoByPlate}
      platesWithIn={Array.from(platesWithIn)}
    />
  );
}

async function getDashboardStats(role: string) {
  // Calculate vehicle statistics from recognition events
  // Only count events with valid license plates
  const whereValidPlate = {
    licensePlate: {
      not: "",
    },
  };

  // Total vehicles (all recognition events with license plates)
  const totalVehicles = await prisma.lprRecognitionEvent.count({
    where: whereValidPlate,
  });

  // Total IN (direction = IN)
  const totalIn = await prisma.lprRecognitionEvent.count({
    where: {
      ...whereValidPlate,
      direction: "IN",
    },
  });

  // Total OUT (direction = OUT)
  const totalOut = await prisma.lprRecognitionEvent.count({
    where: {
      ...whereValidPlate,
      direction: "OUT",
    },
  });

  // Contracts IN (plateType = BLACK or WHITE, direction = IN)
  const contractsIn = await prisma.lprRecognitionEvent.count({
    where: {
      ...whereValidPlate,
      direction: "IN",
      plateType: {
        in: ["BLACK", "WHITE"],
      },
    },
  });

  // Walk Ins (plateType = VISITOR, direction = IN) — only 06:00 to 23:00 of current date
  const now = new Date();
  const walkInWindowStart = new Date(now);
  walkInWindowStart.setHours(6, 0, 0, 0);
  const walkInWindowEnd = new Date(now);
  walkInWindowEnd.setHours(23, 0, 0, 0);
  const walkIns = await prisma.lprRecognitionEvent.count({
    where: {
      ...whereValidPlate,
      direction: "IN",
      plateType: "VISITOR",
      recognitionTime: {
        gte: walkInWindowStart,
        lte: walkInWindowEnd,
      },
    },
  });

  return {
    totalVehicles,
    totalIn,
    totalOut,
    contractsIn,
    walkIns,
  };
}











