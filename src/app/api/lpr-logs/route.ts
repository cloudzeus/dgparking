import { NextResponse } from "next/server";
import { getLogFiles, readLogEntries } from "@/lib/lpr-logger";

/**
 * GET /api/lpr-logs
 * 
 * Returns all log entries from LPR webhook log files.
 * Supports query parameters:
 * - limit: Maximum number of entries per file (default: 1000)
 * - days: Number of days to look back (default: 7)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "1000", 10);
    const days = parseInt(searchParams.get("days") || "7", 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get log files for the date range
    const logFiles = await getLogFiles(startDate, endDate);

    // Read entries from all files
    const allEntries: any[] = [];
    for (const filePath of logFiles) {
      const entries = await readLogEntries(filePath, limit);
      allEntries.push(...entries);
    }

    // Only include entries that have a non-empty license plate (ignore counting/other events)
    const plateFieldNames = ["plate", "Plate", "PLATE", "license_plate", "licensePlate"];
    const hasLicensePlate = (entry: any): boolean => {
      const data = entry?.data;
      if (!data || typeof data !== "object") return false;
      const plate = plateFieldNames.reduce((v, key) => v ?? data[key], undefined as string | undefined);
      if (plate == null) return false;
      const s = String(plate).trim();
      return s.length > 0;
    };
    const entriesWithPlate = allEntries.filter(hasLicensePlate);

    // Sort by timestamp (newest first)
    entriesWithPlate.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.receivedAt || 0).getTime();
      const timeB = new Date(b.timestamp || b.receivedAt || 0).getTime();
      return timeB - timeA;
    });

    // Limit total results
    const limitedEntries = entriesWithPlate.slice(0, limit);

    return NextResponse.json({
      success: true,
      entries: limitedEntries,
      total: entriesWithPlate.length,
      filesRead: logFiles.length,
    });
  } catch (error) {
    console.error("Failed to read LPR logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read logs",
      },
      { status: 500 }
    );
  }
}
