import { redirect } from "next/navigation";
import { unstable_noStore } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page";
import { DclClient, type DclRowDTO } from "@/components/dcl/dcl-client";
import { formatWallClock, wallClockNow } from "@/lib/parking-time";
import { getExemptPlates } from "@/lib/exempt-plates";
import { isSubmitEnabled, loadDclConfig } from "@/lib/dcl/client";
import { describeKind, type CustomerKind } from "@/lib/dcl/policy";
import { fetchErpStays } from "@/lib/parking-reconcile";
import { fetchInvoiceLinks } from "@/lib/dcl/invoice-links";
import { FileCheck2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Ψηφιακό Πελατολόγιο — ζωντανή αντιπαράθεση.
 *
 * Αριστερά ό,τι είδαν οι κάμερες, δεξιά ό,τι γνωρίζει η ΑΑΔΕ. Η σελίδα
 * δείχνει ΚΑΙ τις σταθμεύσεις που δεν έχουν σταλεί ακόμα, γιατί το κενό
 * είναι η πληροφορία: μια στάθμευση χωρίς αναγνωριστικό ΑΑΔΕ είναι είτε
 * εκκρεμότητα είτε αποτυχία, και τα δύο θέλουν μάτι.
 */
export default async function DclPage() {
  unstable_noStore();
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const now = wallClockNow();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [inside, stays, records, exempt] = await Promise.all([
    prisma.parkingInventory.findMany({ orderBy: { enteredAt: "desc" } }),
    prisma.parkingStay.findMany({
      where: { exitedAt: { gte: dayStart } },
      orderBy: { exitedAt: "desc" },
    }),
    prisma.dclRecord.findMany({ orderBy: { enteredAt: "desc" }, take: 500 }),
    getExemptPlates(now),
  ]);

  // ── Παραστατικά ─────────────────────────────────────────────────────────
  // Το βιβλίο πόρτας του ERP κρατά το FINDOC της απόδειξης· ο σύνδεσμος ζει
  // στο MTRDOC. Μια αποτυχία εδώ δεν πρέπει να ρίξει τη σελίδα — τα
  // παραστατικά είναι συμπλήρωμα, η αντιπαράθεση είναι ο λόγος που υπάρχει.
  const invoiceByPlateEntry = new Map<string, { code: string | null; url: string }>();
  try {
    const erpStays = await fetchErpStays(dayStart, now);
    const links = await fetchInvoiceLinks(erpStays.map((s) => s.invoiceFindoc));
    for (const s of erpStays) {
      const link = links.get(s.invoiceFindoc);
      if (link && s.entry) {
        invoiceByPlateEntry.set(`${s.plate}|${s.entry.toISOString()}`, {
          code: link.code,
          url: link.url,
        });
      }
    }
  } catch (error) {
    console.error("[DCL] Τα παραστατικά δεν διαβάστηκαν:", error);
  }

  /**
   * Το παραστατικό μιας στάθμευσης.
   *
   * Η ώρα εισόδου του ERP και η δική μας διαφέρουν κατά λεπτά, οπότε η
   * αντιστοίχιση γίνεται με ανοχή αντί για ακριβές ταίριασμα — αλλιώς
   * σχεδόν καμία γραμμή δεν θα έβρισκε το παραστατικό της.
   */
  const invoiceFor = (plate: string, entry: Date) => {
    const exact = invoiceByPlateEntry.get(`${plate}|${entry.toISOString()}`);
    if (exact) return exact;
    for (const [key, value] of invoiceByPlateEntry) {
      const [p, iso] = key.split("|");
      if (p !== plate) continue;
      if (Math.abs(new Date(iso).getTime() - entry.getTime()) <= 10 * 60_000) return value;
    }
    return null;
  };

  const byKey = new Map(records.map((r) => [r.stayKey, r]));
  const key = (plate: string, entry: Date) => `${plate}|${entry.toISOString()}`;
  const kindOf = (plate: string, inst: number | null): CustomerKind =>
    exempt.has(plate) ? "EXEMPT" : inst != null ? "CONTRACT" : "WALK_IN";

  const rows: DclRowDTO[] = [];

  for (const s of stays) {
    const r = byKey.get(key(s.plate, s.enteredAt));
    rows.push({
      plate: s.plate,
      entry: formatWallClock(s.enteredAt),
      exit: formatWallClock(s.exitedAt),
      minutes: s.minutes,
      amount: s.amount ?? 0,
      kind: kindOf(s.plate, s.contractInst),
      kindLabel: describeKind(kindOf(s.plate, s.contractInst)),
      contractInst: s.contractInst,
      inside: false,
      status: r?.status ?? "PENDING",
      idDcl: r?.idDcl != null ? String(r.idDcl) : null,
      updateId: r?.updateId != null ? String(r.updateId) : null,
      error: r?.error ?? null,
      invoice: invoiceFor(s.plate, s.enteredAt),
    });
  }

  for (const i of inside) {
    const r = byKey.get(key(i.plate, i.enteredAt));
    rows.push({
      plate: i.plate,
      entry: formatWallClock(i.enteredAt),
      exit: null,
      minutes: Math.max(0, Math.round((now.getTime() - i.enteredAt.getTime()) / 60000)),
      amount: 0,
      kind: kindOf(i.plate, i.contractInst),
      kindLabel: describeKind(kindOf(i.plate, i.contractInst)),
      contractInst: i.contractInst,
      inside: true,
      status: r?.status ?? "PENDING",
      idDcl: r?.idDcl != null ? String(r.idDcl) : null,
      updateId: r?.updateId != null ? String(r.updateId) : null,
      error: r?.error ?? null,
      invoice: invoiceFor(i.plate, i.enteredAt),
    });
  }

  const config = loadDclConfig();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ψηφιακό Πελατολόγιο ΑΑΔΕ"
        description="Ζωντανή αντιπαράθεση: αριστερά οι κάμερες, δεξιά η ΑΑΔΕ. Τρέχει παράλληλα με το SoftOne, στο δοκιμαστικό περιβάλλον."
        icon={FileCheck2}
      />
      <DclClient
        rows={rows}
        endpoint={config?.baseUrl ?? "—"}
        configured={config != null}
        submitEnabled={isSubmitEnabled()}
      />
    </div>
  );
}
