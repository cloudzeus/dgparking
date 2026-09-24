"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiTile, EmptyState } from "@/components/admin/page";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Euro,
  FileX,
  LogIn,
  Search,
} from "lucide-react";

export type ReconStatus =
  | "MATCH"
  | "AMOUNT_DIFF"
  | "TIME_DIFF"
  | "MISSING_IN_ERP"
  | "MISSING_IN_CAMERAS";

export type ReconRowDTO = {
  plate: string;
  status: ReconStatus;
  explanation: string;
  ourEntry: string;
  ourExit: string;
  ourDuration: number | null;
  ourAmount: number | null;
  ourInside: boolean;
  ourContract: number | null;
  ourMissingExit: boolean;
  erpEntry: string;
  erpExit: string;
  erpAmount: number | null;
  erpInside: boolean;
  erpContract: number | null;
  erpRef: number | null;
  erpInvoice: number;
  entryDrift: number | null;
  exitDrift: number | null;
  sortKey: string;
};

/** Γραμμή βιβλίου πόρτας: η μόνιμη απογραφή μας έναντι των ανοιχτών του ERP. */
export type GateRowDTO = {
  plate: string;
  inInventory: boolean;
  inErp: boolean;
  ourEntry: string;
  erpEntry: string;
  contract: number | null;
  source: "ERP_SEED" | "CAMERA" | null;
  erpRef: number | null;
};

export type ReconSummaryDTO = {
  total: number;
  match: number;
  amountDiff: number;
  timeDiff: number;
  missingInErp: number;
  missingInCameras: number;
  amountDelta: number;
};

const STATUS_META: Record<
  ReconStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  MATCH: { label: "Ταυτίζεται", variant: "outline", className: "border-chart-2/40 bg-chart-2/10 text-chart-2" },
  AMOUNT_DIFF: { label: "Διαφορά ποσού", variant: "outline", className: "border-chart-5/40 bg-chart-5/10 text-chart-5" },
  TIME_DIFF: { label: "Διαφορά ώρας", variant: "outline", className: "border-chart-3/40 bg-chart-3/10 text-chart-3" },
  MISSING_IN_ERP: { label: "Λείπει από ERP", variant: "outline", className: "border-chart-5/40 bg-chart-5/10 text-chart-5" },
  MISSING_IN_CAMERAS: { label: "Λείπει από κάμερες", variant: "outline", className: "border-chart-4/40 bg-chart-4/10 text-chart-4" },
};

const DAY_OPTIONS = [1, 3, 7, 14];

const euro = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)} €`);

const drift = (m: number | null) => {
  if (m == null || m === 0) return null;
  return `${m > 0 ? "+" : ""}${m}′`;
};

export function ReconciliationClient({
  rows,
  gateRows,
  summary,
  days,
  periodLabel,
}: {
  rows: ReconRowDTO[];
  gateRows: GateRowDTO[];
  summary: ReconSummaryDTO;
  days: number;
  periodLabel: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<ReconStatus | null>(null);
  const [query, setQuery] = useState("");

  const setDays = (d: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("days", String(d));
    router.push(`?${next.toString()}`);
  };

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    return rows.filter(
      (r) => (!filter || r.status === filter) && (!q || r.plate.includes(q))
    );
  }, [rows, filter, query]);

  // Βιβλίο πόρτας: η μόνιμη απογραφή μας έναντι των ανοιχτών εγγραφών του ERP.
  const gateBook = useMemo(() => {
    const q = query.trim().toUpperCase();
    return q ? gateRows.filter((r) => r.plate.includes(q)) : gateRows;
  }, [gateRows, query]);
  const insideBoth = gateBook.filter((r) => r.inInventory && r.inErp).length;

  const toggle = (s: ReconStatus) => setFilter((cur) => (cur === s ? null : s));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Περίοδος: <span className="font-medium text-foreground">{periodLabel}</span> ·{" "}
          {summary.total} εγγραφές
        </p>
        <div className="flex gap-1">
          {DAY_OPTIONS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === days ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d} {d === 1 ? "μέρα" : "μέρες"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <KpiTile
          label="Ταυτίζονται"
          value={summary.match}
          icon={CheckCircle2}
          tone="green"
          onClick={() => toggle("MATCH")}
          active={filter === "MATCH"}
        />
        <KpiTile
          label="Διαφορά ποσού"
          value={summary.amountDiff}
          hint={`Διαφορά τζίρου ${summary.amountDelta.toFixed(2)} €`}
          icon={Euro}
          tone="red"
          onClick={() => toggle("AMOUNT_DIFF")}
          active={filter === "AMOUNT_DIFF"}
        />
        <KpiTile
          label="Διαφορά ώρας"
          value={summary.timeDiff}
          icon={Clock}
          tone="amber"
          onClick={() => toggle("TIME_DIFF")}
          active={filter === "TIME_DIFF"}
        />
        <KpiTile
          label="Λείπουν από ERP"
          value={summary.missingInErp}
          hint="Είδε η κάμερα, δεν γράφτηκε"
          icon={FileX}
          tone="red"
          onClick={() => toggle("MISSING_IN_ERP")}
          active={filter === "MISSING_IN_ERP"}
        />
        <KpiTile
          label="Λείπουν από κάμερες"
          value={summary.missingInCameras}
          hint="Γράφτηκε, δεν το είδε η κάμερα"
          icon={Camera}
          tone="violet"
          onClick={() => toggle("MISSING_IN_CAMERAS")}
          active={filter === "MISSING_IN_CAMERAS"}
        />
      </div>

      <Tabs defaultValue="billing">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="billing">Τιμολόγηση</TabsTrigger>
            <TabsTrigger value="gate">Βιβλίο πόρτας ({gateBook.length})</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση πινακίδας…"
              className="pl-8"
            />
          </div>
        </div>

        <TabsContent value="billing" className="mt-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Εμείς έναντι SoftOne</CardTitle>
              <CardDescription>
                Αριστερά ο υπολογισμός μας από τις κάμερες, δεξιά η εγγραφή του ψηφιακού
                πελατολογίου. {filter ? `Φίλτρο: ${STATUS_META[filter].label}.` : "Οι αποκλίσεις εμφανίζονται πρώτες."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {visible.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Καμία εγγραφή"
                  description="Δεν υπάρχουν εγγραφές με τα τρέχοντα φίλτρα."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} className="align-bottom">Πινακίδα</TableHead>
                        <TableHead colSpan={3} className="border-l text-center text-chart-1">
                          Εμείς (κάμερες)
                        </TableHead>
                        <TableHead colSpan={3} className="border-l text-center text-chart-4">
                          SoftOne (ψηφιακό πελατολόγιο)
                        </TableHead>
                        <TableHead rowSpan={2} className="border-l align-bottom">Κατάσταση</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="border-l">Είσοδος</TableHead>
                        <TableHead>Έξοδος</TableHead>
                        <TableHead className="text-right">Ποσό</TableHead>
                        <TableHead className="border-l">Είσοδος</TableHead>
                        <TableHead>Έξοδος</TableHead>
                        <TableHead className="text-right">Ποσό</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.slice(0, 400).map((r, i) => {
                        const meta = STATUS_META[r.status];
                        const mismatch =
                          r.ourAmount != null &&
                          r.erpAmount != null &&
                          Math.abs(r.ourAmount - r.erpAmount) >= 0.005;
                        return (
                          <TableRow key={`${r.plate}-${r.sortKey}-${i}`}>
                            <TableCell className="font-mono font-medium">
                              {r.plate}
                              {r.ourContract || r.erpContract ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  σύμβ. {r.ourContract ?? r.erpContract}
                                </span>
                              ) : null}
                            </TableCell>

                            <TableCell className="border-l whitespace-nowrap">
                              {r.ourEntry}
                              {drift(r.entryDrift) && (
                                <span className="ml-1 text-xs text-chart-3">{drift(r.entryDrift)}</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {r.ourInside ? (
                                <Badge variant="outline" className="border-chart-1/40 bg-chart-1/10 text-chart-1">
                                  <LogIn className="size-3" /> μέσα
                                </Badge>
                              ) : (
                                <>
                                  {r.ourExit}
                                  {drift(r.exitDrift) && (
                                    <span className="ml-1 text-xs text-chart-3">{drift(r.exitDrift)}</span>
                                  )}
                                </>
                              )}
                              {r.ourDuration != null && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  {r.ourDuration}′
                                </span>
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${mismatch ? "font-semibold text-chart-5" : ""}`}
                            >
                              {euro(r.ourAmount)}
                            </TableCell>

                            <TableCell className="border-l whitespace-nowrap">
                              {r.erpEntry}
                              {r.erpRef && (
                                <span className="ml-1.5 text-xs text-muted-foreground">#{r.erpRef}</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {r.erpInside ? (
                                <Badge variant="outline" className="border-chart-4/40 bg-chart-4/10 text-chart-4">
                                  ανοιχτή
                                </Badge>
                              ) : (
                                r.erpExit
                              )}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${mismatch ? "font-semibold text-chart-5" : ""}`}
                            >
                              {euro(r.erpAmount)}
                            </TableCell>

                            <TableCell className="border-l">
                              <Badge variant={meta.variant} className={meta.className} title={r.explanation}>
                                {meta.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {visible.length > 400 && (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                      Εμφανίζονται οι πρώτες 400 από {visible.length} εγγραφές.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gate" className="mt-3">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Ποια οχήματα είναι μέσα</CardTitle>
              <CardDescription>
                {insideBoth} συμφωνούν · {gateBook.length - insideBoth} εμφανίζονται μόνο στη
                μία πλευρά. Η απογραφή μας ξεκίνησε από το ψηφιακό πελατολόγιο και
                ενημερώνεται από τα περάσματα των καμερών.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {gateBook.length === 0 ? (
                <EmptyState
                  icon={LogIn}
                  title="Κενή απογραφή"
                  description="Κανένα όχημα μέσα. Αν μόλις έγινε μηδενισμός, τρέξε την απογραφή από το ψηφιακό πελατολόγιο."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Πινακίδα</TableHead>
                        <TableHead>Σύμβαση</TableHead>
                        <TableHead className="text-center text-chart-1">Απογραφή</TableHead>
                        <TableHead className="text-center text-chart-4">SoftOne</TableHead>
                        <TableHead>Είσοδος (εμείς)</TableHead>
                        <TableHead>Είσοδος (ERP)</TableHead>
                        <TableHead>Σημείωση</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gateBook.slice(0, 400).map((r) => (
                        <TableRow key={`gate-${r.plate}`}>
                          <TableCell className="font-mono font-medium">{r.plate}</TableCell>
                          <TableCell className="text-muted-foreground">{r.contract ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            {r.inInventory ? (
                              <CheckCircle2 className="mx-auto size-4 text-chart-2" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.inErp ? (
                              <CheckCircle2 className="mx-auto size-4 text-chart-2" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.ourEntry}
                            {r.source === "ERP_SEED" && (
                              <Badge variant="outline" className="ml-1.5 text-muted-foreground">
                                από απογραφή
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.erpEntry}
                            {r.erpRef && (
                              <span className="ml-1.5 text-xs text-muted-foreground">#{r.erpRef}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.inInventory && !r.inErp && (
                              <span className="inline-flex items-center gap-1 text-chart-5">
                                <AlertTriangle className="size-3" /> δεν είναι στο βιβλίο του ERP
                              </span>
                            )}
                            {!r.inInventory && r.inErp && (
                              <span className="inline-flex items-center gap-1 text-chart-4">
                                <AlertTriangle className="size-3" /> ανοιχτή στο ERP, εκτός απογραφής
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
