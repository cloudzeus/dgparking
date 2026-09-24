import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { reconcilePeriod, fetchOpenErpStays } from "@/lib/parking-reconcile";
import { formatWallClock, wallClockNow } from "@/lib/parking-time";
import { ReconciliationClient, type ReconRowDTO, type GateRowDTO, type GateStatus } from "@/components/reconciliation/reconciliation-client";
import { prisma } from "@/lib/prisma";
import { getInventory } from "@/lib/parking-inventory";
import { PageHeader } from "@/components/admin/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Scale } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_DAYS = [1, 3, 7, 14] as const;

type PageProps = { searchParams: Promise<{ days?: string }> };

export default async function ReconciliationPage({ searchParams }: PageProps) {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const requested = Number(params?.days);
  const days = (ALLOWED_DAYS as readonly number[]).includes(requested) ? requested : 3;

  const to = wallClockNow();
  const from = new Date(to.getTime() - days * 24 * 3600 * 1000);

  let rows: ReconRowDTO[] = [];
  let gateRows: GateRowDTO[] = [];
  let summary = null;
  let error: string | null = null;

  try {
    const result = await reconcilePeriod(from, to);
    summary = result.summary;
    rows = result.rows.map((r): ReconRowDTO => ({
      plate: r.plate,
      status: r.status,
      explanation: r.explanation,
      ourEntry: formatWallClock(r.ours?.entry ?? null),
      ourExit: r.ours ? formatWallClock(r.ours.exit) : "—",
      ourDuration: r.ours?.durationMinutes ?? null,
      ourAmount: r.ourAmount,
      ourInside: r.ours ? r.ours.exit === null : false,
      ourContract: r.ours?.contractInst ?? null,
      ourMissingExit: r.ours?.missingExit ?? false,
      erpEntry: formatWallClock(r.erp?.entry ?? null),
      erpExit: r.erp ? formatWallClock(r.erp.exit) : "—",
      erpAmount: r.erpAmount,
      erpInside: r.erp ? r.erp.exit === null : false,
      erpContract: r.erp?.inst ?? null,
      erpRef: r.erp?.soaction ?? null,
      erpInvoice: r.erp?.invoiceFindoc ?? 0,
      entryDrift: r.entryDriftMinutes,
      exitDrift: r.exitDriftMinutes,
      pendingMinutes: r.pendingMinutes,
      isRecent: r.isRecent,
      sortKey: (r.ours?.entry ?? r.erp?.entry ?? new Date(0)).toISOString(),
    }));
    // Το βιβλίο πόρτας δεν προκύπτει πια από τα συμβάντα των καμερών αλλά από
    // τη μόνιμη απογραφή — έτσι επιβιώνει ακόμα κι όταν σβηστεί το ιστορικό.
    const [inventory, openStays] = await Promise.all([
      getInventory(),
      // Ανεξάρτητα από το φίλτρο ημερών — αλλιώς ένα όχημα που μπήκε πριν από
      // την περίοδο φαίνεται ψευδώς ότι λείπει από το ERP.
      fetchOpenErpStays(),
    ]);
    const erpOpen = new Map(openStays.map((s) => [s.plate, s]));
    const invByPlate = new Map(inventory.map((i) => [i.plate, i]));
    const plates = new Set([...invByPlate.keys(), ...erpOpen.keys()]);

    // Για όσα το ERP κρατά ανοιχτά ενώ εμείς όχι, η απάντηση είναι συνήθως
    // «τα είδαμε να φεύγουν» — και βρίσκεται στις ολοκληρωμένες σταθμεύσεις.
    const onlyInErp = [...plates].filter((p) => !invByPlate.has(p));
    const recentExits = onlyInErp.length
      ? await prisma.parkingStay.findMany({
          where: { plate: { in: onlyInErp } },
          orderBy: { exitedAt: "desc" },
          select: { plate: true, exitedAt: true },
        })
      : [];
    const lastExit = new Map<string, Date>();
    for (const s of recentExits) if (!lastExit.has(s.plate)) lastExit.set(s.plate, s.exitedAt);

    const now = wallClockNow();
    const minsSince = (d: Date) => Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));

    gateRows = [...plates].map((plate): GateRowDTO => {
      const inv = invByPlate.get(plate) ?? null;
      const erp = erpOpen.get(plate) ?? null;
      const exit = lastExit.get(plate) ?? null;

      let status: GateStatus = "MATCH";
      let note = "";
      let pendingMinutes: number | null = null;

      if (inv && erp) {
        note = "Και οι δύο πλευρές το έχουν μέσα.";
      } else if (inv) {
        // Η προέλευση της εγγραφής μας κρίνει ποιος καθυστερεί. Πέρασμα από
        // κάμερα = είδαμε την είσοδο και το ERP δεν την έχει γράψει ακόμα.
        // Σπορά από το ERP = το ERP την έκλεισε χωρίς να δούμε έξοδο.
        pendingMinutes = minsSince(inv.enteredAt);
        if (inv.source === "CAMERA") {
          status = "ERP_PENDING_ENTRY";
          note = `Μπήκε ${formatWallClock(inv.enteredAt)} από κάμερα — το ERP δεν το έχει καταχωρήσει ακόμα.`;
        } else {
          status = "INVENTORY_STALE";
          note = "Το ERP δεν το έχει πια ανοιχτό, αλλά εμείς δεν είδαμε έξοδο — πιθανή χαμένη λήψη.";
        }
      } else if (erp) {
        if (exit && erp.entry && exit >= erp.entry) {
          status = "ERP_PENDING_EXIT";
          pendingMinutes = minsSince(exit);
          note = `Βγήκε ${formatWallClock(exit)} — το ERP δεν έχει κλείσει ακόμα την εγγραφή.`;
        } else {
          status = "UNSEEN";
          pendingMinutes = erp.entry ? minsSince(erp.entry) : null;
          note = "Ανοιχτό στο ERP χωρίς κανένα πέρασμα από κάμερα.";
        }
      }

      return {
        plate,
        inInventory: inv != null,
        inErp: erp != null,
        ourEntry: formatWallClock(inv?.enteredAt ?? null),
        erpEntry: formatWallClock(erp?.entry ?? null),
        contract: inv?.contractInst ?? erp?.inst ?? null,
        source: inv?.source ?? null,
        erpRef: erp?.soaction ?? null,
        status,
        note,
        pendingMinutes,
      };
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[RECONCILIATION] Η αντιπαραβολή απέτυχε:", e);
    // Το `undefined.findMany` σημαίνει ότι η διεργασία τρέχει με Prisma client
    // παλαιότερο από το σχήμα — τυπικό μετά από `prisma db push` χωρίς restart.
    // Χωρίς αυτή τη διάγνωση το μήνυμα είναι αδιάφανο και τρώει χρόνο.
    error = /Cannot read properties of undefined/.test(message)
      ? "Η διεργασία τρέχει με παλιό Prisma client — χρειάζεται επανεκκίνηση του server μετά το `prisma generate`."
      : message;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Αντιπαραβολή με το ψηφιακό πελατολόγιο"
        description="Σύγκριση των εγγραφών από τις κάμερες με το βιβλίο πόρτας του SoftOne. Μόνο ανάγνωση — η εφαρμογή δεν γράφει στο ERP."
        icon={Scale}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Η αντιπαραβολή δεν ολοκληρώθηκε</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <ReconciliationClient
          rows={rows}
          gateRows={gateRows}
          summary={summary!}
          days={days}
          periodLabel={`${formatWallClock(from)} — ${formatWallClock(to)}`}
        />
      )}
    </div>
  );
}
