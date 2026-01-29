import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/new-events
 * 
 * Returns new recognition events since a given timestamp.
 * Used for real-time dashboard updates without page reload.
 * 
 * Query parameters:
 * - since: ISO timestamp string - only return events after this time
 * - limit: Maximum number of events to return (default: 10)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get("since");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Parse the "since" timestamp
    let sinceDate: Date | null = null;
    if (sinceParam) {
      sinceDate = new Date(sinceParam);
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid 'since' timestamp format" },
          { status: 400 }
        );
      }
    }

    // Build query - only events with valid license plates
    const whereClause: any = {
      licensePlate: {
        not: "",
      },
    };

    // Add timestamp filter if provided
    if (sinceDate) {
      whereClause.recognitionTime = {
        gt: sinceDate,
      };
    }

    // Fetch new events
    const newEvents = await prisma.lprRecognitionEvent.findMany({
      where: whereClause,
      take: limit || 100, // Default to 100 if not specified
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

    // Filter events with valid (non-empty, non-null) license plates
    const validEvents = newEvents.filter((event) => {
      const plate = event.licensePlate;
      return plate && typeof plate === "string" && plate.trim().length > 0;
    });

    // Fetch images for these events
    let images: Array<{ eventId: string; url: string; imageType: string }> = [];
    if (validEvents.length > 0) {
      const eventIds = validEvents.map((e) => e.id);
      // Fetch all image types - we'll prioritize in the component
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

    // Group images by eventId and attach to events
    const imagesByEventId = new Map<string, typeof images>();
    for (const image of images) {
      if (!imagesByEventId.has(image.eventId)) {
        imagesByEventId.set(image.eventId, []);
      }
      imagesByEventId.get(image.eventId)!.push(image);
    }

    // Calculate durations for IN/OUT pairs
    // Note: For new events API, we only have limited events, so we query the database
    // But we wrap it in try-catch to handle connection errors gracefully
    let eventsWithDurations;
    try {
      eventsWithDurations = await Promise.all(
        validEvents.map(async (event) => {
          let durationMinutes: number | null = null;
          
          if (event.licensePlate && event.direction) {
            try {
              if (event.direction === "OUT") {
                // For OUT events: find the most recent IN event with the same license plate before this OUT
                const matchingInEvent = await prisma.lprRecognitionEvent.findFirst({
                  where: {
                    licensePlate: event.licensePlate,
                    direction: "IN",
                    recognitionTime: {
                      lt: event.recognitionTime, // Before this OUT event
                    },
                  },
                  orderBy: {
                    recognitionTime: "desc", // Most recent IN event
                  },
                });
                
                if (matchingInEvent) {
                  const durationMs = event.recognitionTime.getTime() - matchingInEvent.recognitionTime.getTime();
                  durationMinutes = Math.round(durationMs / (1000 * 60)); // Convert to minutes
                }
              } else if (event.direction === "IN") {
                // For IN events: find the next OUT event with the same license plate after this IN
                const matchingOutEvent = await prisma.lprRecognitionEvent.findFirst({
                  where: {
                    licensePlate: event.licensePlate,
                    direction: "OUT",
                    recognitionTime: {
                      gt: event.recognitionTime, // After this IN event
                    },
                  },
                  orderBy: {
                    recognitionTime: "asc", // Earliest OUT event
                  },
                });
                
                if (matchingOutEvent) {
                  const durationMs = matchingOutEvent.recognitionTime.getTime() - event.recognitionTime.getTime();
                  durationMinutes = Math.round(durationMs / (1000 * 60)); // Convert to minutes
                }
              }
            } catch (error) {
              // Silently skip duration calculation if database query fails
              // This prevents breaking the entire API response
              console.error(`[DASHBOARD-NEW-EVENTS] Error calculating duration for event ${event.id}:`, error);
            }
          }
          
          return {
            ...event,
            images: imagesByEventId.get(event.id) || [],
            durationMinutes,
          };
        })
      );
    } catch (error) {
      // If duration calculation fails entirely (e.g., database connection issue),
      // return events without durations rather than failing the entire request
      console.error(`[DASHBOARD-NEW-EVENTS] Error calculating durations, returning events without durations:`, error);
      eventsWithDurations = validEvents.map((event) => ({
        ...event,
        images: imagesByEventId.get(event.id) || [],
        durationMinutes: null,
      }));
    }

    const events = eventsWithDurations ?? validEvents.map((event) => ({
      ...event,
      images: imagesByEventId.get(event.id) || [],
      durationMinutes: null,
    }));

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DASHBOARD-NEW-EVENTS] Error fetching new events:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch new events",
      },
      { status: 500 }
    );
  }
}
