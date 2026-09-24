"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, MailCheck, MailX, Plus, Search, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader, StatusBadge } from "@/components/admin/page";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Spinner } from "@/components/ui/spinner";
import { SUBSCRIBER_STATUS_LABEL, SUBSCRIBER_STATUS_VARIANT } from "@/lib/newsletter";
import { addSubscriber, unsubscribeSubscriber, type NewsletterFormState } from "@/lib/actions/newsletter";

export type SubscriberRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  locale: string;
  status: string;
  source: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  campaignCount: number;
};

export type SubscriberStats = {
  total: number;
  subscribed: number;
  pending: number;
  unsubscribed: number;
};

const PAGE_SIZE = 50;
const DEFAULT_COLUMNS = { locale: false, confirmedAt: false };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

function fullName(row: SubscriberRow) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ");
}

/** Εξαγωγή CSV με ελληνικές κεφαλίδες — ανοίγει σωστά στο Excel (BOM). */
function exportCsv(rows: SubscriberRow[]) {
  const header = ["Email", "Όνομα", "Επώνυμο", "Κατάσταση", "Γλώσσα", "Πηγή", "Επιβεβαίωση", "Εγγραφή"];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = rows.map((row) =>
    [
      row.email,
      row.firstName ?? "",
      row.lastName ?? "",
      SUBSCRIBER_STATUS_LABEL[row.status] ?? row.status,
      row.locale,
      row.source ?? "",
      row.confirmedAt ? formatDate(row.confirmedAt) : "",
      formatDate(row.createdAt),
    ]
      .map((value) => escape(String(value)))
      .join(";"),
  );

  const csv = `﻿${header.map(escape).join(";")}\n${lines.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SubscribersClient({
  subscribers,
  stats,
}: {
  subscribers: SubscriberRow[];
  stats: SubscriberStats;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const [removeState, removeAction] = useActionState<NewsletterFormState | undefined, FormData>(
    unsubscribeSubscriber,
    undefined,
  );

  /** Η προσθήκη κλείνει τον διάλογο μόνη της, γι' αυτό καλεί απευθείας το action. */
  async function handleAdd(formData: FormData) {
    setIsAdding(true);
    try {
      const result = await addSubscriber(undefined, formData);
      setAddErrors(result.fieldErrors ?? {});
      if (result.success) {
        toast.success(result.success);
        setAddOpen(false);
        router.refresh();
      }
      if (result.error) toast.error(result.error);
    } finally {
      setIsAdding(false);
    }
  }

  useEffect(() => {
    if (removeState?.success) {
      toast.success(removeState.success);
      router.refresh();
    }
    if (removeState?.error) toast.error(removeState.error);
  }, [removeState, router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subscribers.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (!term) return true;
      return row.email.toLowerCase().includes(term) || fullName(row).toLowerCase().includes(term);
    });
  }, [subscribers, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: ColumnDef<SubscriberRow>[] = [
    {
      accessorKey: "email",
      header: "Συνδρομητής",
      size: 260,
      meta: { label: "Συνδρομητής", flex: true },
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium" title={row.original.email}>
            {row.original.email}
          </span>
          <span className="block truncate text-muted-foreground">{fullName(row.original) || "—"}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Κατάσταση",
      size: 150,
      meta: { label: "Κατάσταση" },
      cell: ({ row }) => (
        <StatusBadge
          variant={SUBSCRIBER_STATUS_VARIANT[row.original.status] ?? "neutral"}
          label={SUBSCRIBER_STATUS_LABEL[row.original.status] ?? row.original.status}
        />
      ),
    },
    {
      accessorKey: "source",
      header: "Πηγή",
      size: 120,
      meta: { label: "Πηγή" },
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.source ?? "—"}</span>,
    },
    {
      accessorKey: "locale",
      header: "Γλώσσα",
      size: 90,
      meta: { label: "Γλώσσα" },
      cell: ({ row }) => <span>{row.original.locale === "en" ? "Αγγλικά" : "Ελληνικά"}</span>,
    },
    {
      accessorKey: "campaignCount",
      header: "Δελτία",
      size: 90,
      meta: { label: "Δελτία", align: "right" },
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.campaignCount.toLocaleString("el-GR")}</div>
      ),
    },
    {
      accessorKey: "confirmedAt",
      header: "Επιβεβαίωση",
      size: 160,
      meta: { label: "Επιβεβαίωση" },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.confirmedAt)}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Εγγραφή",
      size: 160,
      meta: { label: "Εγγραφή" },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.createdAt)}</span>,
    },
  ];

  const expandableContent = (subscriber: SubscriberRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{subscriber.email}</span>
        <StatusBadge
          variant={SUBSCRIBER_STATUS_VARIANT[subscriber.status] ?? "neutral"}
          label={SUBSCRIBER_STATUS_LABEL[subscriber.status] ?? subscriber.status}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Εγγραφή {formatDate(subscriber.createdAt)} · Πηγή {subscriber.source ?? "—"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {subscriber.status !== "UNSUBSCRIBED" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive">
                <UserMinus aria-hidden />
                Διαγραφή από τη λίστα
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Διαγραφή του συνδρομητή;</AlertDialogTitle>
                <AlertDialogDescription>
                  Ο/Η {subscriber.email} δεν θα λαμβάνει πια δελτία. Η ανάκληση καταγράφεται στο αρχείο
                  συγκαταθέσεων — η εγγραφή δεν σβήνεται.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <button type="submit" form={`remove-subscriber-${subscriber.id}`}>
                    Διαγραφή
                  </button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPanel title="Στοιχεία" accent="bg-chart-1">
          <InfoRow label="Όνομα">{fullName(subscriber) || "—"}</InfoRow>
          <InfoRow label="Γλώσσα">{subscriber.locale === "en" ? "Αγγλικά" : "Ελληνικά"}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Συγκατάθεση" accent="bg-chart-2">
          <InfoRow label="Επιβεβαίωση">{formatDate(subscriber.confirmedAt)}</InfoRow>
          <InfoRow label="Διαγραφή">{formatDate(subscriber.unsubscribedAt)}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Αποστολές" accent="bg-chart-3">
          <InfoRow label="Δελτία">{subscriber.campaignCount.toLocaleString("el-GR")}</InfoRow>
          <InfoRow label="Πηγή" mono>
            {subscriber.source ?? "—"}
          </InfoRow>
        </InfoPanel>
        <InfoPanel title="Αναγνωριστικά" accent="bg-chart-4">
          <InfoRow label="Κωδικός" mono>
            {subscriber.id}
          </InfoRow>
        </InfoPanel>
      </div>

      <form id={`remove-subscriber-${subscriber.id}`} action={removeAction} className="hidden">
        <input type="hidden" name="id" value={subscriber.id} />
      </form>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Συνδρομητές"
        description="Ποιος λαμβάνει το ενημερωτικό δελτίο, από πού ήρθε και πότε έδωσε τη συγκατάθεσή του."
        icon={Users}
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
              <Download aria-hidden />
              Εξαγωγή CSV
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus aria-hidden />
                  Νέος συνδρομητής
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Προσθήκη συνδρομητή</DialogTitle>
                  <DialogDescription>
                    Χειροκίνητη προσθήκη — χρησιμοποίησέ την μόνο όταν έχεις απόδειξη συγκατάθεσης
                    (π.χ. έντυπη φόρμα). Η ενέργεια καταγράφεται στο αρχείο συγκαταθέσεων.
                  </DialogDescription>
                </DialogHeader>
                <form action={handleAdd} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="subscriber-email">Email *</Label>
                    <Input id="subscriber-email" name="email" type="email" required disabled={isAdding} />
                    {addErrors.email && <p className="text-xs text-destructive">{addErrors.email}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="subscriber-firstName">Όνομα</Label>
                      <Input id="subscriber-firstName" name="firstName" disabled={isAdding} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="subscriber-lastName">Επώνυμο</Label>
                      <Input id="subscriber-lastName" name="lastName" disabled={isAdding} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="subscriber-locale">Γλώσσα</Label>
                    <Select name="locale" defaultValue="el" disabled={isAdding}>
                      <SelectTrigger id="subscriber-locale">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="el">Ελληνικά</SelectItem>
                          <SelectItem value="en">Αγγλικά</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isAdding}>
                      {isAdding && <Spinner data-icon="inline-start" />}
                      Προσθήκη
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Σύνολο"
          value={stats.total.toLocaleString("el-GR")}
          hint="Όλες οι εγγραφές"
          icon={Users}
          tone="blue"
        />
        <KpiTile
          label="Εγγεγραμμένοι"
          value={stats.subscribed.toLocaleString("el-GR")}
          hint="Λαμβάνουν δελτία"
          icon={MailCheck}
          tone="green"
        />
        <KpiTile
          label="Εκκρεμείς"
          value={stats.pending.toLocaleString("el-GR")}
          hint="Δεν επιβεβαίωσαν ακόμη"
          icon={MailX}
          tone="amber"
        />
        <KpiTile
          label="Διαγραμμένοι"
          value={stats.unsubscribed.toLocaleString("el-GR")}
          hint="Ανακάλεσαν τη συγκατάθεση"
          icon={UserMinus}
          tone="red"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subscriber-search">Αναζήτηση</Label>
            <div className="relative">
              <Search
                className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="subscriber-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Email ή όνομα…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subscriber-status">Κατάσταση</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="subscriber-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Όλες</SelectItem>
                    <SelectItem value="SUBSCRIBED">Εγγεγραμμένοι</SelectItem>
                    <SelectItem value="PENDING">Εκκρεμεί επιβεβαίωση</SelectItem>
                    <SelectItem value="UNSUBSCRIBED">Διαγραμμένοι</SelectItem>
                    <SelectItem value="BOUNCED">Μη παραδοτέα</SelectItem>
                    <SelectItem value="COMPLAINED">Καταγγελίες</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="Κανένας συνδρομητής"
          description="Δεν βρέθηκε εγγραφή με αυτά τα φίλτρα."
          icon={Users}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          fixedLayout
          getRowId={(row) => row.id}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          showExport
          onExport={() => exportCsv(filtered)}
          expandableContent={expandableContent}
          columnVisibility={DEFAULT_COLUMNS}
        />
      )}
    </div>
  );
}
