"use client";

import { useMemo, useState, useTransition } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import type { DataRequestStatus, DataRequestType } from "@prisma/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  PlayCircle,
  Scale,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader } from "@/components/admin/page";
import {
  DATA_REQUEST_STATUS_LABELS,
  DATA_REQUEST_STATUS_VARIANTS,
  DATA_REQUEST_TYPE_LABELS,
  daysUntil,
  formatAthens,
  formatAthensDate,
} from "@/lib/gdpr-labels";
import { completeDataRequest, rejectDataRequest, startDataRequest } from "@/lib/actions/gdpr";

export interface DataRequestRow {
  id: string;
  email: string;
  fullName: string | null;
  type: DataRequestType;
  status: DataRequestStatus;
  message: string | null;
  verifiedAt: Date | null;
  dueAt: Date | null;
  handledAt: Date | null;
  resolution: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  locale: string | null;
  createdAt: Date;
}

const nf = new Intl.NumberFormat("el-GR");

const ALL = "ALL";

/** Κοντά στην προθεσμία: πέντε μέρες ή λιγότερο. */
const WARNING_DAYS = 5;

const OPEN_STATUSES: DataRequestStatus[] = ["RECEIVED", "VERIFYING", "IN_PROGRESS"];

const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  createdAt: false,
  locale: false,
};

/** Η προθεσμία με χρώμα: εκπρόθεσμο, κοντά στη λήξη, ή εντάξει. */
function DeadlineBadge({ request }: { request: DataRequestRow }) {
  if (!request.dueAt) return <span className="text-muted-foreground">—</span>;
  if (!OPEN_STATUSES.includes(request.status)) {
    return <span className="tabular-nums">{formatAthensDate(request.dueAt)}</span>;
  }

  const remaining = daysUntil(request.dueAt);
  if (remaining === null) return <span className="text-muted-foreground">—</span>;

  if (remaining < 0) {
    return (
      <Badge variant="danger" className="tabular-nums">
        <AlertTriangle aria-hidden />
        Εκπρόθεσμο {nf.format(Math.abs(remaining))} ημ.
      </Badge>
    );
  }

  if (remaining <= WARNING_DAYS) {
    return (
      <Badge variant="warning" className="tabular-nums">
        <Clock aria-hidden />
        {nf.format(remaining)} ημ. ακόμη
      </Badge>
    );
  }

  return <span className="tabular-nums">{formatAthensDate(request.dueAt)}</span>;
}

/**
 * Η ουρά των αιτημάτων άσκησης δικαιωμάτων. Η προθεσμία του ενός μήνα
 * (άρ. 12 §3) είναι το κύριο μέγεθος: ό,τι λήγει μέσα σε πέντε ημέρες ή έχει
 * ήδη περάσει, ξεχωρίζει με χρώμα.
 */
export function RequestsClient({ requests }: { requests: DataRequestRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [dialog, setDialog] = useState<{ request: DataRequestRow; mode: "complete" | "reject" } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const open = requests.filter((row) => OPEN_STATUSES.includes(row.status));
    return {
      open: open.length,
      soon: open.filter((row) => {
        const remaining = daysUntil(row.dueAt);
        return remaining !== null && remaining >= 0 && remaining <= WARNING_DAYS;
      }).length,
      overdue: open.filter((row) => {
        const remaining = daysUntil(row.dueAt);
        return remaining !== null && remaining < 0;
      }).length,
      completed: requests.filter((row) => row.status === "COMPLETED").length,
    };
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((row) => {
      if (status !== ALL && row.status !== status) return false;
      if (type !== ALL && row.type !== type) return false;
      if (!q) return true;
      return [row.email, row.fullName, row.id, row.message].some((field) =>
        field?.toLowerCase().includes(q),
      );
    });
  }, [requests, search, status, type]);

  const runAction = (action: () => Promise<{ success?: true; error?: string }>, done: string) => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(done);
      setDialog(null);
      setNote("");
    });
  };

  const columns = useMemo<ColumnDef<DataRequestRow>[]>(
    () => [
      {
        accessorKey: "email",
        meta: { label: "Αιτών", flex: true },
        header: "Αιτών",
        size: 240,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium" title={row.original.fullName ?? undefined}>
              {row.original.fullName || "Χωρίς όνομα"}
            </div>
            <div className="truncate text-xs text-muted-foreground" title={row.original.email}>
              {row.original.email}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "type",
        meta: { label: "Δικαίωμα" },
        header: "Δικαίωμα",
        size: 220,
        cell: ({ row }) => (
          <span className="truncate" title={DATA_REQUEST_TYPE_LABELS[row.original.type]}>
            {DATA_REQUEST_TYPE_LABELS[row.original.type]}
          </span>
        ),
      },
      {
        accessorKey: "status",
        meta: { label: "Κατάσταση" },
        header: "Κατάσταση",
        size: 170,
        cell: ({ row }) => (
          <Badge variant={DATA_REQUEST_STATUS_VARIANTS[row.original.status]}>
            {DATA_REQUEST_STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "dueAt",
        meta: { label: "Προθεσμία" },
        header: "Προθεσμία",
        size: 180,
        cell: ({ row }) => <DeadlineBadge request={row.original} />,
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Υποβλήθηκε" },
        header: "Υποβλήθηκε",
        size: 160,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatAthens(row.original.createdAt)}</span>
        ),
      },
      {
        accessorKey: "locale",
        meta: { label: "Γλώσσα" },
        header: "Γλώσσα",
        size: 90,
        cell: ({ row }) => <span className="uppercase">{row.original.locale || "—"}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        className="mb-0"
        title="Αιτήματα δικαιωμάτων"
        description="Κάθε αίτημα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού, φορητότητας, εναντίωσης ή ανάκλησης. Η απάντηση οφείλεται εντός ενός μήνα από την επιβεβαίωση του αιτούντος."
        icon={Scale}
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Ανοιχτά"
          value={nf.format(counts.open)}
          hint="περιμένουν ενέργεια"
          icon={Inbox}
          tone="blue"
        />
        <KpiTile
          label="Λήγουν σύντομα"
          value={nf.format(counts.soon)}
          hint="πέντε ημέρες ή λιγότερο"
          icon={Clock}
          tone="amber"
        />
        <KpiTile
          label="Εκπρόθεσμα"
          value={nf.format(counts.overdue)}
          hint="η προθεσμία έχει περάσει"
          icon={AlertTriangle}
          tone="red"
        />
        <KpiTile
          label="Ολοκληρωμένα"
          value={nf.format(counts.completed)}
          hint="απαντήθηκαν στον αιτούντα"
          icon={CheckCircle2}
          tone="green"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="request-search">Αναζήτηση</Label>
            <Input
              id="request-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email, ονοματεπώνυμο ή κωδικός αιτήματος…"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="request-status">Κατάσταση</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="request-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Όλες οι καταστάσεις</SelectItem>
                    {Object.entries(DATA_REQUEST_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="request-type">Δικαίωμα</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="request-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Όλα τα δικαιώματα</SelectItem>
                    {Object.entries(DATA_REQUEST_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {requests.length === 0 ? (
        <EmptyState
          title="Δεν υπάρχουν αιτήματα"
          description="Μόλις κάποιος υποβάλει αίτημα από τη σελίδα «Τα δικαιώματά σας», θα εμφανιστεί εδώ."
          icon={Scale}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Κανένα αίτημα δεν ταιριάζει στα φίλτρα"
          description="Δοκιμάστε άλλη αναζήτηση ή καθαρίστε τα φίλτρα."
          icon={Scale}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatus(ALL);
                setType(ALL);
              }}
            >
              Καθαρισμός φίλτρων
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          title={`${nf.format(filtered.length)} αιτήματα`}
          searchPlaceholder="Email, ονοματεπώνυμο ή κωδικός αιτήματος…"
          searchValue={search}
          onSearchChange={setSearch}
          totalItems={filtered.length}
          pageSize={filtered.length || 1}
          currentPage={1}
          totalPages={1}
          showExport={false}
          getRowId={(row) => row.id}
          columnVisibility={DEFAULT_COLUMN_VISIBILITY}
          fixedLayout
          expandableContent={(request) => (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {request.fullName || "Χωρίς όνομα"}
                </span>
                <Badge variant={DATA_REQUEST_STATUS_VARIANTS[request.status]}>
                  {DATA_REQUEST_STATUS_LABELS[request.status]}
                </Badge>
                <Badge variant="info">{DATA_REQUEST_TYPE_LABELS[request.type]}</Badge>
                <DeadlineBadge request={request} />
              </div>
              <p className="text-xs text-muted-foreground">
                {request.email} · Κωδικός {request.id} · Υποβλήθηκε{" "}
                {formatAthens(request.createdAt)}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {OPEN_STATUSES.includes(request.status) && (
                  <>
                    {request.status !== "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          runAction(() => startDataRequest(request.id), "Το αίτημα είναι σε εξέλιξη")
                        }
                      >
                        <PlayCircle className="size-4" />
                        Σε εξέλιξη
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={request.status === "IN_PROGRESS" ? "default" : "outline"}
                      disabled={isPending}
                      onClick={() => {
                        setNote("");
                        setDialog({ request, mode: "complete" });
                      }}
                    >
                      <CheckCircle2 className="size-4" />
                      Ολοκλήρωση
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive"
                      disabled={isPending}
                      onClick={() => {
                        setNote("");
                        setDialog({ request, mode: "reject" });
                      }}
                    >
                      <XCircle className="size-4" />
                      Απόρριψη
                    </Button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <InfoPanel title="Προθεσμία" accent="bg-chart-3">
                  <InfoRow label="Επιβεβαιώθηκε">{formatAthens(request.verifiedAt)}</InfoRow>
                  <InfoRow label="Λήγει">{formatAthensDate(request.dueAt)}</InfoRow>
                  <InfoRow label="Διεκπεραιώθηκε">{formatAthens(request.handledAt)}</InfoRow>
                </InfoPanel>

                <InfoPanel title="Στοιχεία αιτούντος" accent="bg-chart-1">
                  <InfoRow label="Email" wrap>
                    {request.email}
                  </InfoRow>
                  <InfoRow label="Γλώσσα">{request.locale?.toUpperCase() || "—"}</InfoRow>
                </InfoPanel>

                <InfoPanel title="Απόδειξη υποβολής" accent="bg-chart-2">
                  <InfoRow label="IP" mono>
                    {request.ipAddress || "—"}
                  </InfoRow>
                  <InfoRow label="User agent" wrap>
                    {request.userAgent || "—"}
                  </InfoRow>
                </InfoPanel>

                <InfoPanel title="Διεκπεραίωση" accent="bg-chart-4">
                  <InfoRow label="Σημείωμα" wrap>
                    {request.resolution || "—"}
                  </InfoRow>
                </InfoPanel>
              </div>

              {request.message && (
                <div className="rounded-md border bg-card p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <FileText className="size-3.5" aria-hidden />
                    Τι έγραψε ο αιτών
                  </p>
                  <p className="mt-1 text-xs break-words">{request.message}</p>
                </div>
              )}
            </div>
          )}
        />
      )}

      <Dialog open={dialog !== null} onOpenChange={(next) => !next && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "reject" ? "Απόρριψη αιτήματος" : "Ολοκλήρωση αιτήματος"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "reject"
                ? "Γράψτε γιατί απορρίπτεται. Ο αιτών δικαιούται να μάθει τον λόγο (άρ. 12 §4)."
                : "Γράψτε τι ακριβώς έγινε. Το σημείωμα στέλνεται αυτούσιο στον αιτούντα."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolution">Σημείωμα διεκπεραίωσης</Label>
            <Textarea
              id="resolution"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Π.χ. Στάλθηκε αντίγραφο των δεδομένων σε αρχείο CSV στη διεύθυνση του αιτούντος."
              className="min-h-28"
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={isPending}>
              Ακύρωση
            </Button>
            <Button
              variant={dialog?.mode === "reject" ? "destructive" : "default"}
              disabled={isPending || !dialog}
              onClick={() => {
                if (!dialog) return;
                const { request, mode } = dialog;
                runAction(
                  () =>
                    mode === "reject"
                      ? rejectDataRequest(request.id, note)
                      : completeDataRequest(request.id, note),
                  mode === "reject" ? "Το αίτημα απορρίφθηκε" : "Το αίτημα ολοκληρώθηκε",
                );
              }}
            >
              {dialog?.mode === "reject" ? "Απόρριψη" : "Ολοκλήρωση και αποστολή"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
