"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { CampaignStats } from "./stats-types";

const numberFormat = new Intl.NumberFormat("el-GR");

/**
 * Η πορεία ενός ενημερωτικού δελτίου: στάλθηκαν → παραδόθηκαν → άνοιξαν →
 * έκλικαραν. Μπάρες προόδου (`Progress`), όχι γράφημα.
 */
export function StatsFunnel({ stats }: { stats: CampaignStats }) {
  const base = stats.sent > 0 ? stats.sent : stats.delivered;

  const steps = [
    { label: "Στάλθηκαν", value: stats.sent, accent: "bg-chart-1" },
    { label: "Παραδόθηκαν", value: stats.delivered, accent: "bg-chart-2" },
    { label: "Άνοιξαν", value: stats.openedUnique, accent: "bg-chart-3" },
    { label: "Έκλικαραν", value: stats.clickedUnique, accent: "bg-chart-4" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Πορεία αποστολής</CardTitle>
        <CardDescription>Πόσοι παραλήπτες έφτασαν σε κάθε βήμα.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.map((step) => {
          const percent = base > 0 ? Math.min(100, Math.round((step.value / base) * 1000) / 10) : 0;
          return (
            <div key={step.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", step.accent)} aria-hidden />
                  <span className="truncate">{step.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {numberFormat.format(step.value)} · {percent.toLocaleString("el-GR")}%
                </span>
              </div>
              <Progress value={percent} aria-label={`${step.label}: ${percent}%`} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
