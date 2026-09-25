import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page";
import { buildOverrunReport } from "@/lib/contract-overruns";
import { formatWallClock } from "@/lib/parking-time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock, FileDown, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_DAYS = [1, 7, 14, 30] as const;

/** Λεπτά σε ανθρώπινη διάρκεια — οι ώρες κρύβουν τα τετράλεπτα. */
function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}′`;
  const h = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${h}ω` : `${h}ω ${minutes % 60}′`;
}

const hhmm = (d: Date | null) => (d ? formatWallClock(d).slice(6) : "—");

/**
 * Υπερβάσεις συμβάσεων.
 *
 * Δείχνει ΠΟΤΕ μια σύμβαση είχε περισσότερα οχήματα ταυτόχρονα μέσα από τις
 * θέσεις που πληρώνει, με ποια οχήματα και ποιο προκάλεσε την υπέρβαση.
 *
 * Δεν είναι λίστα παραβατών: μια υπέρβαση τριών λεπτών, όταν ένα αυτοκίνητο
 * μπαίνει πριν προλάβει να βγει το άλλο, είναι φυσιολογική. Γι' αυτό
 * εμφανίζεται η διάρκεια δίπλα σε κάθε περιστατικό — εκεί φαίνεται η διαφορά
 * ανάμεσα σε επικάλυψη και σε κατάχρηση.
 */
export default async function OverrunsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const params = await searchParams;
  const requested = Number(params.days);
  const days = (ALLOWED_DAYS as readonly number[]).includes(requested) ? requested : 7;

  const report = await buildOverrunReport(days);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Υπερβάσεις συμβάσεων"
        description="Πότε μια σύμβαση είχε περισσότερα οχήματα ταυτόχρονα μέσα από τις θέσεις της, με ποια και για πόση ώρα."
        icon={TriangleAlert}
      />

      {report.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Το βιβλίο πόρτας δεν διαβάστηκε</AlertTitle>
          <AlertDescription>{report.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Περίοδος</span>
            <div className="flex gap-1.5">
              {ALLOWED_DAYS.map((d) => (
                <a
                  key={d}
                  href={`/overruns?days=${d}`}
                  className={cn(
                    "rounded-md border px-3 py-1 text-sm transition-colors",
                    d === days
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  {d === 1 ? "Σήμερα" : `${d} ημέρες`}
                </a>
              ))}
            </div>
          </CardTitle>
          <CardDescription>
            {formatWallClock(report.from)} — {formatWallClock(report.to)} ·{" "}
            {report.contractsChecked} ενεργές συμβάσεις ελέγχθηκαν
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3">
            <Tile
              label="Συμβάσεις με υπέρβαση"
              value={report.totals.contracts}
              tone={report.totals.contracts ? "bad" : "good"}
            />
            <Tile label="Περιστατικά" value={report.totals.windows} />
            <Tile label="Συνολικός χρόνος" value={duration(report.totals.minutes)} />
          </div>

          {report.totals.amount > 0 && (
            <Alert className="mt-4">
              <AlertCircle />
              <AlertTitle>
                Αν ίσχυε χρέωση υπέρβασης: {report.totals.amount.toFixed(2)} €
              </AlertTitle>
              <AlertDescription>
                Σήμερα τα οχήματα σύμβασης <strong>δεν χρεώνονται ποτέ</strong>, ούτε όταν
                ξεπερνούν τις θέσεις τους. Ο αριθμός υπολογίζεται με τον κανόνα «οι θέσεις
                πιάνονται κατά σειρά άφιξης»: χρεώνεται μόνο το όχημα που περισσεύει, και μόνο
                όσο περισσεύει — μόλις φύγει άλλο, η χρέωση σταματά.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {report.contracts.length === 0 ? (
        <Alert>
          <CheckCircle2 className="text-chart-2" />
          <AlertTitle>Καμία υπέρβαση στην περίοδο</AlertTitle>
          <AlertDescription>
            Καμία σύμβαση δεν είχε περισσότερα οχήματα ταυτόχρονα μέσα από τις θέσεις της.
          </AlertDescription>
        </Alert>
      ) : (
        report.contracts.map((c) => (
          <Card key={c.inst}>
            <CardHeader className="border-b">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">#{c.inst}</span>
                {c.name}
                <Badge variant="destructive">
                  κορύφωση {c.worstPeak}/{c.slots}
                </Badge>
                <a
                  href={`/api/overruns/${c.inst}/evidence?days=${days}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <FileDown className="size-4" aria-hidden />
                  Αποδεικτικό
                </a>
              </CardTitle>
              <CardDescription>
                {c.slots} {c.slots === 1 ? "θέση" : "θέσεις"} · {c.windows.length}{" "}
                {c.windows.length === 1 ? "περιστατικό" : "περιστατικά"} ·{" "}
                {duration(c.totalMinutes)} συνολικά
                {c.chargeableAmount > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground">
                      θα χρεωνόταν {c.chargeableAmount.toFixed(2)} €
                    </span>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ημέρα</TableHead>
                      <TableHead>Ώρες</TableHead>
                      <TableHead>Διάρκεια</TableHead>
                      <TableHead className="text-center">Οχήματα</TableHead>
                      <TableHead>Αιτιολόγηση</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.windows.map((w, i) => (
                      <TableRow key={`${c.inst}-${i}`}>
                        <TableCell className="whitespace-nowrap font-medium">{w.day}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {hhmm(w.start)} – {w.ongoing ? (
                            <span className="font-medium text-chart-5">τώρα</span>
                          ) : (
                            hhmm(w.end)
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {duration(w.minutes)}
                          {w.ongoing && (
                            <Clock className="ml-1 inline size-3 text-chart-5" aria-hidden />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="border-destructive/40 font-mono text-destructive"
                          >
                            {w.peak}/{w.slots}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {w.causedBy ? (
                            <>
                              Το{" "}
                              <span className="font-mono font-medium">{w.causedBy}</span> μπήκε
                              στις {hhmm(w.start)} ενώ ήταν ήδη μέσα{" "}
                              <span className="font-mono">
                                {w.alreadyInside.join(", ") || "—"}
                              </span>
                              .
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Μέσα: {w.plates.join(", ")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {c.chargeable.length > 0 && (
                <div className="border-t bg-muted/30 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Χρεώσιμος χρόνος ανά όχημα
                  </p>
                  <ul className="space-y-1 text-sm">
                    {c.chargeable.map((ch) => (
                      <li key={ch.plate} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-medium">{ch.plate}</span>
                        <span className="text-muted-foreground">
                          {duration(ch.minutes)} πέρα από τις θέσεις
                        </span>
                        <span className="font-medium tabular-nums">{ch.amount.toFixed(2)} €</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "bad";
}) {
  const tones = {
    good: "border-chart-2/30 bg-chart-2/5 text-chart-2",
    bad: "border-destructive/30 bg-destructive/5 text-destructive",
  } as const;
  return (
    <div className={cn("rounded-xl border p-3.5", tone ? tones[tone] : "bg-muted/40")}>
      <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
