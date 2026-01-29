"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Loader2 } from "lucide-react";

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
      <DialogContent className="max-w-md" showCloseButton={status !== "syncing"}>
        <DialogHeader>
          <DialogTitle className="uppercase text-sm font-bold flex items-center gap-2">
            {status === "syncing" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "syncing" && "SYNCING CUSTOMERS FROM ERP"}
            {status === "completed" && "SYNC COMPLETED"}
            {status === "error" && "SYNC FAILED"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === "syncing" && (
            <>
              <div className="flex items-center justify-center py-4">
                <Spinner className="h-8 w-8 text-violet-500" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processing customers...</span>
                  {progress && progress.total > 0 && (
                    <span>
                      {progress.synced + progress.skipped} / {progress.total}
                    </span>
                  )}
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {progress && (
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="text-center">
                    <div className="text-lg font-bold text-violet-600">
                      {progress.synced}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Synced
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-600">
                      {progress.skipped}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Skipped
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-muted-foreground">
                      {progress.total}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Total
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                Please wait while we sync customers from SoftOne ERP...
              </p>
            </>
          )}

          {status === "completed" && progress && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg
                    className="h-8 w-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {progress.synced}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Synced
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">
                    {progress.skipped}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Skipped
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-muted-foreground">
                    {progress.total}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Total
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Sync completed successfully!
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg
                    className="h-8 w-8 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>

              <p className="text-xs text-center text-red-600">
                {error || "An error occurred during sync"}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}









