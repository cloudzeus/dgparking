import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/hourly-stats
 * 
 * Returns hourly vehicle statistics from 07:00 to 21:00 for today.
 * Used for time-based charts on the dashboard.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    
    // Use provided date or today
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(7, 0, 0, 0); // 07:00
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(21, 0, 0, 0); // 21:00

    // Build base where clause - only events with valid license plates
    const whereValidPlate = {
      licensePlate: {
        not: "",
      },
      recognitionTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    // Fetch all events for the time range
    const events = await prisma.lprRecognitionEvent.findMany({
      where: whereValidPlate,
      select: {
        recognitionTime: true,
        direction: true,
        plateType: true,
      },
    });

    // Initialize 30-minute interval buckets (07:00 to 21:30)
    const hourlyData: Array<{
      hour: string;
      hourNum: number;
      total: number;
      in: number;
      out: number;
      contractsIn: number;
      walkIns: number;
    }> = [];

    // Initialize all 30-minute intervals from 07:00 to 21:30
    // This gives us: 07:00, 07:30, 08:00, 08:30, ..., 21:00, 21:30 (30 intervals total)
    for (let hour = 7; hour <= 21; hour++) {
      // Add :00 interval
      hourlyData.push({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        hourNum: hour,
        total: 0,
        in: 0,
        out: 0,
        contractsIn: 0,
        walkIns: 0,
      });
      
      // Add :30 interval (except for 21:30 which is the last one)
      if (hour < 21) {
        hourlyData.push({
          hour: `${hour.toString().padStart(2, "0")}:30`,
          hourNum: hour + 0.5,
          total: 0,
          in: 0,
          out: 0,
          contractsIn: 0,
          walkIns: 0,
        });
      }
    }
    
    // Add 21:30 as the last interval
    hourlyData.push({
      hour: "21:30",
      hourNum: 21.5,
      total: 0,
      in: 0,
      out: 0,
      contractsIn: 0,
      walkIns: 0,
    });

    // Process events and group by 30-minute intervals
    for (const event of events) {
      const eventTime = new Date(event.recognitionTime);
      const hour = eventTime.getHours();
      const minutes = eventTime.getMinutes();

      // Only process hours between 07:00 and 21:30
      if (hour >= 7 && (hour < 21 || (hour === 21 && minutes <= 30))) {
        // Determine which 30-minute interval this event belongs to
        const intervalIndex = (hour - 7) * 2 + (minutes < 30 ? 0 : 1);
        const hourData = hourlyData[intervalIndex];

        if (hourData) {
          hourData.total++;

          if (event.direction === "IN") {
            hourData.in++;
            
            // Check if it's a contract (BLACK or WHITE) or walk-in (VISITOR)
            if (event.plateType === "BLACK" || event.plateType === "WHITE") {
              hourData.contractsIn++;
            } else if (event.plateType === "VISITOR") {
              hourData.walkIns++;
            }
          } else if (event.direction === "OUT") {
            hourData.out++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: hourlyData,
      date: targetDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("[DASHBOARD-HOURLY-STATS] Error fetching hourly stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch hourly stats",
      },
      { status: 500 }
    );
  }
}
