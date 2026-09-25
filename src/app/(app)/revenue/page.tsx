import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page";
import { buildRevenueOverview } from "@/lib/revenue-overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DonutChart, ChartCard } from "@/components/admin/charts/charts";
import {
  AlertCircle,
  CheckCircle2,
  CircleParking,
  Coins,
  FileText,
  ShieldOff,
  TrendingUp,
  Scale,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWallClock } from "@/lib/parking-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Λεπτά σε ανθρώπινη διάρκεια — οι ώρες κρύβουν τα τετράλεπτα. */
function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}′`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return minutes % 60 === 0 ? `${h}ω` : `${h}ω ${minutes % 60}′`;
  const d = Math.floor(h / 24);
  return h % 24 === 0 ? `${d} ημέρες` : `${d} ημ. ${h % 24}ω`;
}

const eur = (n: number) =>
  `${n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Έσοδα — δύο νούμερα που δεν αθροίζονται.
 *
 * Οι συμβάσεις είναι μηνιαία υποχρέωση, το ταμείο ημερήσια είσπραξη.
 * Προστιθέμενα βγάζουν νούμερο που δεν αντιστοιχεί σε τίποτα πραγματικό.
 * Γι' αυτό ζουν σε ξεχωριστές κάρτες, με δική τους περίοδο η καθεμία.
 */
export default async function RevenuePage() {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const r = await buildRevenueOverview();
  const cashDiff = r.today.ourCharges - r.today.alp.total;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Έσοδα"
        description="Τι συμβαίνει τώρα, τι αναμένεται, και τι παραστατικά κόπηκαν. Οι συμβάσεις του μήνα και το ταμείο της ημέρας μετρώνται χωριστά."
        icon={TrendingUp}
      />

      {r.error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Τα παραστατικά δεν διαβάστηκαν</AlertTitle>
          <AlertDescription>{r.error}</AlertDescription>
        </Alert>
      )}

      {/* ── Τώρα στον χώρο ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Τώρα στον χώρο</CardTitle>
            <CardDescription>
              Από τη ζωντανή απογραφή, ανά κατηγορία πελάτη.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Σύνολο" value={r.inside.total} icon={CircleParking} tone="brand" />
              <Tile label="Συμβάσεις" value={r.inside.contract} icon={FileText} />
              <Tile label="Απλοί πελάτες" value={r.inside.walkIn} icon={Coins} />
              <Tile label="Απαλλαγές" value={r.inside.exempt} icon={ShieldOff} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Αναμένονται</CardTitle>
            <CardDescription>
              Ελεύθερες θέσεις συμβάσεων. Μετριέται σε θέσεις, όχι σε πινακίδες — κάθε θέση
              δέχεται έως τρεις δηλωμένες αλλά ένα αυτοκίνητο τη φορά.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-4xl font-bold tabular-nums leading-none">{r.expected.free}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              από {r.expected.slots} θέσεις συνολικά · {r.expected.occupied} κατειλημμένες
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--chart-1)]"
                style={{
                  width: `${r.expected.slots ? Math.round((r.expected.occupied / r.expected.slots) * 100) : 0}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Ταμείο ημέρας ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" aria-hidden />
            Ταμείο ημέρας
          </CardTitle>
          <CardDescription>
            Μόνο οι απλοί πελάτες — οι συμβασιούχοι δεν πληρώνουν στην έξοδο και οι απαλλαγές
            δεν πληρώνουν καθόλου.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Money
              label="Δικός μας υπολογισμός"
              value={eur(r.today.ourCharges)}
              hint={`${r.today.walkInStays} στάσεις`}
            />
            <Money
              label="ΑΛΠ που κόπηκαν"
              value={eur(r.today.alp.total)}
              hint={`${r.today.alp.count} παραστατικά`}
            />
            <Money label="Εισπράξεις" value={eur(r.today.collections)} />
            <Money
              label="Διαφορά"
              value={eur(cashDiff)}
              tone={Math.abs(cashDiff) < 0.01 ? "good" : "bad"}
              hint={
                Math.abs(cashDiff) < 0.01
                  ? "συμφωνούν"
                  : cashDiff > 0
                    ? "δεν τιμολογήθηκε"
                    : "τιμολογήθηκε περισσότερο"
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Από πού προκύπτει η διαφορά ─────────────────────────────────── */}
      {(r.today.breakdown.stays.length > 0 || r.today.breakdown.docs.length > 0) && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Scale className="size-4" aria-hidden />
              Από πού προκύπτει η διαφορά
            </CardTitle>
            <CardDescription>
              Κάθε στάση απλού πελάτη δίπλα στο παραστατικό της. Τα ΑΛΠ κόβονται όλα στον
              ίδιο γενικό πελάτη, οπότε δεν υπάρχει πινακίδα να συγκριθεί — το ταίριασμα
              γίνεται στο ποσό. Ό,τι μένει αταίριαστο στις δύο στήλες είναι η διαφορά.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 lg:grid-cols-2">
            {/* Οι στάσεις μας */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Στάσεις που χρεώσαμε
              </p>
              {r.today.breakdown.stays.length === 0 ? (
                <p className="text-sm text-muted-foreground">Καμία στάση απλού πελάτη σήμερα.</p>
              ) : (
                r.today.breakdown.stays.map((s) => (
                  <div
                    key={`${s.plate}-${s.exitedAt.toISOString()}`}
                    className={cn(
                      "rounded-lg border p-3",
                      s.matched ? "bg-muted/30" : "border-destructive/40 bg-destructive/5"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{s.plate}</span>
                      <span className="text-sm font-medium tabular-nums">{eur(s.amount)}</span>
                      {s.matched ? (
                        <Badge variant="outline" className="font-normal">
                          {s.matched}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">χωρίς παραστατικό</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {formatWallClock(s.enteredAt)} – {formatWallClock(s.exitedAt)} ·{" "}
                      {duration(s.minutes)}
                    </p>
                    {(s.photoIn || s.photoOut) && (
                      <div className="mt-2 flex gap-2">
                        {([["Είσοδος", s.photoIn], ["Έξοδος", s.photoOut]] as const).map(
                          ([label, url]) =>
                            url ? (
                              <a
                                key={label}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group"
                                title={`${s.plate} — ${label}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt={`${s.plate} — ${label}`}
                                  loading="lazy"
                                  className="h-24 w-auto rounded-md border object-cover transition-opacity group-hover:opacity-80"
                                />
                              </a>
                            ) : (
                              <div
                                key={label}
                                className="flex h-24 w-32 items-center justify-center rounded-md border bg-muted/40 text-xs text-muted-foreground"
                              >
                                {label}: χωρίς φωτογραφία
                              </div>
                            )
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Τα παραστατικά */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ΑΛΠ που κόπηκαν
              </p>
              {r.today.breakdown.docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Κανένα ΑΛΠ σήμερα.</p>
              ) : (
                r.today.breakdown.docs.map((d) => (
                  <div
                    key={d.code}
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-lg border p-3",
                      d.matched ? "bg-muted/30" : "border-destructive/40 bg-destructive/5"
                    )}
                  >
                    <span className="font-mono text-sm font-semibold">{d.code}</span>
                    <span className="text-sm font-medium tabular-nums">{eur(d.amount)}</span>
                    {d.matched ? (
                      <Badge variant="outline" className="font-mono font-normal">
                        {d.matched}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">χωρίς αντίστοιχη στάση</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Συμβάσεις μήνα ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <FileText className="size-4" aria-hidden />
              Συμβάσεις — {r.month.label}
            </CardTitle>
            <CardDescription>
              Μηνιαία υποχρέωση, ξεχωριστά από το ταμείο. Δεν τιμολογούνται όλες με ΤΠΥ: οι
              εταιρείες παίρνουν τιμολόγιο, οι ιδιώτες συνήθως απόδειξη.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Ενεργές συμβάσεις" value={r.month.activeContracts} icon={FileText} />
              <Money label="Αξία ΤΠΥ" value={eur(r.month.tpy.total)} hint={`${r.month.tpy.count} τιμολόγια`} />
              <Tile label="Με ΤΠΥ" value={r.month.byCoverage["ΤΠΥ"]} icon={CheckCircle2} tone="good" />
              <Tile label="Με ΑΛΠ" value={r.month.byCoverage["ΑΛΠ"]} icon={CheckCircle2} tone="good" />
            </div>

            {r.month.uncovered.length > 0 ? (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-2 text-sm font-semibold text-destructive">
                  {r.month.uncovered.length} συμβάσεις χωρίς κανένα παραστατικό
                </p>
                <ul className="space-y-1 text-sm">
                  {r.month.uncovered.slice(0, 12).map((u) => (
                    <li key={u.inst} className="text-muted-foreground">
                      <span className="font-mono">#{u.inst}</span> {u.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Alert className="mt-4">
                <CheckCircle2 className="text-chart-2" />
                <AlertTitle>Κάθε ενεργή σύμβαση έχει παραστατικό</AlertTitle>
                <AlertDescription>
                  Καμία σύμβαση δεν έμεινε χωρίς τιμολόγιο ή απόδειξη αυτόν τον μήνα.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <ChartCard title="Πώς καλύπτονται" description="Ανά τύπο παραστατικού.">
          <DonutChart
            data={[
              { key: "tpy", label: "Τιμολόγιο", value: r.month.byCoverage["ΤΠΥ"] },
              { key: "alp", label: "Απόδειξη", value: r.month.byCoverage["ΑΛΠ"] },
              { key: "mix", label: "Μικτό", value: r.month.byCoverage["ΜΙΚΤΟ"] },
              { key: "none", label: "Κανένα", value: r.month.byCoverage["ΚΑΝΕΝΑ"] },
            ].filter((d) => d.value > 0)}
            centerLabel="συμβάσεις"
          />
        </ChartCard>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: "good" | "brand";
}) {
  const tones = {
    good: "border-chart-2/30 bg-chart-2/5 text-chart-2",
    brand: "border-chart-1/30 bg-chart-1/5 text-chart-1",
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

function Money({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  const tones = {
    good: "border-chart-2/30 bg-chart-2/5",
    bad: "border-destructive/30 bg-destructive/5",
  } as const;
  return (
    <div className={cn("rounded-xl border p-3.5", tone ? tones[tone] : "bg-muted/40")}>
      <p className="text-xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
