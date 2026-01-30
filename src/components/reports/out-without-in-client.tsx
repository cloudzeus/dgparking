"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import gsap from "gsap";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formFieldStyles } from "@/lib/form-styles";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Download, ArrowDownRight, Car, Clock, Camera, X } from "lucide-react";
import Image from "next/image";
import type { Role } from "@prisma/client";

type RecognitionEventWithRelations = {
  id: string;
  licensePlate: string | null;
  direction: string | null;
  recognitionTime: Date;
  vehicleType: string | null;
  vehicleBrand: string | null;
  vehicleColor: string | null;
  confidence: number | null;
  speed: number | null;
  camera: {
    name: string | null;
  } | null;
  images: Array<{
    url: string;
    imageType: string;
  }>;
};

interface OutWithoutInClientProps {
  events: RecognitionEventWithRelations[];
  startDate: Date;
  endDate: Date;
  user: {
    id: string;
    email: string;
    role: Role;
    firstName: string | null;
    lastName: string | null;
  };
  /** When set, page was opened for this license plate (e.g. from dashboard "NO IN" link). */
  plateFilter?: string | null;
}

export function OutWithoutInClient({
  events: initialEvents,
  startDate: initialStartDate,
  endDate: initialEndDate,
  user,
  plateFilter: initialPlateFilter = null,
}: OutWithoutInClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState<Date>(initialStartDate);
  const [endDate, setEndDate] = useState<Date>(initialEndDate);
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    });

    return () => ctx.revert();
  }, []);

  const handleDateChange = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("startDate", format(startDate, "yyyy-MM-dd"));
    params.set("endDate", format(endDate, "yyyy-MM-dd"));
    if (initialPlateFilter) params.set("plate", initialPlateFilter);
    router.push(`/reports/out-without-in?${params.toString()}`);
  };

  const handleExportCSV = () => {
    const headers = [
      "License Plate",
      "Recognition Time",
      "Camera",
      "Vehicle Type",
      "Vehicle Brand",
      "Vehicle Color",
      "Confidence",
      "Speed",
    ];
    const rows = initialEvents.map((event) => [
      event.licensePlate || "",
      format(new Date(event.recognitionTime), "yyyy-MM-dd HH:mm:ss"),
      event.camera?.name || "",
      event.vehicleType || "",
      event.vehicleBrand || "",
      event.vehicleColor || "",
      event.confidence?.toString() || "",
      event.speed?.toString() || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `out-without-in-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <PageHeader
        title="OUT WITHOUT IN REPORT"
        subtitle={
          initialPlateFilter
            ? `Vehicles that exited without a recorded entry — viewing plate: ${initialPlateFilter}`
            : "Vehicles that exited without a recorded entry (camera missed IN event)"
        }
      />

      {/* Date Filter Controls */}
      <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
            FILTER BY DATE RANGE
          </CardTitle>
        </CardHeader>
        <CardContent className={formFieldStyles.formSpacing}>
          <div className={`grid grid-cols-1 md:grid-cols-3 ${formFieldStyles.gridGap} items-end`}>
            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="startDate" className={formFieldStyles.label}>
                START DATE
              </Label>
              <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`${formFieldStyles.input} justify-start text-left font-normal`}
                  >
                    <CalendarIcon className={formFieldStyles.buttonIcon} />
                    {format(startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        setIsStartDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className={formFieldStyles.fieldSpacing}>
              <Label htmlFor="endDate" className={formFieldStyles.label}>
                END DATE
              </Label>
              <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`${formFieldStyles.input} justify-start text-left font-normal`}
                  >
                    <CalendarIcon className={formFieldStyles.buttonIcon} />
                    {format(endDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setIsEndDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDateChange} className={formFieldStyles.button}>
                APPLY FILTER
              </Button>
              {initialEvents.length > 0 && (
                <Button onClick={handleExportCSV} variant="outline" className={formFieldStyles.button}>
                  <Download className={formFieldStyles.buttonIcon} />
                  EXPORT CSV
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                TOTAL OUT WITHOUT IN
              </p>
              <p className="text-2xl font-bold">{initialEvents.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      {initialEvents.length > 0 ? (
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
              OUT EVENTS WITHOUT MATCHING IN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={formFieldStyles.label}>IMAGE</TableHead>
                    <TableHead className={formFieldStyles.label}>LICENSE PLATE</TableHead>
                    <TableHead className={formFieldStyles.label}>RECOGNITION TIME</TableHead>
                    <TableHead className={formFieldStyles.label}>CAMERA</TableHead>
                    <TableHead className={formFieldStyles.label}>VEHICLE INFO</TableHead>
                    <TableHead className={formFieldStyles.label}>CONFIDENCE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialEvents.map((event) => {
                    const imageUrl = event.images[0]?.url;
                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          {imageUrl ? (
                            <button
                              type="button"
                              onClick={() => setImageModalUrl(imageUrl)}
                              className="relative h-12 w-20 rounded-md overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors block"
                            >
                              <Image
                                src={imageUrl}
                                alt={event.licensePlate || "Vehicle"}
                                fill
                                className="object-cover"
                                sizes="80px"
                              />
                            </button>
                          ) : (
                            <div className="flex h-12 w-20 items-center justify-center rounded-md bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-border">
                              <Car className="h-4 w-4 text-blue-600" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase">
                              {event.licensePlate || "UNKNOWN"}
                            </span>
                            <Badge
                              variant="destructive"
                              className="text-[0.5rem] px-1.5 py-0.5"
                            >
                              NO IN
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(event.recognitionTime), "yyyy-MM-dd HH:mm:ss")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs">
                            <Camera className="h-3 w-3 text-muted-foreground" />
                            {event.camera?.name || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {event.vehicleBrand && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Brand: </span>
                                <span className="font-medium">{event.vehicleBrand}</span>
                              </div>
                            )}
                            <div className="flex gap-1 flex-wrap">
                              {event.vehicleType && (
                                <Badge variant="secondary" className="text-[0.5rem] px-1.5 py-0.5">
                                  {event.vehicleType}
                                </Badge>
                              )}
                              {event.vehicleColor && (
                                <Badge variant="secondary" className="text-[0.5rem] px-1.5 py-0.5">
                                  {event.vehicleColor}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.confidence !== null && event.confidence !== undefined ? (
                            <span className="text-xs">
                              {typeof event.confidence === "number"
                                ? `${Math.round(event.confidence)}%`
                                : event.confidence}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 card-shadow-xl bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 text-center space-y-4">
            <ArrowDownRight className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">
                No OUT events without matching IN found
              </p>
              <p className="text-xs text-muted-foreground">
                All OUT events in the selected date range have corresponding IN events.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image modal — 1280px width */}
      <Dialog open={!!imageModalUrl} onOpenChange={(open) => !open && setImageModalUrl(null)}>
        <DialogContent
          className="max-w-[1280px] w-full p-0 bg-transparent border-0 shadow-none"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Vehicle image</DialogTitle>
          {imageModalUrl && (
            <div className="relative w-full bg-background/95 backdrop-blur-sm rounded-lg overflow-hidden border-2 border-border shadow-2xl">
              <button
                type="button"
                onClick={() => setImageModalUrl(null)}
                className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 backdrop-blur-sm border border-border hover:bg-background transition-colors shadow-lg"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative w-full max-h-[90vh] overflow-auto">
                <Image
                  src={imageModalUrl}
                  alt="Vehicle"
                  width={1280}
                  height={960}
                  className="w-full max-w-[1280px] h-auto object-contain"
                  sizes="1280px"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
