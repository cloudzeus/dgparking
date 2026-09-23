"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import gsap from "gsap";
import { PageHeader, KpiTile, EmptyState } from "@/components/admin/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CalendarIcon,
  Download,
  ArrowDownRight,
  Car,
  Clock,
  Camera,
  X,
  Fingerprint,
  ImageIcon,
  CalendarRange,
} from "lucide-react";
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

/** Ημερομηνία σε ώρα Ελλάδας. */
function formatDate(value: Date) {
  return value.toLocaleDateString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Ημερομηνία και ώρα σε ώρα Ελλάδας. */
function formatDateTime(value: Date) {
  return value.toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

  const summary = useMemo(() => {
    const plates = new Set(
      initialEvents
        .map((e) => (e.licensePlate || "").trim().toUpperCase())
        .filter((p) => p.length > 0)
    );
    const withImage = initialEvents.filter((e) => e.images.length > 0).length;
    const days =
      Math.max(
        1,
        Math.round(
          (initialEndDate.getTime() - initialStartDate.getTime()) / (24 * 60 * 60 * 1000)
        )
      ) || 1;
    return { plates: plates.size, withImage, days };
  }, [initialEvents, initialStartDate, initialEndDate]);

  const handleDateChange = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("startDate", format(startDate, "yyyy-MM-dd"));
    params.set("endDate", format(endDate, "yyyy-MM-dd"));
    if (initialPlateFilter) params.set("plate", initialPlateFilter);
    router.push(`/reports/out-without-in?${params.toString()}`);
  };

  const handleExportCSV = () => {
    const headers = [
      "Πινακίδα",
      "Ώρα αναγνώρισης",
      "Κάμερα",
      "Τύπος οχήματος",
      "Μάρκα",
      "Χρώμα",
      "Βεβαιότητα",
      "Ταχύτητα",
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
    <div ref={containerRef} className="space-y-4">
      <PageHeader
        title="Έξοδοι χωρίς είσοδο"
        description={
          initialPlateFilter
            ? `Οχήματα που βγήκαν χωρίς καταγεγραμμένη είσοδο — πινακίδα: ${initialPlateFilter}`
            : "Οχήματα που βγήκαν χωρίς καταγεγραμμένη είσοδο (η κάμερα δεν κατέγραψε το συμβάν εισόδου)."
        }
        icon={ArrowDownRight}
        actions={
          initialEvents.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              title="Εξαγωγή των εγγραφών σε αρχείο CSV"
            >
              <Download className="size-4" />
              Εξαγωγή CSV
            </Button>
          ) : undefined
        }
      />

      {/* Αριθμοί */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Έξοδοι χωρίς είσοδο"
          value={initialEvents.length.toLocaleString("el-GR")}
          hint="Συμβάντα στην επιλεγμένη περίοδο"
          icon={ArrowDownRight}
          tone="red"
        />
        <KpiTile
          label="Μοναδικές πινακίδες"
          value={summary.plates.toLocaleString("el-GR")}
          hint="Διαφορετικά οχήματα"
          icon={Fingerprint}
          tone="blue"
        />
        <KpiTile
          label="Με φωτογραφία"
          value={summary.withImage.toLocaleString("el-GR")}
          hint="Συμβάντα με εικόνα από την κάμερα"
          icon={ImageIcon}
          tone="green"
        />
        <KpiTile
          label="Ημέρες περιόδου"
          value={summary.days.toLocaleString("el-GR")}
          hint={`${formatDate(initialStartDate)} — ${formatDate(initialEndDate)}`}
          icon={CalendarRange}
          tone="amber"
        />
      </div>

      {/* Φίλτρα */}
      <Card>
        <CardHeader>
          <CardTitle>Φίλτρο περιόδου</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                Από
              </Label>
              <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="startDate"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    title="Επιλογή ημερομηνίας έναρξης"
                  >
                    <CalendarIcon className="size-4" />
                    <span className="truncate">{formatDate(startDate)}</span>
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

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                Έως
              </Label>
              <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="endDate"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    title="Επιλογή ημερομηνίας λήξης"
                  >
                    <CalendarIcon className="size-4" />
                    <span className="truncate">{formatDate(endDate)}</span>
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

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleDateChange} title="Εφαρμογή του φίλτρου περιόδου">
                Εφαρμογή
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Πίνακας συμβάντων */}
      {initialEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Έξοδοι χωρίς αντίστοιχη είσοδο</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Φωτογραφία</TableHead>
                  <TableHead>Πινακίδα</TableHead>
                  <TableHead>Ώρα αναγνώρισης</TableHead>
                  <TableHead>Κάμερα</TableHead>
                  <TableHead>Στοιχεία οχήματος</TableHead>
                  <TableHead className="text-right">Βεβαιότητα</TableHead>
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
                            aria-label={`Άνοιγμα φωτογραφίας για την πινακίδα ${event.licensePlate || "άγνωστη"}`}
                            title="Άνοιγμα φωτογραφίας"
                            className="relative block h-12 w-20 cursor-pointer overflow-hidden rounded-md border transition-colors hover:border-primary"
                          >
                            <Image
                              src={imageUrl}
                              alt={event.licensePlate || "Όχημα"}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          </button>
                        ) : (
                          <div
                            className="flex h-12 w-20 items-center justify-center rounded-md border bg-muted"
                            title="Χωρίς φωτογραφία"
                          >
                            <Car className="size-4 text-muted-foreground" aria-hidden />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono uppercase tabular-nums">
                            {event.licensePlate || "Άγνωστη"}
                          </span>
                          <Badge variant="danger">Χωρίς είσοδο</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          {formatDateTime(new Date(event.recognitionTime))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex min-w-0 items-center gap-1">
                          <Camera className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{event.camera?.name || "Άγνωστη"}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {event.vehicleBrand && (
                            <div className="min-w-0">
                              <span className="text-muted-foreground">Μάρκα: </span>
                              <span className="font-medium">{event.vehicleBrand}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {event.vehicleType && <Badge variant="neutral">{event.vehicleType}</Badge>}
                            {event.vehicleColor && <Badge variant="neutral">{event.vehicleColor}</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {event.confidence !== null && event.confidence !== undefined ? (
                          typeof event.confidence === "number"
                            ? `${Math.round(event.confidence).toLocaleString("el-GR")}%`
                            : event.confidence
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={ArrowDownRight}
          title="Καμία έξοδος χωρίς είσοδο"
          description="Όλες οι έξοδοι της επιλεγμένης περιόδου έχουν αντίστοιχη καταγεγραμμένη είσοδο."
        />
      )}

      {/* Προβολή φωτογραφίας — πλάτος 1280px */}
      <Dialog open={!!imageModalUrl} onOpenChange={(open) => !open && setImageModalUrl(null)}>
        <DialogContent
          className="w-full max-w-[1280px] border-0 bg-transparent p-0 shadow-none"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Φωτογραφία οχήματος</DialogTitle>
          {imageModalUrl && (
            <div className="relative w-full overflow-hidden rounded-lg border bg-background">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setImageModalUrl(null)}
                className="absolute top-4 right-4 z-10 rounded-full"
                aria-label="Κλείσιμο φωτογραφίας"
                title="Κλείσιμο"
              >
                <X className="size-4" />
              </Button>
              <div className="relative max-h-[90vh] w-full overflow-auto">
                <Image
                  src={imageModalUrl}
                  alt="Φωτογραφία οχήματος"
                  width={1280}
                  height={960}
                  className="h-auto w-full max-w-[1280px] object-contain"
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
