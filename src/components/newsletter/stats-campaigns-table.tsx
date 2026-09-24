"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { InfoPanel, InfoRow, StatusBadge } from "@/components/admin/page";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CampaignRow } from "./stats-types";

const numberFormat = new Intl.NumberFormat("el-GR");
const num = (value: number) => numberFormat.format(value);
const percent = (value: number) => `${value.toLocaleString("el-GR")}%`;

const CAMPAIGN_STATUS: Record<string, { label: string; variant: "success" | "info" | "neutral" | "danger" }> = {
  SENT: { label: "Στάλθηκε", variant: "success" },
  SENDING: { label: "Σε αποστολή", variant: "info" },
  DRAFT: { label: "Πρόχειρο", variant: "neutral" },
  FAILED: { label: "Απέτυχε", variant: "danger" },
};

/** Δευτερεύουσες στήλες κρυμμένες εξ ορισμού — σταθερή αναφορά, όχι νέο αντικείμενο ανά render. */
const HIDDEN_BY_DEFAULT = { ctor: false, complained: false, unsubscribed: false } as const;

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

/** Πίνακας αποστολών με τους αριθμούς και τα ποσοστά, και ανοιχτή γραμμή ανά παραλήπτη. */
export function StatsCampaignsTable({ campaigns }: { campaigns: CampaignRow[] }) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return campaigns;
    return campaigns.filter(
      (c) => c.name.toLowerCase().includes(term) || c.subject.toLowerCase().includes(term),
    );
  }, [campaigns, search]);

  const columns = useMemo<ColumnDef<CampaignRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Αποστολή",
        meta: { label: "Αποστολή", flex: true },
        size: 240,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium" title={row.original.name}>
              {row.original.name}
            </div>
            <div className="truncate text-muted-foreground" title={row.original.subject}>
              {row.original.subject}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Κατάσταση",
        meta: { label: "Κατάσταση" },
        size: 110,
        cell: ({ row }) => {
          const mapped = CAMPAIGN_STATUS[row.original.status];
          return <StatusBadge status={row.original.status} label={mapped?.label} variant={mapped?.variant} />;
        },
      },
      {
        accessorKey: "sentAt",
        header: "Απεστάλη",
        meta: { label: "Απεστάλη" },
        size: 150,
        cell: ({ row }) => <span className="tabular-nums">{dateLabel(row.original.sentAt)}</span>,
      },
      {
        id: "sent",
        header: "Στάλθηκαν",
        meta: { label: "Στάλθηκαν", align: "right" },
        size: 100,
        cell: ({ row }) => <div className="text-right tabular-nums">{num(row.original.stats.sent)}</div>,
      },
      {
        id: "delivered",
        header: "Παραδόθηκαν",
        meta: { label: "Παραδόθηκαν", align: "right" },
        size: 110,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{num(row.original.stats.delivered)}</div>
        ),
      },
      {
        id: "opened",
        header: "Ανοίγματα",
        meta: { label: "Ανοίγματα", align: "right" },
        size: 110,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            <div className="font-semibold text-primary">{num(row.original.stats.openedUnique)}</div>
            <div className="text-muted-foreground">{percent(row.original.stats.openRate)}</div>
          </div>
        ),
      },
      {
        id: "clicked",
        header: "Κλικ",
        meta: { label: "Κλικ", align: "right" },
        size: 110,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            <div className="font-semibold text-primary">{num(row.original.stats.clickedUnique)}</div>
            <div className="text-muted-foreground">{percent(row.original.stats.clickRate)}</div>
          </div>
        ),
      },
      {
        id: "ctor",
        header: "CTOR",
        meta: { label: "Κλικ ανά άνοιγμα (CTOR)", align: "right" },
        size: 90,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{percent(row.original.stats.ctor)}</div>
        ),
      },
      {
        id: "bounced",
        header: "Αποτυχίες",
        meta: { label: "Αποτυχίες", align: "right" },
        size: 100,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{num(row.original.stats.bounced)}</div>
        ),
      },
      {
        id: "complained",
        header: "Παράπονα",
        meta: { label: "Παράπονα", align: "right" },
        size: 100,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{num(row.original.stats.complained)}</div>
        ),
      },
      {
        id: "unsubscribed",
        header: "Διαγραφές",
        meta: { label: "Διαγραφές", align: "right" },
        size: 100,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{num(row.original.stats.unsubscribed)}</div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns as ColumnDef<CampaignRow, unknown>[]}
      data={rows}
      title={`Αποστολές (${num(rows.length)})`}
      searchPlaceholder="Αναζήτηση αποστολής…"
      searchValue={search}
      onSearchChange={setSearch}
      totalItems={rows.length}
      showExport={false}
      fixedLayout
      getRowId={(row) => row.id}
      columnVisibility={HIDDEN_BY_DEFAULT}
      columnVisibilityStorageKey="newsletter-stats-campaigns"
      expandableContent={(campaign) => <CampaignDetail campaign={campaign} />}
    />
  );
}

function CampaignDetail({ campaign }: { campaign: CampaignRow }) {
  const { stats } = campaign;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{campaign.name}</h3>
          <StatusBadge
            status={campaign.status}
            label={CAMPAIGN_STATUS[campaign.status]?.label}
            variant={CAMPAIGN_STATUS[campaign.status]?.variant}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {campaign.subject} · Απεστάλη: {dateLabel(campaign.sentAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPanel title="Παράδοση" accent="bg-chart-1">
          <InfoRow label="Στάλθηκαν">{num(stats.sent)}</InfoRow>
          <InfoRow label="Παραδόθηκαν">{num(stats.delivered)}</InfoRow>
          <InfoRow label="Ποσοστό παράδοσης">{percent(stats.deliveryRate)}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Ανοίγματα" accent="bg-chart-2">
          <InfoRow label="Μοναδικά">{num(stats.openedUnique)}</InfoRow>
          <InfoRow label="Σύνολο">{num(stats.openedTotal)}</InfoRow>
          <InfoRow label="Ποσοστό ανοίγματος">{percent(stats.openRate)}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Κλικ" accent="bg-chart-3">
          <InfoRow label="Μοναδικά">{num(stats.clickedUnique)}</InfoRow>
          <InfoRow label="Σύνολο">{num(stats.clickedTotal)}</InfoRow>
          <InfoRow label="Κλικ ανά άνοιγμα">{percent(stats.ctor)}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Προβλήματα" accent="bg-chart-5">
          <InfoRow label="Αποτυχίες">{num(stats.bounced)}</InfoRow>
          <InfoRow label="Παράπονα">{num(stats.complained)}</InfoRow>
          <InfoRow label="Διαγραφές">{num(stats.unsubscribed)}</InfoRow>
        </InfoPanel>
      </div>

      <div className="rounded-md border bg-card p-3">
        <h4 className="mb-2 text-xs font-semibold">Παραλήπτες</h4>
        {campaign.recipients.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Δεν υπάρχουν καταγεγραμμένοι παραλήπτες για αυτή την αποστολή.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Παράδοση</TableHead>
                <TableHead className="text-right">Ανοίγματα</TableHead>
                <TableHead className="text-right">Κλικ</TableHead>
                <TableHead>Τελευταία δραστηριότητα</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaign.recipients.map((r) => (
                <TableRow key={r.email}>
                  <TableCell className="truncate" title={r.email}>
                    {r.email}
                  </TableCell>
                  <TableCell>
                    {r.failed ? (
                      <Badge variant="danger">Απέτυχε</Badge>
                    ) : r.delivered ? (
                      <Badge variant="success">Παραδόθηκε</Badge>
                    ) : (
                      <Badge variant="neutral">Σε αναμονή</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.opens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.clicks)}</TableCell>
                  <TableCell className="tabular-nums">{dateLabel(r.lastActivity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
