"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  CircleParking,
  Clock,
  RefreshCw,
  ShieldOff,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { runDclSync } from "@/lib/actions/dcl";
import { cn } from "@/lib/utils";

export type DclRowDTO = {
  plate: string;
  entry: string;
  exit: string | null;
  minutes: number;
  amount: number;
  kind: "CONTRACT" | "WALK_IN" | "EXEMPT";
  kindLabel: string;
  contractInst: number | null;
  inside: boolean;
  /** PENDING (δεν στάλθηκε) · DRAFT · SENT · COMPLETED · FAILED */
  status: string;
  idDcl: string | null;
  updateId: string | null;
  error: string | null;
};

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  PENDING: { label: "Δεν στάλθηκε", variant: "outline", className: "text-muted-foreground" },
  DRAFT: { label: "Σε εξέλιξη", variant: "secondary" },
  SENT: { label: "Ανοιχτή στην ΑΑΔΕ", variant: "outline", className: "border-chart-4/40 text-chart-4" },
  COMPLETED: { label: "Ολοκληρωμένη", variant: "outline", className: "border-chart-2/40 text-chart-2" },
  FAILED: { label: "Απέτυχε", variant: "destructive" },
};

const KIND_ICON = {
  CONTRACT: FileText,
  WALK_IN: CircleParking,
  EXEMPT: ShieldOff,
} as const;

export function DclClient({
  rows,
  endpoint,
  configured,
  submitEnabled,
}: {
  rows: DclRowDTO[];
  endpoint: string;
  configured: boolean;
  submitEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [lastRun, setLastRun] = useState<string | null>(null);

  const counts = {
    total: rows.length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
    sent: rows.filter((r) => r.status === "SENT").length,
    pending: rows.filter((r) => r.status === "PENDING").length,
    failed: rows.filter((r) => r.status === "FAILED").length,
  };

  function sync() {
    startTransition(async () => {
      const r = await runDclSync();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      const summary =
        `Άνοιξαν ${r.opened} · ολοκληρώθηκαν ${r.completed}` +
        (r.failed ? ` · απέτυχαν ${r.failed}` : "");
      setLastRun(summary);
      if (r.failed > 0) toast.warning(summary);
      else toast.success(summary);
      // Τα μηνύματα σφάλματος της ΑΑΔΕ είναι συγκεκριμένα και χρήσιμα — δεν
      // τα καταπίνουμε σε ένα γενικό «απέτυχε».
      for (const m of r.messages.slice(0, 4)) toast.error(m, { duration: 8000 });
    });
  }

  return (
    <div className="space-y-4">
      {!configured && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Δεν έχουν οριστεί διαπιστευτήρια ΑΑΔΕ</AlertTitle>
          <AlertDescription>
            Χρειάζονται <code>AADE_USER_ID</code> και <code>AADE_SUBSCRIPTION_KEY</code>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Κατάσταση</span>
            <Button onClick={sync} disabled={pending || !configured}>
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              {pending ? "Συγχρονισμός…" : "Συγχρονισμός με ΑΑΔΕ"}
            </Button>
          </CardTitle>
          <CardDescription>
            Περιβάλλον: <code>{endpoint}</code> ·{" "}
            {submitEnabled ? (
              <span className="font-medium text-chart-2">αποστολή ενεργή</span>
            ) : (
              <span className="font-medium text-chart-5">
                αποστολή κλειστή (AADE_DCL_SUBMIT_ENABLED)
              </span>
            )}
            {lastRun && <> · τελευταία εκτέλεση: {lastRun}</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Σταθμεύσεις" value={counts.total} icon={CircleParking} />
            <Stat label="Ολοκληρωμένες" value={counts.completed} icon={CheckCircle2} tone="good" />
            <Stat label="Ανοιχτές στην ΑΑΔΕ" value={counts.sent} icon={Clock} tone="info" />
            <Stat label="Δεν στάλθηκαν" value={counts.pending} icon={AlertCircle} />
            <Stat label="Απέτυχαν" value={counts.failed} icon={AlertCircle} tone={counts.failed ? "bad" : undefined} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Κάμερες έναντι ΑΑΔΕ</CardTitle>
          <CardDescription>
            Οι σταθμεύσεις της ημέρας και όσα οχήματα βρίσκονται μέσα τώρα, με το
            αναγνωριστικό που επέστρεψε η ΑΑΔΕ για καθένα.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πινακίδα</TableHead>
                  <TableHead>Κατηγορία</TableHead>
                  <TableHead>Είσοδος</TableHead>
                  <TableHead>Έξοδος</TableHead>
                  <TableHead className="text-right">Ποσό</TableHead>
                  <TableHead className="border-l">Αναγν. ΑΑΔΕ</TableHead>
                  <TableHead>Κατάσταση</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Καμία στάθμευση σήμερα.
                    </TableCell>
                  </TableRow>
                )}
                {rows.slice(0, 300).map((r, i) => {
                  const meta = STATUS[r.status] ?? STATUS.PENDING;
                  const Icon = KIND_ICON[r.kind];
                  return (
                    <TableRow key={`${r.plate}-${r.entry}-${i}`}>
                      <TableCell className="font-mono font-medium">{r.plate}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Icon className="size-3.5" aria-hidden />
                          {r.kindLabel}
                          {r.contractInst && (
                            <span className="text-xs">#{r.contractInst}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.entry}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.inside ? (
                          <span className="text-chart-2">μέσα · {r.minutes}′</span>
                        ) : (
                          <>
                            {r.exit} <span className="text-muted-foreground">{r.minutes}′</span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.amount > 0 ? `${r.amount.toFixed(2)} €` : "—"}
                      </TableCell>
                      <TableCell className="border-l font-mono text-xs">
                        {r.idDcl ? (
                          <span title={r.updateId ? `ολοκλήρωση ${r.updateId}` : undefined}>
                            {r.idDcl}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className={meta.className} title={r.error ?? undefined}>
                          {meta.label}
                        </Badge>
                        {r.error && (
                          <div className="mt-0.5 max-w-64 truncate text-xs text-destructive">
                            {r.error}
                          </div>
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
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: "good" | "bad" | "info";
}) {
  const tones = {
    good: "border-chart-2/30 bg-chart-2/5 text-chart-2",
    bad: "border-destructive/30 bg-destructive/5 text-destructive",
    info: "border-chart-4/30 bg-chart-4/5 text-chart-4",
  } as const;
  return (
    <div className={cn("rounded-xl border p-3.5", tone ? tones[tone] : "bg-muted/40")}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 opacity-80" aria-hidden />
        <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
      </div>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
