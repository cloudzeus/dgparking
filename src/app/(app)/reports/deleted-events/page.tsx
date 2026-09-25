import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page";
import { formatWallClock } from "@/lib/parking-time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_DAYS = [1, 7, 14, 30] as const;

type ArchivedImage = { url: string; imageType: string };

/** Η προτίμηση εικόνας: ολόκληρο πλάνο πρώτα, μετά το στιγμιότυπο, μετά η πινακίδα. */
const IMAGE_ORDER = ["FULL_IMAGE", "SNAPSHOT", "PLATE_IMAGE"];

function orderImages(raw: unknown): ArchivedImage[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return (raw as ArchivedImage[])
    .filter((i) => {
      if (!i?.url || seen.has(i.url)) return false;
      seen.add(i.url);
      return true;
    })
    .sort((a, b) => IMAGE_ORDER.indexOf(a.imageType) - IMAGE_ORDER.indexOf(b.imageType));
}

/** Η ημέρα σε τοπική γραφή, για ομαδοποίηση και τίτλο. */
const dayKey = (d: Date) => formatWallClock(d).slice(0, 5);
const hhmm = (d: Date) => formatWallClock(d).slice(6);

/**
 * Διαγραφές συμβάντων αναγνώρισης.
 *
 * Η διαγραφή είναι καθημερινή και απαραίτητη — η κάμερα πιάνει πεζούς, σκιές
 * και φορτηγά χωρίς ορατή πινακίδα. Είναι όμως και η μόνη ενέργεια που
 * αφαιρεί όχημα από την απογραφή και στάση με χρέωση.
 *
 * Γι' αυτό η αναφορά δείχνει τη φωτογραφία δίπλα σε κάθε διαγραφή: χωρίς
 * αυτήν, «διαγράφηκε πεζός» και «διαγράφηκε πελάτης που πλήρωνε» διαβάζονται
 * ολόιδια.
 */
export default async function DeletedEventsPage({
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

  const from = new Date(Date.now() - days * 24 * 3600 * 1000);
  const rows = await prisma.deletedRecognitionEvent.findMany({
    where: { deletedAt: { gte: from } },
    orderBy: { deletedAt: "desc" },
  });

  // Ομαδοποίηση ανά ημέρα διαγραφής.
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = dayKey(r.deletedAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(r);
  }

  const withDerived = rows.filter((r) => r.inventoryGone > 0 || r.staysGone > 0);
  const byUser = new Map<string, number>();
  for (const r of rows) {
    const k = r.deletedBy ?? "—";
    byUser.set(k, (byUser.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Διαγραφές συμβάντων"
        description="Ποια περάσματα διαγράφηκαν, από ποιον και τι πήραν μαζί τους — με τη φωτογραφία της κάμερας."
        icon={Trash2}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Περίοδος</span>
            <div className="flex gap-1.5">
              {ALLOWED_DAYS.map((d) => (
                <a
                  key={d}
                  href={`/reports/deleted-events?days=${d}`}
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
            {formatWallClock(from)} έως τώρα
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Διαγραφές" value={rows.length} />
            <Tile
              label="Αφαίρεσαν όχημα ή στάση"
              value={withDerived.length}
              tone={withDerived.length ? "bad" : "good"}
            />
            <Tile label="Ημέρες με διαγραφές" value={byDay.size} />
          </div>

          {byUser.size > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Από:</span>
              {[...byUser.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([who, n]) => (
                  <Badge key={who} variant="outline" className="font-normal">
                    {who} · {n}
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Alert>
          <CheckCircle2 className="text-chart-2" />
          <AlertTitle>Καμία διαγραφή στην περίοδο</AlertTitle>
          <AlertDescription>
            Οι διαγραφές καταγράφονται από τη στιγμή που ενεργοποιήθηκε το αρχείο· ό,τι
            σβήστηκε νωρίτερα δεν άφησε ίχνος.
          </AlertDescription>
        </Alert>
      ) : (
        [...byDay.entries()].map(([day, items]) => (
          <Card key={day}>
            <CardHeader className="border-b">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {day}
                <Badge variant="outline">
                  {items.length} {items.length === 1 ? "διαγραφή" : "διαγραφές"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {items.map((r) => {
                const images = orderImages(r.images);
                return (
                  <div key={r.id} className="space-y-2.5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{r.plate}</span>
                      {r.direction && (
                        <Badge variant="outline">
                          {r.direction === "IN" ? "Είσοδος" : "Έξοδος"}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        πέρασμα {formatWallClock(r.recognitionTime)}
                      </span>
                      {r.vehicleType && (
                        <Badge variant="outline" className="font-normal">
                          {r.vehicleType}
                        </Badge>
                      )}
                      {r.junk && (
                        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                          μη αναγνώσιμη
                        </Badge>
                      )}
                      {(r.inventoryGone > 0 || r.staysGone > 0) && (
                        <Badge variant="destructive">
                          {r.inventoryGone > 0 && `−${r.inventoryGone} από απογραφή`}
                          {r.inventoryGone > 0 && r.staysGone > 0 && " · "}
                          {r.staysGone > 0 && `−${r.staysGone} ${r.staysGone === 1 ? "στάση" : "στάσεις"}`}
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {r.deletedBy ?? "—"} · {hhmm(r.deletedAt)}
                      </span>
                    </div>

                    {images.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Το συμβάν δεν είχε φωτογραφία.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {images.map((img) => (
                          <a
                            key={img.url}
                            href={img.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group"
                            title={img.imageType}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={`${r.plate} — ${img.imageType}`}
                              loading="lazy"
                              className="h-28 w-auto rounded-md border object-cover transition-opacity group-hover:opacity-80"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
