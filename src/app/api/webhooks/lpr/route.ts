import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadImageToBunnyCDN } from "@/lib/bunny-cdn";
import { logWebhookMessage } from "@/lib/lpr-logger";
import { LprImageType, LprDirection, LprPlateType, LprVehicleType } from "@prisma/client";

/**
 * GET /api/webhooks/lpr
 * 
 * Test endpoint to verify webhook is accessible.
 * Returns webhook status and configuration info.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const test = url.searchParams.get("test");
    
    if (test === "ping") {
      return NextResponse.json({
        success: true,
        message: "Webhook is accessible",
        timestamp: new Date().toISOString(),
        endpoint: "/api/webhooks/lpr",
        method: "POST",
        note: "Send POST requests with JSON data from cameras to this endpoint",
      });
    }
    
    // Get camera count for info with retry logic
    let cameraCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        cameraCount = await prisma.lprCamera.count({
          where: { isActive: true },
        });
        break; // Success
      } catch (error: any) {
        const msg = String(error?.message ?? error);
        const isConnectionError = msg.includes("Can't reach database") || 
                                  msg.includes('ECONNREFUSED') || 
                                  msg.includes('ETIMEDOUT') || 
                                  msg.includes('ENOTFOUND') ||
                                  error?.code === 'P1001';
        
        if (isConnectionError && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          // Log error but don't fail the GET endpoint
          console.error(`Failed to count cameras (attempt ${attempt}):`, error);
          cameraCount = 0; // Default to 0 on error
          break;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "LPR Webhook Endpoint",
      endpoint: "/api/webhooks/lpr",
      method: "POST",
      status: "ready",
      activeCameras: cameraCount,
      note: "This endpoint receives POST requests from LPR cameras. Use ?test=ping to test connectivity.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error checking webhook status",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/lpr
 * 
 * Webhook endpoint to receive LPR camera events via HTTP POST.
 * 
 * This endpoint receives JSON data from Milesight LPR cameras and:
 * 1. Identifies the camera by IP address or device ID
 * 2. Processes different event types (Recognition, Counting, List, Attributes, Violation)
 * 3. Uploads images to BunnyCDN
 * 4. Stores all data in the database
 * 
 * Camera Configuration URL:
 * http://YOUR_DOMAIN/api/webhooks/lpr
 * 
 * Authentication: Optional - can add API key validation if needed
 */

interface RecognitionEventData {
  device?: string;
  time?: string;
  time_msec?: string;
  plate?: string;
  type?: string; // "Visitor", "Black", "White"
  speed?: number | string;
  direction?: string; // "Approach", "Away"
  detection_region?: number;
  region?: string;
  resolution_width?: number;
  resolution_height?: number;
  coordinate_x1?: number;
  coordinate_y1?: number;
  coordinate_x2?: number;
  coordinate_y2?: number;
  confidence?: number | string;
  plate_color?: string;
  vehicle_type?: string;
  vehicle_color?: string;
  "Vehicle Brand"?: string;
  vehicle_brand?: string;
  plate_image?: string; // Base64
  full_image?: string; // Base64
  evidence_image0?: string; // Base64
  evidence_image1?: string; // Base64
  [key: string]: any; // Allow any additional fields from cameras
}

interface VehicleCountingEventData {
  event?: string;
  device?: string;
  time?: string;
  region?: number;
  "region name"?: string;
  region_name?: string;
  "All-Car"?: number;
  "All-Motorcycle"?: number;
  "All-Non-motor"?: number;
  Car?: number;
  Motorbike?: number;
  Bus?: number;
  Truck?: number;
  Van?: number;
  SUV?: number;
  "Fire engine"?: number;
  Fire_engine?: number;
  Ambulance?: number;
  Bicycle?: number;
  Other?: number;
  "Small Vehicle"?: number;
  "Medium Vehicle"?: number;
  "Large Vehicle"?: number;
  snapshot?: string; // Base64
}

interface ListEventData {
  event?: string;
  device?: string;
  time?: string;
  plate?: string;
  list_type?: string;
  match_status?: string;
  [key: string]: any;
}

interface AttributesEventData {
  event?: string;
  device?: string;
  time?: string;
  plate?: string;
  vehicle_color?: string;
  vehicle_brand?: string;
  vehicle_type?: string;
  plate_color?: string;
  [key: string]: any;
}

interface ViolationEventData {
  event?: string;
  device?: string;
  time?: string;
  plate?: string;
  violation_type?: string;
  region?: number;
  region_name?: string;
  [key: string]: any;
}

// Helper function to map vehicle type string to enum
function mapVehicleType(type?: string): LprVehicleType | null {
  if (!type) return null;
  const normalized = type.toLowerCase().trim();
  const mapping: Record<string, LprVehicleType> = {
    "none": LprVehicleType.NONE,
    "car": LprVehicleType.CAR,
    "motor": LprVehicleType.MOTOR,
    "bus": LprVehicleType.BUS,
    "truck": LprVehicleType.TRUCK,
    "van": LprVehicleType.VAN,
    "suv": LprVehicleType.SUV,
    "forklift": LprVehicleType.FORKLIFT,
    "excavator": LprVehicleType.EXCAVATOR,
    "towtruck": LprVehicleType.TOWTRUCK,
    "police-car": LprVehicleType.POLICE_CAR,
    "fireengine": LprVehicleType.FIRE_ENGINE,
    "fire engine": LprVehicleType.FIRE_ENGINE,
    "ambulance": LprVehicleType.AMBULANCE,
    "bicycle": LprVehicleType.BICYCLE,
    "e-bike": LprVehicleType.E_BIKE,
    "other": LprVehicleType.OTHER,
  };
  return mapping[normalized] || null;
}

// Helper: camera direction → IN/OUT. Approach = vehicle proceeds to enter parking (IN). Away = vehicle leaving (OUT).
function mapDirection(direction?: string): LprDirection {
  if (!direction) return LprDirection.UNKNOWN;
  const normalized = direction.toLowerCase().trim();
  // Approach = entering the parking (IN)
  if (["in", "approach", "approaching", "entering", "entry", "inbound"].includes(normalized)) return LprDirection.IN;
  // Away = leaving the parking (OUT)
  if (["out", "away", "leaving", "exit", "outbound", "departing"].includes(normalized)) return LprDirection.OUT;
  return LprDirection.UNKNOWN;
}

// Ensure we never insert any LPR event without a valid (non-empty, non-whitespace) license plate
function hasValidLicensePlate(value: unknown): value is string {
  if (value == null) return false;
  const s = String(value).trim();
  return s.length > 0;
}

// Helper function to map plate type string to enum
function mapPlateType(type?: string): LprPlateType | null {
  if (!type) return null;
  const normalized = type.toLowerCase().trim();
  if (normalized === "black") return LprPlateType.BLACK;
  if (normalized === "white") return LprPlateType.WHITE;
  if (normalized === "visitor") return LprPlateType.VISITOR;
  return null;
}

// Helper function to parse timestamp
function parseTimestamp(time?: string, timeMsec?: string): Date {
  if (timeMsec) {
    // Format: "2023-09-15 06:19:57.267"
    const parsed = new Date(timeMsec.replace(" ", "T"));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (time) {
    // Format: "2023-09-15 06:19:57" or "2023-01-02 23:46:24"
    const parsed = new Date(time.replace(" ", "T"));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

// Helper function to find camera by IP or device
async function findCamera(data: any, request: Request): Promise<string | null> {
  const deviceName = data.device;
  console.log("🔍 Looking for camera with device name:", deviceName);
  
  // Get all active cameras once for multiple lookups with retry logic for connection errors
  let allActiveCameras: Array<{ id: string; name: string; deviceId: string | null; ipAddress: string }> = [];
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      allActiveCameras = await prisma.lprCamera.findMany({
        where: { isActive: true },
        select: { id: true, name: true, deviceId: true, ipAddress: true },
      });
      break; // Success, exit retry loop
    } catch (error: any) {
      const msg = String(error?.message ?? error);
      const isConnectionError = msg.includes("Can't reach database") || 
                                msg.includes('ECONNREFUSED') || 
                                msg.includes('ETIMEDOUT') || 
                                msg.includes('ENOTFOUND') ||
                                error?.code === 'P1001';
      
      if (isConnectionError && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt; // 1s, 2s, 3s
        console.warn(`⚠️ Database connection error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        // Not a connection error or retries exhausted
        console.error(`❌ Failed to fetch cameras after ${attempt} attempt(s):`, error);
        throw error; // Re-throw to be handled by caller
      }
    }
  }
  
  console.log(`📹 Found ${allActiveCameras.length} active camera(s) in database:`, 
    allActiveCameras.map(c => ({ name: c.name, deviceId: c.deviceId, ip: c.ipAddress })));
  
  // Try to find by device name first (matches the "device" field in camera settings)
  if (deviceName) {
    // Try exact match first
    const exactMatch = allActiveCameras.find(
      (c) => c.name === deviceName || c.deviceId === deviceName
    );
    if (exactMatch) {
      console.log("✅ Camera found by exact device name:", deviceName, "→", exactMatch.name);
      return exactMatch.id;
    }
    
    // Try case-insensitive match
    const caseInsensitiveMatch = allActiveCameras.find(
      (c) =>
        c.name?.toLowerCase() === deviceName.toLowerCase() ||
        c.deviceId?.toLowerCase() === deviceName.toLowerCase()
    );
    
    if (caseInsensitiveMatch) {
      console.log("✅ Camera found by case-insensitive device name:", deviceName, "→", caseInsensitiveMatch.name);
      return caseInsensitiveMatch.id;
    }
    
    // Try partial name matching (for cases like "Parking-LPTR-01")
    const nameParts = deviceName.split(/[-_]/);
    const firstPart = nameParts[0]?.toLowerCase();
    
    if (firstPart) {
      const partialMatch = allActiveCameras.find(
        (c) =>
          c.name?.toLowerCase().includes(firstPart) ||
          c.deviceId?.toLowerCase().includes(firstPart) ||
          c.name?.toLowerCase().includes(deviceName.toLowerCase()) ||
          c.deviceId?.toLowerCase().includes(deviceName.toLowerCase())
      );
      
      if (partialMatch) {
        console.log("✅ Camera found by partial name match:", deviceName, "→", partialMatch.name);
        return partialMatch.id;
      }
    }
  }

  // Try to find by IP address from request
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  let ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp;
  
  // Remove IPv6 prefix if present (::ffff:)
  if (ipAddress?.startsWith("::ffff:")) {
    ipAddress = ipAddress.replace("::ffff:", "");
  }

  if (ipAddress) {
    console.log("🌐 Looking for camera by IP address:", ipAddress);
    const ipMatch = allActiveCameras.find(
      (c) => c.ipAddress === ipAddress || c.ipAddress?.includes(ipAddress) || ipAddress?.includes(c.ipAddress || "")
    );
    
    if (ipMatch) {
      console.log("✅ Camera found by IP address:", ipAddress, "→", ipMatch.name);
      return ipMatch.id;
    }
  }

  // If still not found, try to find any active camera (fallback for testing)
  // In production, you might want to return null instead
  if (allActiveCameras.length > 0) {
    const fallbackCamera = allActiveCameras[0];
    console.warn("⚠️ Using fallback camera:", fallbackCamera.name, "(device:", deviceName, "not found)");
    console.warn("⚠️ This means events will be saved but associated with the wrong camera!");
    return fallbackCamera.id;
  }
  
  console.error("❌ No active cameras found in database at all!");
  return null;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let requestBody: any = null;
  let ipAddress: string | null = null;
  
  console.log("🔔 LPR Webhook POST request received");
  console.log("📥 Headers:", Object.fromEntries(request.headers.entries()));
  
  try {
    // Extract IP address from headers first (before reading body)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;
    
    // Try to parse JSON body
    const contentType = request.headers.get("content-type");
    console.log("📋 Content-Type:", contentType);
    console.log("🌐 IP Address:", ipAddress);
    
    if (!contentType || !contentType.includes("application/json")) {
      console.warn("⚠️ Content-Type is not application/json:", contentType);
      // Still try to parse as JSON (some cameras might not send proper content-type)
    }
    
    try {
      requestBody = await request.json();
      console.log("✅ JSON parsed successfully");
      console.log("📦 Body keys:", Object.keys(requestBody));
    } catch (parseError) {
      console.error("❌ Failed to parse JSON:", parseError);
      
      // Try to read as text for debugging
      try {
        const bodyText = await request.text();
        console.log("📦 Raw body length:", bodyText.length, "bytes");
        console.log("📦 Body preview (first 500 chars):", bodyText.substring(0, 500));
        
        // Log the raw body for debugging
        await logWebhookMessage(
          { rawBody: bodyText.substring(0, 1000), contentType },
          {
            ipAddress: ipAddress || undefined,
            success: false,
            error: "Invalid JSON format",
          }
        );
      } catch (textError) {
        console.error("❌ Failed to read body as text:", textError);
      }
      
      return NextResponse.json(
        { success: false, error: "Invalid JSON format. Check logs for details." },
        { status: 400 }
      );
    }
    
    // Log the incoming message immediately
    await logWebhookMessage(requestBody, {
      ipAddress: ipAddress || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      headers: Object.fromEntries(request.headers.entries()),
    });
    
    // Determine event type from payload
    let eventType = requestBody.event || "";
    
    // If event type not explicitly set, determine from payload structure
    if (!eventType || eventType === "") {
      // PRIORITY: Recognition events - check for plate FIRST (most important)
      // Recognition events have plate data - prioritize this over counting events
      if (requestBody.plate || requestBody.plate_image || requestBody.full_image) {
        eventType = "recognition";
      }
      // Vehicle counting events typically have snapshot and counting fields (but NO plate)
      else if (requestBody["All-Car"] !== undefined || 
          requestBody["All-Motorcycle"] !== undefined ||
          requestBody.Car !== undefined ||
          requestBody.Motorbike !== undefined) {
        eventType = "vehicle counting";
      }
      // List events
      else if (requestBody.list_type || requestBody.match_status) {
        eventType = "list event";
      }
      // Attributes events
      else if (requestBody.vehicle_brand || requestBody.vehicle_color) {
        eventType = "attributes";
      }
      // Violation events
      else if (requestBody.violation_type) {
        eventType = "violation";
      }
      // Default fallback - if we have snapshot but no plate, it's likely counting
      else if (requestBody.snapshot) {
        eventType = "vehicle counting";
      } else {
        eventType = "recognition"; // Default fallback
      }
    }
    
    // Comprehensive console logging
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚗 LPR EVENT RECEIVED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📅 Time:", requestBody.time || requestBody.time_msec || "N/A");
    console.log("📹 Device:", requestBody.device || "N/A");
    console.log("🔢 Event Type:", eventType);
    console.log("🌐 IP Address:", ipAddress || "N/A");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Show all available fields from camera
    const allFields = Object.keys(requestBody).filter(k => !k.startsWith("_"));
    console.log("📋 Available fields from camera:", allFields.join(", "));
    
    // Recognition-specific details - try multiple field name variations
    const plate = extractField(requestBody, "plate", "Plate", "PLATE", "license_plate");
    if (plate) {
      console.log("🚙 VEHICLE DETAILS:");
      console.log("   License Plate:", plate);
      console.log("   Vehicle Brand:", extractField(requestBody, "Vehicle Brand", "vehicle_brand", "vehicleBrand", "Vehicle_Brand") || "❌ NOT PROVIDED");
      console.log("   Vehicle Type:", extractField(requestBody, "vehicle_type", "Vehicle Type", "vehicleType", "Vehicle_Type") || "❌ NOT PROVIDED");
      console.log("   Vehicle Color:", extractField(requestBody, "vehicle_color", "Vehicle Color", "vehicleColor", "Vehicle_Color") || "❌ NOT PROVIDED");
      console.log("   Plate Color:", extractField(requestBody, "plate_color", "Plate Color", "plateColor", "Plate_Color") || "❌ NOT PROVIDED");
      console.log("   Plate Type:", extractField(requestBody, "type", "Type", "TYPE", "plate_type") || "❌ NOT PROVIDED");
      console.log("   Confidence:", extractField(requestBody, "confidence", "Confidence", "CONFIDENCE") || "❌ NOT PROVIDED");
      console.log("   Speed:", extractField(requestBody, "speed", "Speed", "SPEED") || "❌ NOT PROVIDED");
      console.log("   Direction:", extractField(requestBody, "direction", "Direction", "DIRECTION") || "❌ NOT PROVIDED");
      console.log("   Region:", extractField(requestBody, "region", "Region", "REGION", "detection_region") || "❌ NOT PROVIDED");
    } else {
      console.log("⚠️  No license plate found in payload");
    }
    
    // Counting-specific details
    if (requestBody["All-Car"] !== undefined) {
      console.log("📊 VEHICLE COUNTING:");
      console.log("   All Cars:", requestBody["All-Car"] || 0);
      console.log("   All Motorcycles:", requestBody["All-Motorcycle"] || 0);
      console.log("   Region:", requestBody["region name"] || requestBody.region_name || "N/A");
    }
    
    // Image details
    const hasPlateImage = !!requestBody.plate_image;
    const hasFullImage = !!requestBody.full_image;
    const hasSnapshot = !!requestBody.snapshot;
    const hasEvidence0 = !!requestBody.evidence_image0;
    const hasEvidence1 = !!requestBody.evidence_image1;
    
    console.log("📸 IMAGES:");
    console.log("   Plate Image:", hasPlateImage ? "✅ Yes" : "❌ No");
    console.log("   Full Image:", hasFullImage ? "✅ Yes" : "❌ No");
    console.log("   Snapshot:", hasSnapshot ? "✅ Yes" : "❌ No");
    console.log("   Evidence 0:", hasEvidence0 ? "✅ Yes" : "❌ No");
    console.log("   Evidence 1:", hasEvidence1 ? "✅ Yes" : "❌ No");
    
    // Full payload (truncated for readability)
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📦 FULL PAYLOAD (keys only):", Object.keys(requestBody).join(", "));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    console.log("🔍 Detected event type:", eventType);

    // Find camera - identifies by device name, device ID, or IP address
    // Camera is optional - we can process events without camera registration since we have direction
    let cameraId = await findCamera(requestBody, request);
    
    if (!cameraId) {
      console.log("ℹ️  Camera not found, but continuing to process event (camera is optional - direction is sufficient)");
      console.log("   📹 Device Name:", requestBody.device);
      console.log("   🌐 IP Address:", ipAddress);
    }

    let eventId: string;
    const eventTime = parseTimestamp(requestBody.time, requestBody.time_msec);

    // Process based on event type
    switch (eventType.toLowerCase()) {
      case "parking detection":
        // Skip parking detection as requested
        await logWebhookMessage(requestBody, {
          ipAddress: ipAddress || undefined,
          success: true,
          processingTime: Date.now() - startTime,
        });
        return NextResponse.json({ success: true, message: "Parking detection events are not processed" });

      case "vehicle counting":
        // Skip vehicle counting events - they don't have license plates
        await logWebhookMessage(requestBody, {
          ipAddress: ipAddress || undefined,
          success: true,
          processingTime: Date.now() - startTime,
        });
        return NextResponse.json({ success: true, message: "Vehicle counting events are not processed (no license plates)" });

      case "list event":
      case "list":
        // Only process if license plate is present - never insert without valid plate
        const listPlate = extractField(requestBody, "plate", "Plate", "PLATE", "license_plate");
        if (!hasValidLicensePlate(listPlate)) {
          await logWebhookMessage(requestBody, {
            ipAddress: ipAddress || undefined,
            success: true,
            processingTime: Date.now() - startTime,
          });
          return NextResponse.json({ success: true, message: "List event skipped - no license plate" });
        }
        eventId = await processListEvent(cameraId, requestBody as ListEventData, eventTime);
        break;

      case "attributes":
      case "attributes event":
        // Only process if license plate is present - never insert without valid plate
        const attributesPlate = extractField(requestBody, "plate", "Plate", "PLATE", "license_plate");
        if (!hasValidLicensePlate(attributesPlate)) {
          await logWebhookMessage(requestBody, {
            ipAddress: ipAddress || undefined,
            success: true,
            processingTime: Date.now() - startTime,
          });
          return NextResponse.json({ success: true, message: "Attributes event skipped - no license plate" });
        }
        eventId = await processAttributesEvent(cameraId, requestBody as AttributesEventData, eventTime);
        break;

      case "violation":
      case "violation event":
        // Only process if license plate is present - never insert without valid plate
        const violationPlate = extractField(requestBody, "plate", "Plate", "PLATE", "license_plate");
        if (!hasValidLicensePlate(violationPlate)) {
          await logWebhookMessage(requestBody, {
            ipAddress: ipAddress || undefined,
            success: true,
            processingTime: Date.now() - startTime,
          });
          return NextResponse.json({ success: true, message: "Violation event skipped - no license plate" });
        }
        eventId = await processViolationEvent(cameraId, requestBody as ViolationEventData, eventTime);
        break;

      case "recognition":
      default:
        // MANDATORY FIELDS: license plate, timestamp, snapshot, direction
        // Validate all mandatory fields before processing
        
        // 1. License Plate (mandatory) - never insert without valid plate
        const recognitionPlate = extractField(requestBody, "plate", "Plate", "PLATE", "license_plate", "licensePlate");
        if (!hasValidLicensePlate(recognitionPlate)) {
          console.log("⚠️  Recognition event skipped - missing mandatory field: license plate");
          console.log("   📋 Available fields:", Object.keys(requestBody).filter(k => k.toLowerCase().includes("plate")).join(", "));
          await logWebhookMessage(requestBody, {
            ipAddress: ipAddress || undefined,
            success: false,
            error: "Missing mandatory field: license plate",
            processingTime: Date.now() - startTime,
          });
          return NextResponse.json({ success: false, message: "Recognition event skipped - missing mandatory field: license plate" });
        }
        
        // 2. Timestamp (mandatory) - already validated via parseTimestamp
        if (!eventTime || isNaN(eventTime.getTime())) {
          console.log("⚠️  Recognition event skipped - missing mandatory field: timestamp");
          await logWebhookMessage(requestBody, {
            ipAddress: ipAddress || undefined,
            success: false,
            error: "Missing mandatory field: timestamp",
            processingTime: Date.now() - startTime,
          });
          return NextResponse.json({ success: false, message: "Recognition event skipped - missing mandatory field: timestamp" });
        }
        
        // 3. Snapshot/Image (mandatory) - accept snapshot, full_image, or plate_image
        const hasSnapshot = !!requestBody.snapshot && requestBody.snapshot.trim() !== "";
        const hasFullImage = !!requestBody.full_image && requestBody.full_image.trim() !== "";
        const hasPlateImage = !!requestBody.plate_image && requestBody.plate_image.trim() !== "";
        const hasRequiredImage = hasSnapshot || hasFullImage || hasPlateImage;
        
        if (!hasRequiredImage) {
          console.log("⚠️  Recognition event skipped - missing mandatory field: snapshot/image");
          console.log("   📋 Available image fields:", {
            snapshot: hasSnapshot,
            full_image: hasFullImage,
            plate_image: hasPlateImage,
          });
          await logWebhookMessage(requestBody, {
            ipAddress: ipAddress || undefined,
            success: false,
            error: "Missing mandatory field: snapshot/image (snapshot, full_image, or plate_image required)",
            processingTime: Date.now() - startTime,
          });
          return NextResponse.json({ success: false, message: "Recognition event skipped - missing mandatory field: snapshot/image (snapshot, full_image, or plate_image required)" });
        }
        
        // 4. Direction (mandatory) - "Approach" = IN (coming), "Away" = OUT (leaving)
        const rawDir = extractField(requestBody, "direction", "Direction", "DIRECTION", "vehicle.direction", "data.direction");
        const direction = mapDirection(rawDir);
        if (!direction || direction === "UNKNOWN") {
          console.log("⚠️  Recognition event skipped - missing mandatory field: direction (must be IN or OUT)");
          console.log("   📋 Direction value:", rawDir);
          await logWebhookMessage(requestBody, {
            ipAddress: ipAddress || undefined,
            success: false,
            error: "Missing mandatory field: direction (must be IN or OUT)",
            processingTime: Date.now() - startTime,
          });
          return NextResponse.json({ success: false, message: "Recognition event skipped - missing mandatory field: direction (must be IN or OUT)" });
        }
        
        console.log("✅ All mandatory fields present - processing recognition event");
        console.log("   📋 License Plate:", recognitionPlate);
        console.log("   ⏰ Timestamp:", eventTime.toISOString());
        console.log("   📸 Image:", hasSnapshot ? "Snapshot" : hasFullImage ? "Full Image" : "Plate Image", "(any one of snapshot/full_image/plate_image is sufficient)");
        console.log("   ➡️  Direction:", direction);
        
        try {
          eventId = await processRecognitionEvent(cameraId, requestBody as RecognitionEventData, eventTime);
          console.log("✅ Recognition event saved successfully, ID:", eventId);
          
          // Verify the event was actually saved
          const savedEvent = await prisma.lprRecognitionEvent.findUnique({
            where: { id: eventId },
            select: { id: true, licensePlate: true },
          });
          if (!savedEvent) {
            console.error("❌ CRITICAL: Event ID returned but event not found in database!");
          } else {
            console.log("✅ Verified event in database:", { id: savedEvent.id, plate: savedEvent.licensePlate });
          }
        } catch (error) {
          console.error("❌ Failed to save recognition event:", error);
          console.error("❌ Error details:", error instanceof Error ? error.message : String(error));
          throw error; // Re-throw to be caught by outer try-catch
        }
        break;
    }

    // Process images if present
    // Note: Image upload failures won't prevent event from being saved
    if (eventId) {
      console.log("📸 Processing images...");
      try {
        await processImages(cameraId, eventType.toLowerCase(), eventId, requestBody);
        console.log("✅ Images processed");
      } catch (imageError) {
        // Log error but don't fail the entire event
        console.error("⚠️  Image processing failed, but event is still saved:", imageError);
        console.error("   ℹ️  Event ID:", eventId, "- saved successfully without images");
      }
    }

    const processingTime = Date.now() - startTime;

    // Log successful processing
    await logWebhookMessage(requestBody, {
      ipAddress: ipAddress || undefined,
      success: true,
      processingTime,
    });

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Event processed successfully in", processingTime, "ms");
    console.log("   Event ID:", eventId);
    console.log("   Event Type:", eventType);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return NextResponse.json({
      success: true,
      eventId,
      eventType,
      message: "Event processed successfully",
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Failed to process webhook";
    
    console.error("LPR Webhook error:", error);
    
    // Log the error
    if (requestBody) {
      await logWebhookMessage(requestBody, {
        ipAddress: ipAddress || undefined,
        success: false,
        error: errorMessage,
        processingTime,
      });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Helper to extract value with multiple field name variations (and optional nested paths like "vehicle.direction")
function extractField(data: any, ...fieldNames: string[]): any {
  const tryData = (obj: any, key: string): any => {
    if (obj == null) return undefined;
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
    const lower = key.toLowerCase();
    if (obj[lower] !== undefined && obj[lower] !== null && obj[lower] !== "") return obj[lower];
    const upper = key.toUpperCase();
    if (obj[upper] !== undefined && obj[upper] !== null && obj[upper] !== "") return obj[upper];
    return undefined;
  };
  for (const fieldName of fieldNames) {
    if (fieldName.includes(".")) {
      const parts = fieldName.split(".");
      let cur: any = data;
      for (const part of parts) {
        cur = tryData(cur, part);
        if (cur === undefined) break;
      }
      if (cur !== undefined && cur !== null && cur !== "") return cur;
    } else {
      const val = tryData(data, fieldName);
      if (val !== undefined) return val;
    }
  }
  return null;
}

async function processRecognitionEvent(
  cameraId: string | null,
  data: RecognitionEventData,
  eventTime: Date
): Promise<string> {
  console.log("💾 Storing recognition event in database...");
  console.log("   📋 Payload keys (direction check):", Object.keys(data).filter((k) => /direction/i.test(k)).join(", ") || "none", "| all keys:", Object.keys(data).slice(0, 20).join(", "));
  
  // Extract data with multiple field name variations
  const rawPlate = extractField(data, "plate", "Plate", "PLATE", "license_plate", "licensePlate");
  
  // CRITICAL: Never insert any message without a valid license plate
  if (!hasValidLicensePlate(rawPlate)) {
    throw new Error("Cannot save recognition event: license plate is empty or invalid");
  }
  const licensePlate = String(rawPlate).trim();
  const vehicleColor = extractField(data, "vehicle_color", "Vehicle Color", "vehicleColor", "Vehicle_Color", "VEHICLE_COLOR");
  const vehicleBrand = extractField(data, "Vehicle Brand", "vehicle_brand", "vehicleBrand", "Vehicle_Brand", "VEHICLE_BRAND");
  const vehicleType = mapVehicleType(extractField(data, "vehicle_type", "Vehicle Type", "vehicleType", "Vehicle_Type", "VEHICLE_TYPE"));
  const plateColor = extractField(data, "plate_color", "Plate Color", "plateColor", "Plate_Color", "PLATE_COLOR");
  const plateType = mapPlateType(extractField(data, "type", "Type", "TYPE", "plate_type", "plateType"));
  const confidence = (() => {
    const val = extractField(data, "confidence", "Confidence", "CONFIDENCE");
    if (val === null) return null;
    return typeof val === "string" ? parseFloat(val) : val;
  })();
  const speed = (() => {
    const val = extractField(data, "speed", "Speed", "SPEED");
    if (val === null || val === undefined || val === "" || val === "-") return null;
    const num = typeof val === "number" ? val : parseInt(String(val));
    return isNaN(num) ? null : num;
  })();
  // Direction from message: "Approach" = coming in (IN), "Away" = leaving (OUT) — try top-level and nested
  const rawDirection = extractField(data, "direction", "Direction", "DIRECTION", "vehicle.direction", "data.direction");
  const direction = mapDirection(rawDirection);
  if (rawDirection != null) {
    console.log("   📍 Direction from camera:", rawDirection, "→ stored as:", direction);
  }
  const region = extractField(data, "region", "Region", "REGION", "detection_region", "detectionRegion")?.toString();
  const roiId = (() => {
    const val = extractField(data, "detection_region", "Detection Region", "detectionRegion", "roi_id", "roiId");
    return val !== null ? (typeof val === "number" ? val : parseInt(String(val))) : null;
  })();
  
  // Build event data - conditionally include cameraId only if it's not null
  const eventData: any = {
    recognitionTime: eventTime,
    licensePlate,
    vehicleColor,
    vehicleBrand,
    vehicleType,
    plateColor,
    plateType,
    confidence,
    speed,
    direction,
    region,
    roiId,
    coordinateX1: (() => {
      const val = extractField(data, "coordinate_x1", "coordinateX1", "Coordinate_X1");
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : parseInt(String(val));
      return isNaN(num) ? null : num;
    })(),
    coordinateY1: (() => {
      const val = extractField(data, "coordinate_y1", "coordinateY1", "Coordinate_Y1");
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : parseInt(String(val));
      return isNaN(num) ? null : num;
    })(),
    coordinateX2: (() => {
      const val = extractField(data, "coordinate_x2", "coordinateX2", "Coordinate_X2");
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : parseInt(String(val));
      return isNaN(num) ? null : num;
    })(),
    coordinateY2: (() => {
      const val = extractField(data, "coordinate_y2", "coordinateY2", "Coordinate_Y2");
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : parseInt(String(val));
      return isNaN(num) ? null : num;
    })(),
    resolutionWidth: (() => {
      const val = extractField(data, "resolution_width", "resolutionWidth", "Resolution_Width");
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : parseInt(String(val));
      return isNaN(num) ? null : num;
    })(),
    resolutionHeight: (() => {
      const val = extractField(data, "resolution_height", "resolutionHeight", "Resolution_Height");
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : parseInt(String(val));
      return isNaN(num) ? null : num;
    })(),
  };
  
  // Only include cameraId if it's not null (Prisma doesn't like null values for optional relations)
  if (cameraId !== null && cameraId !== undefined) {
    eventData.cameraId = cameraId;
  }
  
  console.log("📝 Event data:", {
    licensePlate: eventData.licensePlate || "MISSING",
    vehicleBrand: eventData.vehicleBrand || "MISSING",
    vehicleType: eventData.vehicleType || "MISSING",
    vehicleColor: eventData.vehicleColor || "MISSING",
    directionFromCamera: rawDirection ?? "MISSING",
    directionStored: eventData.direction || "MISSING",
    confidence: eventData.confidence !== null ? eventData.confidence : "MISSING",
    speed: eventData.speed !== null ? eventData.speed : "MISSING",
  });
  
  const event = await prisma.lprRecognitionEvent.create({
    data: eventData,
  });

  console.log("✅ Recognition event stored with ID:", event.id);
  
  return event.id;
}

async function processVehicleCountingEvent(
  cameraId: string,
  data: VehicleCountingEventData,
  eventTime: Date
): Promise<string> {
  console.log("💾 Storing vehicle counting event in database...");
  
  const eventData = {
    cameraId,
    eventTime,
    region: data.region || extractField(data, "region", "Region", "REGION") || null,
    regionName: extractField(data, "region name", "region_name", "Region Name", "Region_Name") || null,
    reportType: "instant" as const, // or "interval" based on data structure
    allCar: extractField(data, "All-Car", "all_car", "allCar") || null,
    allMotorcycle: extractField(data, "All-Motorcycle", "all_motorcycle", "allMotorcycle") || null,
    allNonMotor: extractField(data, "All-Non-motor", "all_non_motor", "allNonMotor") || null,
    car: extractField(data, "Car", "car", "CAR") || null,
    motorbike: extractField(data, "Motorbike", "motorbike", "MOTORBIKE") || null,
    bus: extractField(data, "Bus", "bus", "BUS") || null,
    truck: extractField(data, "Truck", "truck", "TRUCK") || null,
    van: extractField(data, "Van", "van", "VAN") || null,
    suv: extractField(data, "SUV", "suv", "Suv") || null,
    fireEngine: extractField(data, "Fire engine", "Fire_engine", "fire_engine", "fireEngine") || null,
    ambulance: extractField(data, "Ambulance", "ambulance", "AMBULANCE") || null,
    bicycle: extractField(data, "Bicycle", "bicycle", "BICYCLE") || null,
    other: extractField(data, "Other", "other", "OTHER") || null,
    smallVehicle: extractField(data, "Small Vehicle", "small_vehicle", "smallVehicle") || null,
    mediumVehicle: extractField(data, "Medium Vehicle", "medium_vehicle", "mediumVehicle") || null,
    largeVehicle: extractField(data, "Large Vehicle", "large_vehicle", "largeVehicle") || null,
  };
  
  console.log("📝 Vehicle counting data:", {
    region: eventData.region || "MISSING",
    regionName: eventData.regionName || "MISSING",
    allCar: eventData.allCar !== null ? eventData.allCar : "MISSING",
    hasSnapshot: !!data.snapshot,
  });
  
  const event = await prisma.lprVehicleCountingEvent.create({
    data: eventData,
  });

  console.log("✅ Vehicle counting event stored with ID:", event.id);
  
  return event.id;
}

async function processListEvent(
  cameraId: string | null,
  data: ListEventData,
  eventTime: Date
): Promise<string> {
  const rawPlate = extractField(data, "plate", "Plate", "PLATE", "license_plate", "licensePlate");
  if (!hasValidLicensePlate(rawPlate)) {
    throw new Error("Cannot save list event: license plate is empty or invalid");
  }
  const licensePlate = String(rawPlate).trim();
  const event = await prisma.lprListEvent.create({
    data: {
      cameraId,
      eventTime,
      licensePlate,
      listType: data.list_type,
      matchStatus: data.match_status,
      additionalData: data as any,
    },
  });

  return event.id;
}

async function processAttributesEvent(
  cameraId: string | null,
  data: AttributesEventData,
  eventTime: Date
): Promise<string> {
  const rawPlate = extractField(data, "plate", "Plate", "PLATE", "license_plate", "licensePlate");
  if (!hasValidLicensePlate(rawPlate)) {
    throw new Error("Cannot save attributes event: license plate is empty or invalid");
  }
  const licensePlate = String(rawPlate).trim();
  const event = await prisma.lprAttributesEvent.create({
    data: {
      cameraId,
      eventTime,
      licensePlate,
      vehicleColor: data.vehicle_color,
      vehicleBrand: data.vehicle_brand,
      vehicleType: mapVehicleType(data.vehicle_type),
      plateColor: data.plate_color,
      additionalData: data as any,
    },
  });

  return event.id;
}

async function processViolationEvent(
  cameraId: string | null,
  data: ViolationEventData,
  eventTime: Date
): Promise<string> {
  const rawPlate = extractField(data, "plate", "Plate", "PLATE", "license_plate", "licensePlate");
  if (!hasValidLicensePlate(rawPlate)) {
    throw new Error("Cannot save violation event: license plate is empty or invalid");
  }
  const licensePlate = String(rawPlate).trim();
  const event = await prisma.lprViolationEvent.create({
    data: {
      cameraId,
      eventTime,
      licensePlate,
      violationType: data.violation_type,
      region: data.region,
      regionName: data.region_name,
      details: data as any,
    },
  });

  return event.id;
}

async function processImages(
  cameraId: string | null,
  eventType: string,
  eventId: string,
  data: any
): Promise<void> {
  // Never upload to Bunny CDN when there's no valid license plate - junk, not needed
  const rawPlate = extractField(data, "plate", "Plate", "PLATE", "license_plate", "licensePlate");
  if (!hasValidLicensePlate(rawPlate)) {
    console.log("   ⏭️  Skipping image upload to Bunny CDN - no valid license plate (junk, not needed)");
    return;
  }

  const imageUploads: Array<{ base64: string; fileName: string; imageType: LprImageType; folder: string }> = [];

  // Recognition event images
  if (data.plate_image) {
    const base64Length = data.plate_image.length;
    console.log("   📷 Found plate image (", Math.round(base64Length / 1024), "KB base64)");
    imageUploads.push({
      base64: data.plate_image,
      fileName: `plate_${eventId}.jpg`,
      imageType: LprImageType.PLATE_IMAGE,
      folder: "parking/plate-images",
    });
  }

  if (data.full_image) {
    const base64Length = data.full_image.length;
    console.log("   📷 Found full image (", Math.round(base64Length / 1024), "KB base64)");
    imageUploads.push({
      base64: data.full_image,
      fileName: `full_${eventId}.jpg`,
      imageType: LprImageType.FULL_IMAGE,
      folder: "parking/full-images",
    });
  }

  if (data.evidence_image0) {
    const base64Length = data.evidence_image0.length;
    console.log("   📷 Found evidence image 0 (", Math.round(base64Length / 1024), "KB base64)");
    imageUploads.push({
      base64: data.evidence_image0,
      fileName: `evidence0_${eventId}.jpg`,
      imageType: LprImageType.EVIDENCE_IMAGE0,
      folder: "parking/evidence-images",
    });
  }

  if (data.evidence_image1) {
    const base64Length = data.evidence_image1.length;
    console.log("   📷 Found evidence image 1 (", Math.round(base64Length / 1024), "KB base64)");
    imageUploads.push({
      base64: data.evidence_image1,
      fileName: `evidence1_${eventId}.jpg`,
      imageType: LprImageType.EVIDENCE_IMAGE1,
      folder: "parking/evidence-images",
    });
  }

  // Snapshot/Image is MANDATORY for recognition events
  // Accept snapshot, full_image, or plate_image - any one of these is sufficient
  // If snapshot is present, save it. Otherwise, use full_image or plate_image as snapshot
  // Note: If we use full_image or plate_image as snapshot, they're already processed above, so we just mark one as snapshot type
  if (eventType.toLowerCase() === "recognition") {
    if (data.snapshot) {
      const base64Length = data.snapshot.length;
      console.log("   📷 Found license plate snapshot (", Math.round(base64Length / 1024), "KB base64)");
      console.log("   ✅ Snapshot will be saved - mandatory image field for recognition event");
      imageUploads.push({
        base64: data.snapshot,
        fileName: `snapshot_${eventId}.jpg`,
        imageType: LprImageType.SNAPSHOT,
        folder: "parking/snapshots",
      });
    } else if (data.full_image) {
      // full_image is already processed above as FULL_IMAGE, but we also need a snapshot
      // Since full_image is already in the uploads list, we'll add it again as SNAPSHOT type
      // (This ensures we have both types for flexibility, and BunnyCDN handles duplicates efficiently)
      const base64Length = data.full_image.length;
      console.log("   📷 Using full_image as snapshot (", Math.round(base64Length / 1024), "KB base64)");
      console.log("   ✅ Full image already processed as FULL_IMAGE, also saving as SNAPSHOT - mandatory image field satisfied");
      imageUploads.push({
        base64: data.full_image,
        fileName: `snapshot_${eventId}.jpg`,
        imageType: LprImageType.SNAPSHOT,
        folder: "parking/snapshots",
      });
    } else if (data.plate_image) {
      // plate_image is already processed above as PLATE_IMAGE, but we also need a snapshot
      const base64Length = data.plate_image.length;
      console.log("   📷 Using plate_image as snapshot (", Math.round(base64Length / 1024), "KB base64)");
      console.log("   ✅ Plate image already processed as PLATE_IMAGE, also saving as SNAPSHOT - mandatory image field satisfied");
      imageUploads.push({
        base64: data.plate_image,
        fileName: `snapshot_${eventId}.jpg`,
        imageType: LprImageType.SNAPSHOT,
        folder: "parking/snapshots",
      });
    }
  } else if (data.snapshot && eventType.toLowerCase() !== "recognition") {
    // For non-recognition events, snapshot is optional
    console.log("   📷 Snapshot found for non-recognition event - skipping (not mandatory)");
  }

  console.log("   📤 Uploading", imageUploads.length, "image(s) directly to BunnyCDN (no blob storage)...");

  // Upload all images directly to BunnyCDN - we only store the URL, never the blob/base64
  for (const img of imageUploads) {
    try {
      // Calculate file size from base64 before upload
      const base64Data = img.base64.includes(",") ? img.base64.split(",")[1] : img.base64;
      const fileSizeBytes = Math.ceil((base64Data.length * 3) / 4);
      const fileSizeKB = Math.round(fileSizeBytes / 1024);
      
      console.log("   ⬆️  Uploading", img.imageType, `(${fileSizeKB} KB) directly to BunnyCDN...`);
      
      // Upload directly to BunnyCDN - this converts base64 to buffer and uploads via PUT
      // We do NOT store the blob/base64 anywhere - only the URL after successful upload
      const uploadResult = await uploadImageToBunnyCDN(img.base64, img.fileName, img.folder);
      console.log("   ✅ Uploaded to BunnyCDN:", uploadResult.url);
      
      // Only store the URL in database - NO blob/base64 data is stored
      // Build image data - conditionally include cameraId only if it's not null
      const imageData: any = {
        eventType,
        eventId,
        imageType: img.imageType,
        url: uploadResult.url, // Only URL stored - image is on BunnyCDN
        fileName: uploadResult.fileName,
        fileSize: fileSizeBytes, // Store file size for reference
        mimeType: "image/jpeg",
      };
      
      // Only include cameraId if it's not null (Prisma doesn't like null values for optional relations)
      if (cameraId !== null && cameraId !== undefined) {
        imageData.cameraId = cameraId;
      }
      
      await prisma.lprImage.create({
        data: imageData,
      });
      console.log("   💾 Image URL stored in database (blob NOT stored)");
      
      // Clear base64 from memory immediately after upload (help GC)
      // Note: In JavaScript, we can't force GC, but we can null the reference
      // The base64 will be garbage collected automatically
    } catch (error) {
      console.error(`   ❌ Failed to upload image ${img.fileName} to BunnyCDN:`, error);
      console.error(`   ⚠️  Image will NOT be stored (neither blob nor URL) - upload failed`);
      console.error(`   ℹ️  Event will still be saved, but without this image URL`);
      // Continue with other images even if one fails
      // We do NOT store anything if upload fails - no blob, no URL
      // The event itself is still saved successfully
    }
  }
  
  if (imageUploads.length > 0) {
    console.log("   ✅ All images processed - uploaded to BunnyCDN, URLs stored in database");
    console.log("   ✅ NO blob/base64 data stored - only URLs");
  } else {
    console.log("   ℹ️  No images to process");
  }
}
