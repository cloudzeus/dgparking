import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowRight, Camera, Clock, Euro, FileX, Scale } from "lucide-react";

/**
 * Σύνοψη αποκλίσεων στο dashboard.
 *
 * Διαβάζει ΜΟΝΟ τη δική μας βάση — καμία κλήση στο SoftOne — ώστε να μην
 * επιβαρύνει τη φόρτωση της αρχικής σελίδας. Τα δεδομένα τα γράφει το cron.
 */

const KINDS = [
  { key: "AMOUNT_DIFF", label: "Διαφορά ποσού", icon: Euro, tone: "text-chart-5" },
  { key: "TIME_DIFF", label: "Διαφορά ώρας", icon: Clock, tone: "text-chart-3" },
  { key: "MISSING_IN_ERP", label: "Λείπει από ERP", icon: FileX, tone: "text-chart-5" },
  { key: "MISSING_IN_CAMERAS", label: "Λείπει από κάμερες", icon: Camera, tone: "text-chart-4" },
] as const;

export async function DeviationSummary() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  // Ένα widget παρακολούθησης δεν επιτρέπεται να ρίξει το dashboard. Αν οι
  // πίνακες λείπουν ή ο Prisma client είναι μπαγιάτικος (π.χ. διεργασία που
  // ξεκίνησε πριν το `prisma generate`), δείχνουμε μήνυμα αντί για σφάλμα.
  let baseline: Awaited<ReturnType<typeof prisma.parkingBaseline.findFirst>> = null;
  let grouped: { kind: string; _count: { _all: number } }[] = [];
  let deltaRow = { _sum: { ourAmount: null as number | null, erpAmount: null as number | null } };

  try {
    [baseline, grouped, deltaRow] = await Promise.all([
      prisma.parkingBaseline.findFirst({ orderBy: { takenAt: "desc" } }),
      prisma.parkingDeviation.groupBy({
        by: ["kind"],
        where: { firstSeenAt: { gte: since }, resolvedAt: null },
        _count: { _all: true },
      }),
      prisma.parkingDeviation.aggregate({
        where: { firstSeenAt: { gte: since }, resolvedAt: null },
        _sum: { ourAmount: true, erpAmount: true },
      }),
    ]);
  } catch (error) {
    console.error("[DEVIATIONS] Η σύνοψη αποκλίσεων δεν φορτώθηκε:", error);
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Η σύνοψη αποκλίσεων δεν φορτώθηκε</AlertTitle>
        <AlertDescription>
          Συνήθως σημαίνει ότι η διεργασία τρέχει με παλιό Prisma client — χρειάζεται
          επανεκκίνηση μετά το <code>prisma generate</code>.
        </AlertDescription>
      </Alert>
    );
  }

  if (!baseline) {
    return (
      <Alert>
        <AlertCircle />
        <AlertTitle>Η παρακολούθηση αποκλίσεων δεν έχει ξεκινήσει</AlertTitle>
        <AlertDescription>
          Δεν έχει ληφθεί ακόμα φωτογραφία της τρέχουσας κατάστασης. Τρέξε τον συντονισμό
          με το ψηφιακό πελατολόγιο για να αρχίσει η καταγραφή.
        </AlertDescription>
      </Alert>
    );
  }

  const counts = new Map(grouped.map((g) => [g.kind, g._count._all]));
  const total = grouped.reduce((s, g) => s + g._count._all, 0);
  const delta =
    Math.round(((deltaRow._sum.ourAmount ?? 0) - (deltaRow._sum.erpAmount ?? 0)) * 100) / 100;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4 text-muted-foreground" />
          Αποκλίσεις τελευταίου 24ώρου
        </CardTitle>
        <CardDescription>
          Κάμερες έναντι ψηφιακού πελατολογίου · συντονισμός{" "}
          {baseline.takenAt.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })}
          {delta !== 0 && (
            <>
              {" · διαφορά τζίρου "}
              <span className="font-medium text-foreground">{delta.toFixed(2)} €</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Καμία νέα απόκλιση. Οι δύο εικόνες συμφωνούν.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {KINDS.map(({ key, label, icon: Icon, tone }) => (
              <Link
                key={key}
                href={`/reconciliation?days=1`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Icon className={`size-5 shrink-0 ${tone}`} />
                <div className="min-w-0">
                  <p className="text-xl font-semibold tabular-nums leading-none">
                    {counts.get(key) ?? 0}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{label}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <Badge variant="outline" className="text-muted-foreground">
            {total} συνολικά
          </Badge>
          <Link
            href="/reconciliation"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Πλήρης αντιπαραβολή
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
