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

  // Fetch stats based on role
  const stats = await getDashboardStats(session.user.role);
  
  // Fetch recent LPR recognition events (only those with license plates)
  let recognitionEvents: any[] = [];
  let allRecentEvents: any[] = [];
  
  try {
    // First, check total count in database
    const totalCount = await prisma.lprRecognitionEvent.count();
    console.log(`[DASHBOARD] Total recognition events in database: ${totalCount}`);
    
    // Query all recent events and filter in memory to handle edge cases
    // Fetch all events (no limit) to ensure we get everything
    allRecentEvents = await prisma.lprRecognitionEvent.findMany({
      // No take limit - fetch all events
      orderBy: {
        recognitionTime: "desc",
      },
      include: {
        camera: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(`[DASHBOARD] Queried ${allRecentEvents.length} events from database`);

    // Filter events with valid license plates: non-empty, at least 2 characters (no single-digit/junk)
    const validEvents = allRecentEvents
      .filter((event) => {
        const plate = event.licensePlate;
        const trimmed = plate && typeof plate === "string" ? plate.trim() : "";
        const isValid = trimmed.length >= 2;
        if (!isValid && event) {
          console.log(`[DASHBOARD] Filtered out event ${event.id}: plate="${plate}" (type: ${typeof plate}, length: ${plate?.length})`);
        }
        return isValid;
      });

    console.log(`[DASHBOARD] Valid events (with license plates): ${validEvents.length}`);

    // Show ALL events - no deduplication
    // User wants to see every single record
    recognitionEvents = validEvents;
    // No deduplication, no slice limit - show ALL events
    
    console.log(`[DASHBOARD] Showing ALL ${recognitionEvents.length} events (no deduplication)`);
    console.log(`[DASHBOARD] Breakdown by direction:`);
    const inCount = recognitionEvents.filter(e => e.direction === "IN").length;
    const outCount = recognitionEvents.filter(e => e.direction === "OUT").length;
    console.log(`[DASHBOARD]   - IN: ${inCount}`);
    console.log(`[DASHBOARD]   - OUT: ${outCount}`);

    // Always log what we found (for debugging)
    console.log(`[DASHBOARD] Total events queried: ${allRecentEvents.length}`);
    console.log(`[DASHBOARD] Events with valid license plates: ${recognitionEvents.length}`);
    
    if (allRecentEvents.length > 0 && recognitionEvents.length === 0) {
      console.log(`[DASHBOARD] ⚠️ WARNING: Found ${allRecentEvents.length} events but none have valid license plates`);
      const samplePlates = allRecentEvents.slice(0, 5).map((e: any) => ({
        id: e.id,
        plate: `"${e.licensePlate}"`,
        plateType: typeof e.licensePlate,
        plateLength: e.licensePlate?.length,
        plateIsEmpty: e.licensePlate === "",
        plateIsNull: e.licensePlate === null,
        recognitionTime: e.recognitionTime,
        cameraName: e.camera?.name || "N/A",
      }));
      console.log(`[DASHBOARD] Sample events (first 5):`, JSON.stringify(samplePlates, null, 2));
    } else if (allRecentEvents.length === 0) {
      console.log(`[DASHBOARD] ⚠️ No recognition events found in database at all`);
      console.log(`[DASHBOARD] 💡 Possible reasons:`);
      console.log(`[DASHBOARD]   1. No events have been received from cameras yet`);
      console.log(`[DASHBOARD]   2. Camera is not registered in database (check LPR Cameras page)`);
      console.log(`[DASHBOARD]   3. Events are being received but skipped (check webhook logs)`);
      console.log(`[DASHBOARD]   4. Events don't have license plates (check LPR Logs page)`);
    }
  } catch (error) {
    console.error(`[DASHBOARD] ❌ Error fetching recognition events:`, error);
    if (error instanceof Error) {
      console.error(`[DASHBOARD] Error message:`, error.message);
      console.error(`[DASHBOARD] Error stack:`, error.stack);
    }
    // Continue with empty array - don't crash the page
  }

  // Fetch images for recognition events (only if we have events)
  // Get all image types - we'll prioritize plate_image, full_image, snapshot for avatar
  let images: Array<{ eventId: string; url: string; imageType: string }> = [];
  if (recognitionEvents.length > 0) {
    const eventIds = recognitionEvents.map((e) => e.id);
    const fetchedImages = await prisma.lprImage.findMany({
      where: {
        eventType: "recognition",
        eventId: { in: eventIds },
      },
      select: {
        eventId: true,
        url: true,
        imageType: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    images = fetchedImages;
  }

  // Group images by eventId and prioritize: PLATE_IMAGE > FULL_IMAGE > SNAPSHOT > others
  const imagesByEventId = new Map<string, typeof images>();
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
  // Show all plates (include OUT-only so user sees every event; OUT-only get "NO IN" badge and sort to bottom)
  const recentRecognitionEvents = Array.from(plateToLatest.values()).sort(
    (a, b) => new Date(b.recognitionTime).getTime() - new Date(a.recognitionTime).getTime()
  );

  // Plates registered in ITEMS (CODE = license plate) — badge "ITEMS/MTRL"
  let platesInItems = new Set<string>();
  try {
    const itemsWithCode = await prisma.iTEMS.findMany({
      where: { CODE: { not: null } },
      select: { CODE: true },
    });
    for (const item of itemsWithCode) {
      if (item.CODE && typeof item.CODE === "string") {
        const plate = item.CODE.trim().toUpperCase();
        if (plate.length > 0) platesInItems.add(plate);
      }
    }
    console.log(`[DASHBOARD] Plates in ITEMS (CODE): ${platesInItems.size}`);
  } catch (error) {
    console.error(`[DASHBOARD] ❌ Error fetching ITEMS plates:`, error);
  }

  // Contract license plates: only from INST where WDATETO is future, ISACTIVE=1, and has INSTLINES
  // Flow: INST (filtered) → INSTLINES (MTRL) → ITEMS (MTRL match, CODE = license plate) — badge "CONTRACT"
  let erpLicensePlates = new Set<string>();
  try {
    const now = new Date();
    const activeInstWithLines = await prisma.iNST.findMany({
      where: {
        WDATETO: { gte: now },
        ISACTIVE: 1,
        lines: { some: {} },
      },
      select: { lines: { select: { MTRL: true } } },
    });
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
    const itemsWithCodeForContract = await prisma.iTEMS.findMany({
      where: { CODE: { not: null } },
      select: { MTRL: true, CODE: true },
    });
    for (const item of itemsWithCodeForContract) {
      if (!item.CODE || typeof item.CODE !== "string") continue;
      const normalizedMtrl = item.MTRL ? (String(item.MTRL).replace(/^0+/, "") || item.MTRL.trim()) : "";
      const inContract = (normalizedMtrl && mtrlSet.has(normalizedMtrl)) || (item.MTRL && mtrlSet.has(item.MTRL.trim()));
      if (inContract) {
        const plate = item.CODE.trim().toUpperCase();
        if (plate.length > 0) erpLicensePlates.add(plate);
      }
    }
    console.log(`[DASHBOARD] Contract license plates (INST→INSTLINES→ITEMS.CODE): ${erpLicensePlates.size}`);
  } catch (error) {
    console.error(`[DASHBOARD] ❌ Error fetching contract license plates:`, error);
  }

  // Contract car counts (num01, carsIn) per plate for (carsIn/num01) and exceeded styling
  let contractInfoByPlate: Record<string, { num01: number; carsIn: number }> = {};
  try {
    const contractInfoMap = await getContractInfoByPlate();
    for (const [plate, info] of contractInfoMap.entries()) {
      contractInfoByPlate[plate] = { num01: info.num01, carsIn: info.carsIn };
    }
  } catch (error) {
    console.error(`[DASHBOARD] ❌ Error fetching contract car info:`, error);
  }

  // Contracts (INST) that have at least one INSTLINES (plate line) — for "contract-based" stat
  let contractsWithPlates = 0;
  try {
    contractsWithPlates = await prisma.iNST.count({
      where: { lines: { some: {} } },
    });
    console.log(`[DASHBOARD] Contracts with plates (INST with INSTLINES): ${contractsWithPlates}`);
  } catch (error) {
    console.error(`[DASHBOARD] ❌ Error fetching contracts with plates:`, error);
  }

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

  // Walk Ins (plateType = VISITOR, direction = IN)
  const walkIns = await prisma.lprRecognitionEvent.count({
    where: {
      ...whereValidPlate,
      direction: "IN",
      plateType: "VISITOR",
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











