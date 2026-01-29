import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OutWithoutInClient } from "@/components/reports/out-without-in-client";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";

export default async function OutWithoutInReportPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only ADMIN and MANAGER can access reports
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  // Parse date range from search params (default to last 7 days)
  const today = new Date();
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 7);

  let startDate: Date;
  let endDate: Date;

  try {
    if (params.startDate) {
      startDate = startOfDay(parseISO(params.startDate));
    } else {
      startDate = startOfDay(defaultStartDate);
    }

    if (params.endDate) {
      endDate = endOfDay(parseISO(params.endDate));
    } else {
      endDate = endOfDay(today);
    }
  } catch (error) {
    // Invalid dates, use defaults
    startDate = startOfDay(defaultStartDate);
    endDate = endOfDay(today);
  }

  // Fetch all OUT events in the date range (filter null/empty plates in memory — Prisma not: null is invalid here)
  const outEvents = await prisma.lprRecognitionEvent.findMany({
    where: {
      direction: "OUT",
      recognitionTime: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      camera: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      recognitionTime: "desc",
    },
  });

  // Filter to only valid plates (>= 2 chars)
  const validOutEvents = outEvents.filter((e) => {
    const plate = (e.licensePlate || "").trim().toUpperCase();
    return plate.length >= 2;
  });

  if (validOutEvents.length === 0) {
    return (
      <OutWithoutInClient
        events={[]}
        startDate={startDate}
        endDate={endDate}
        user={session.user}
      />
    );
  }

  // Get all unique plates from OUT events
  const plates = new Set(
    validOutEvents.map((e) => (e.licensePlate || "").trim().toUpperCase())
  );

  // Fetch all IN events for these plates (before the end date) in one query
  const inEvents = await prisma.lprRecognitionEvent.findMany({
    where: {
      licensePlate: {
        in: Array.from(plates),
      },
      direction: "IN",
      recognitionTime: {
        lte: endDate, // IN must be before or equal to end date
      },
    },
    select: {
      licensePlate: true,
      recognitionTime: true,
    },
    orderBy: {
      recognitionTime: "desc",
    },
  });

  // Build a map: plate -> array of IN event times (sorted desc)
  const plateToInTimes = new Map<string, Date[]>();
  for (const inEvent of inEvents) {
    const plate = (inEvent.licensePlate || "").trim().toUpperCase();
    if (!plateToInTimes.has(plate)) {
      plateToInTimes.set(plate, []);
    }
    plateToInTimes.get(plate)!.push(new Date(inEvent.recognitionTime));
  }

  // Find OUT events without matching IN (IN must be before OUT)
  const outWithoutIn = validOutEvents.filter((outEvent) => {
    const plate = (outEvent.licensePlate || "").trim().toUpperCase();
    const inTimes = plateToInTimes.get(plate) || [];
    const outTime = new Date(outEvent.recognitionTime);

    // Check if there's any IN event before this OUT event
    return !inTimes.some((inTime) => inTime < outTime);
  });

  // LprImage has no relation on LprRecognitionEvent — fetch images by eventId/eventType
  const eventIds = outWithoutIn.map((e) => e.id);
  const imagesByEventId = new Map<string, { url: string; imageType: string }[]>();
  if (eventIds.length > 0) {
    const images = await prisma.lprImage.findMany({
      where: {
        eventType: "recognition",
        eventId: { in: eventIds },
      },
      select: { eventId: true, url: true, imageType: true },
      orderBy: { createdAt: "desc" },
    });
    for (const img of images) {
      if (!imagesByEventId.has(img.eventId)) imagesByEventId.set(img.eventId, []);
      imagesByEventId.get(img.eventId)!.push({ url: img.url, imageType: img.imageType });
    }
  }

  const eventsWithImages = outWithoutIn.map((e) => ({
    ...e,
    images: imagesByEventId.get(e.id) ?? [],
  }));

  return (
    <OutWithoutInClient
      events={eventsWithImages}
      startDate={startDate}
      endDate={endDate}
      user={session.user}
    />
  );
}
