"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, XCircle } from "lucide-react";

interface SyncProgressModalProps {
  open: boolean;
  status: "idle" | "syncing" | "completed" | "error";
  progress?: {
    synced: number;
    skipped: number;
    total: number;
    current?: number;
  };
  error?: string;
}

/** Μία μέτρηση του συγχρονισμού — ίδιο ύφος και στις τρεις καταστάσεις. */
function SyncStat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-md border bg-card p-2 text-center">
      <div
        className={
          tone === "success"
            ? "text-lg font-semibold tabular-nums text-green-700 dark:text-green-400"
            : tone === "warning"
              ? "text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400"
              : "text-lg font-semibold tabular-nums text-muted-foreground"
        }
      >
        {value.toLocaleString("el-GR")}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function SyncProgressModal({
  open,
  status,
  progress,
  error,
}: SyncProgressModalProps) {
  const progressPercentage =
    progress && progress.total > 0
      ? Math.round(((progress.synced + progress.skipped) / progress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" showCloseButton={status !== "syncing"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === "syncing" && (
              <>
                <Spinner />
                Συγχρονισμός πελατών από το ERP
              </>
            )}
            {status === "completed" && "Ο συγχρονισμός ολοκληρώθηκε"}
            {status === "error" && "Ο συγχρονισμός απέτυχε"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {status === "syncing" && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Επεξεργασία πελατών…</span>
                  {progress && progress.total > 0 && (
                    <span className="tabular-nums">
                      {(progress.synced + progress.skipped).toLocaleString("el-GR")} / {progress.total.toLocaleString("el-GR")}
                    </span>
                  )}
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {progress && (
                <div className="grid grid-cols-3 gap-2">
                  <SyncStat label="Νέοι" value={progress.synced} tone="success" />
                  <SyncStat label="Παραλείφθηκαν" value={progress.skipped} tone="warning" />
                  <SyncStat label="Σύνολο" value={progress.total} />
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Ο συγχρονισμός με το SoftOne ERP εκτελείται — μην κλείσετε το παράθυρο.
              </p>
            </>
          )}

          {status === "completed" && progress && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-2">
                <CheckCircle2 className="size-10 text-green-600 dark:text-green-400" aria-hidden />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <SyncStat label="Νέοι" value={progress.synced} tone="success" />
                <SyncStat label="Παραλείφθηκαν" value={progress.skipped} tone="warning" />
                <SyncStat label="Σύνολο" value={progress.total} />
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Ο συγχρονισμός ολοκληρώθηκε με επιτυχία.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-2">
                <XCircle className="size-10 text-destructive" aria-hidden />
              </div>

              <p className="text-center text-xs text-destructive">
                {error || "Παρουσιάστηκε σφάλμα κατά τον συγχρονισμό."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
