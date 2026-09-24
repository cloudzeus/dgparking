"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InfoPanel, InfoRow, StatusBadge, EmptyState } from "@/components/admin/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ExternalLink, Play, RotateCcw, Save, Timer } from "lucide-react";
import { toast } from "sonner";
import {
  SCHEDULE_PRESETS,
  WEEKDAYS_EL,
  describeCron,
  isValidCronExpression,
  type SchedulePresetId,
  type SyncHealth,
} from "@/lib/cron-schedule";
import {
  restartAllCronJobs,
  runIntegrationNow,
  setIntegrationActive,
  updateIntegrationSchedule,
} from "@/lib/actions/settings-cron";

export type CronLastRun = {
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
};

export type CronIntegrationRow = {
  id: string;
  name: string;
  objectName: string;
  tableName: string;
  tableCaption: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncAgo: string;
  cronExpression: string | null;
  scheduleLabel: string;
  presetSchedule: string | null;
  scheduleTime: string | null;
  scheduleDay: string | null;
  scheduleType: "preset" | "custom";
  health: SyncHealth;
  /** Η εργασία υπάρχει όντως στη μνήμη της διεργασίας που εξυπηρετεί τη σελίδα. */
  isRegistered: boolean;
  lastRun: CronLastRun | null;
};

export type CronRuntimeStatus = {
  totalJobs: number;
  jobIds: string[];
  isInitialized: boolean;
};

const HEALTH_VARIANT: Record<SyncHealth["state"], "success" | "warning" | "danger" | "neutral" | "info"> = {
  ok: "success",
  overdue: "warning",
  never: "danger",
  inactive: "neutral",
  unscheduled: "danger",
  unknown: "info",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

export function CronSettingsClient({
  integrations,
  runtime,
}: {
  integrations: CronIntegrationRow[];
  runtime: CronRuntimeStatus;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CronIntegrationRow | null>(null);

  const problems = useMemo(
    () => integrations.filter((row) => row.health.state === "overdue" || row.health.state === "never" || row.health.state === "unscheduled"),
    [integrations]
  );

  const runNow = (row: CronIntegrationRow) => {
    setPendingId(row.id);
    startTransition(async () => {
      const result = await runIntegrationNow(row.id);
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Ο συγχρονισμός ολοκληρώθηκε.");
      setPendingId(null);
      router.refresh();
    });
  };

  const toggleActive = (row: CronIntegrationRow, next: boolean) => {
    setPendingId(row.id);
    startTransition(async () => {
      const result = await setIntegrationActive(row.id, next);
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Αποθηκεύτηκε.");
      setPendingId(null);
      router.refresh();
    });
  };

  const restartAll = () => {
    setPendingId("__all__");
    startTransition(async () => {
      const result = await restartAllCronJobs();
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Οι εργασίες επαναπρογραμματίστηκαν.");
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          Κάθε προγραμματισμένη εργασία συγχρονισμού με το SoftOne: πότε τρέχει, πότε έτρεξε τελευταία
          φορά και τι απέγινε.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isPending} title="Σταματά και ξαναδηλώνει όλες τις εργασίες">
              {isPending && pendingId === "__all__" ? <Spinner data-icon="inline-start" /> : <RotateCcw aria-hidden />}
              Επανεκκίνηση όλων
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Επανεκκίνηση όλων των εργασιών;</AlertDialogTitle>
              <AlertDialogDescription>
                Όλες οι εργασίες σταματούν και δηλώνονται ξανά από την αρχή, με βάση το πρόγραμμα που
                είναι αποθηκευμένο. Ένας συγχρονισμός που τρέχει αυτή τη στιγμή μπορεί να διακοπεί.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
              <AlertDialogAction onClick={restartAll}>Επανεκκίνηση</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {problems.length === 1
              ? "Μία εργασία δηλώνει ότι είναι ενεργή αλλά δεν τρέχει"
              : `${problems.length.toLocaleString("el-GR")} εργασίες δηλώνουν ότι είναι ενεργές αλλά δεν τρέχουν`}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {problems.map((row) => (
                <li key={row.id}>
                  <span className="font-medium">{row.name}</span> — {row.health.hint}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <InfoPanel
        title="Κατάσταση διεργασίας"
        accent={runtime.isInitialized ? "bg-chart-2" : "bg-chart-3"}
      >
        <InfoRow label="Αρχικοποίηση">
          <StatusBadge
            variant={runtime.isInitialized ? "success" : "warning"}
            label={runtime.isInitialized ? "Έγινε" : "Δεν έχει γίνει"}
          />
        </InfoRow>
        <InfoRow label="Δηλωμένες εργασίες">
          {runtime.totalJobs.toLocaleString("el-GR")} από{" "}
          {integrations.filter((i) => i.isActive).length.toLocaleString("el-GR")} ενεργές ενσωματώσεις
        </InfoRow>
        <InfoRow label="Σημείωση">
          Ο αριθμός αφορά μόνο τη διεργασία που εξυπηρετεί αυτή τη σελίδα. Αν η εφαρμογή τρέχει σε
          πολλές διεργασίες, κάθε μία έχει τις δικές της εργασίες στη μνήμη της.
        </InfoRow>
      </InfoPanel>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Timer className="size-4 text-primary" aria-hidden />
            Προγραμματισμένες εργασίες
          </CardTitle>
          <CardDescription>
            Η στήλη «Υγεία» συγκρίνει τον τελευταίο συγχρονισμό με τη συχνότητα της ίδιας της εργασίας.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <EmptyState
              icon={Timer}
              title="Καμία ενσωμάτωση"
              description="Δεν υπάρχει καμία ενσωμάτωση SoftOne, άρα ούτε προγραμματισμένη εργασία."
              action={
                <Button variant="outline" asChild>
                  <Link href="/integrations">Ενσωματώσεις</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ενσωμάτωση</TableHead>
                  <TableHead>Πρόγραμμα</TableHead>
                  <TableHead>Ενεργή</TableHead>
                  <TableHead>Τελευταίος συγχρονισμός</TableHead>
                  <TableHead>Τελευταία εκτέλεση</TableHead>
                  <TableHead>Υγεία</TableHead>
                  <TableHead className="text-right">Ενέργειες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((row) => {
                  const busy = isPending && pendingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-0">
                        <div className="truncate font-medium" title={row.name}>
                          {row.name}
                        </div>
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {row.objectName} › {row.tableName}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <div>{row.scheduleLabel}</div>
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {row.cronExpression ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.isActive}
                          disabled={busy}
                          onCheckedChange={(checked) => toggleActive(row, checked)}
                          aria-label={`Ενεργή ενσωμάτωση — ${row.name}`}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div>{formatDateTime(row.lastSyncAt)}</div>
                        <div className="text-xs text-muted-foreground">{row.lastSyncAgo}</div>
                      </TableCell>
                      <TableCell className="min-w-0">
                        {row.lastRun ? (
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={row.lastRun.status} />
                            <span className="truncate text-xs text-muted-foreground" title={row.lastRun.error ?? undefined}>
                              {formatDateTime(row.lastRun.startedAt)}
                              {row.lastRun.error ? ` — ${row.lastRun.error}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Χωρίς ιστορικό</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-0">
                        <Badge variant={HEALTH_VARIANT[row.health.state]}>{row.health.label}</Badge>
                        {!row.isRegistered && row.isActive && (
                          <div className="mt-1 text-xs text-muted-foreground">Δεν είναι δηλωμένη στη μνήμη</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setEditing(row)}
                            title="Αλλαγή προγράμματος"
                          >
                            Πρόγραμμα
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => runNow(row)}
                            title="Εκτέλεση συγχρονισμού τώρα"
                          >
                            {busy ? <Spinner data-icon="inline-start" /> : <Play aria-hidden />}
                            Εκτέλεση τώρα
                          </Button>
                          <Button size="sm" variant="ghost" asChild title="Άνοιγμα ενσωμάτωσης">
                            <Link href={`/integrations?integration=${row.id}`}>
                              <ExternalLink aria-hidden />
                              <span className="sr-only">Άνοιγμα ενσωμάτωσης</span>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ScheduleDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/** Ο επεξεργαστής προγράμματος μιας εργασίας: έτοιμη συχνότητα ή δική σου έκφραση cron. */
function ScheduleDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CronIntegrationRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        {row && <ScheduleForm key={row.id} row={row} onSaved={onSaved} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({
  row,
  onSaved,
  onClose,
}: {
  row: CronIntegrationRow;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<"preset" | "custom">(row.scheduleType);
  const [preset, setPreset] = useState<SchedulePresetId>(
    (row.presetSchedule as SchedulePresetId | null) ?? "hourly"
  );
  const [time, setTime] = useState(row.scheduleTime ?? "09:00");
  const [day, setDay] = useState(row.scheduleDay ?? "1");
  const [custom, setCustom] = useState(row.cronExpression ?? "0 * * * *");
  const [isPending, startTransition] = useTransition();

  // Οι παλιές συχνότητες δεν προσφέρονται σε νέα επιλογή, αλλά μένουν ορατές
  // όσο τις χρησιμοποιεί η ίδια η ενσωμάτωση.
  const presetOptions = useMemo(
    () => SCHEDULE_PRESETS.filter((item) => !item.legacy || item.id === preset),
    [preset]
  );

  const customValid = type === "preset" || isValidCronExpression(custom);
  const needsTime = type === "preset" && (preset === "daily" || preset === "weekly");
  const needsDay = type === "preset" && preset === "weekly";

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateIntegrationSchedule(undefined, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Το πρόγραμμα αποθηκεύτηκε.");
      onSaved();
    });
  };

  return (
    <form action={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Πρόγραμμα — {row.name}</DialogTitle>
        <DialogDescription>
          Ορίστε πόσο συχνά συγχρονίζεται η ενσωμάτωση. Η εργασία επαναπρογραμματίζεται αμέσως μετά την
          αποθήκευση.
        </DialogDescription>
      </DialogHeader>

      <input type="hidden" name="integrationId" value={row.id} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="presetSchedule" value={type === "preset" ? preset : ""} />
      <input type="hidden" name="scheduleTime" value={needsTime ? time : ""} />
      <input type="hidden" name="scheduleDay" value={needsDay ? day : ""} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="schedule-type">Τρόπος ορισμού</Label>
        <Select
          value={type}
          onValueChange={(value) => setType(value === "custom" ? "custom" : "preset")}
          disabled={isPending}
        >
          <SelectTrigger id="schedule-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="preset">Έτοιμη συχνότητα</SelectItem>
              <SelectItem value="custom">Δική μου έκφραση cron</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {type === "preset" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="schedule-preset">Συχνότητα</Label>
            <Select
              value={preset}
              onValueChange={(value) => setPreset(value as SchedulePresetId)}
              disabled={isPending}
            >
              <SelectTrigger id="schedule-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {presetOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {needsTime && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-time">Ώρα</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={isPending}
                className="tabular-nums"
              />
            </div>
          )}

          {needsDay && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-day">Ημέρα</Label>
              <Select value={day} onValueChange={setDay} disabled={isPending}>
                <SelectTrigger id="schedule-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {WEEKDAYS_EL.map((label, index) => (
                      <SelectItem key={label} value={String(index)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-cron">Έκφραση cron</Label>
          <Input
            id="schedule-cron"
            name="cronExpression"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="0 9 * * 1"
            disabled={isPending}
            aria-invalid={!customValid}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Πέντε πεδία: λεπτό ώρα ημέρα μήνας ημέρα-εβδομάδας. Σημαίνει: {describeCron(custom)}.
          </p>
          {!customValid && (
            <p className="text-xs text-destructive">Η έκφραση δεν είναι έγκυρη.</p>
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Ακύρωση
        </Button>
        <Button type="submit" disabled={isPending || !customValid}>
          {isPending ? <Spinner data-icon="inline-start" /> : <Save aria-hidden />}
          Αποθήκευση
        </Button>
      </DialogFooter>
    </form>
  );
}
