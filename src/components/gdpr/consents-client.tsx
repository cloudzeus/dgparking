"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import type { ConsentAction, ConsentType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader } from "@/components/admin/page";
import { BarChart3, CheckCircle2, FileText, ShieldCheck, XCircle } from "lucide-react";
import {
  CONSENT_ACTION_LABELS,
  CONSENT_TYPE_LABELS,
  formatAthens,
} from "@/lib/gdpr-labels";

export interface ConsentRow {
  id: string;
  email: string | null;
  type: ConsentType;
  action: ConsentAction;
  consentText: string | null;
  policyVersion: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sourceUrl: string | null;
  locale: string | null;
  method: string | null;
  createdAt: Date;
}

const nf = new Intl.NumberFormat("el-GR");

const ALL = "ALL";

/** Δευτερεύουσες στήλες: ο πίνακας χωρά σε 1440px χωρίς οριζόντια κύλιση. */
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  policyVersion: false,
  locale: false,
};

function csvCell(value: string | null | undefined): string {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Το αρχείο συγκαταθέσεων (άρ. 7 §1): ποιος, πότε, τι κείμενο είχε μπροστά
 * του και από ποια IP. Εδώ — και μόνο εδώ — φαίνονται IP και συσκευή.
 */
export function ConsentsClient({ consents }: { consents: ConsentRow[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);

  const counts = useMemo(
    () => ({
      total: consents.length,
      granted: consents.filter((row) => row.action === "GRANTED").length,
      withdrawn: consents.filter((row) => row.action === "WITHDRAWN").length,
      cookies: consents.filter(
        (row) => row.type === "COOKIES_ANALYTICS" || row.type === "COOKIES_MARKETING",
      ).length,
    }),
    [consents],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consents.filter((row) => {
      if (type !== ALL && row.type !== type) return false;
      if (action !== ALL && row.action !== action) return false;
      if (!q) return true;
      return [row.email, row.ipAddress, row.method, row.consentText].some((field) =>
        field?.toLowerCase().includes(q),
      );
    });
  }, [consents, search, type, action]);

  const exportCsv = () => {
    const header = [
      "Ημερομηνία",
      "Email",
      "Τύπος",
      "Ενέργεια",
      "Μέθοδος",
      "Έκδοση πολιτικής",
      "Γλώσσα",
      "IP",
      "Σελίδα",
      "Κείμενο συγκατάθεσης",
      "Συσκευή",
    ];

    const lines = filtered.map((row) =>
      [
        formatAthens(row.createdAt),
        row.email,
        CONSENT_TYPE_LABELS[row.type],
        CONSENT_ACTION_LABELS[row.action],
        row.method,
        row.policyVersion,
        row.locale,
        row.ipAddress,
        row.sourceUrl,
        row.consentText,
        row.userAgent,
      ]
        .map(csvCell)
        .join(";"),
    );

    // BOM ώστε το Excel να διαβάσει σωστά τα ελληνικά.
    const blob = new Blob(["﻿", [header.map(csvCell).join(";"), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sygkatatheseis-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = useMemo<ColumnDef<ConsentRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        meta: { label: "Ημερομηνία" },
        header: "Ημερομηνία",
        size: 160,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatAthens(row.original.createdAt)}</span>
        ),
      },
      {
        accessorKey: "email",
        meta: { label: "Email", flex: true },
        header: "Email",
        size: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate" title={row.original.email ?? undefined}>
              {row.original.email || "—"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {row.original.method || "—"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "type",
        meta: { label: "Τύπος" },
        header: "Τύπος",
        size: 180,
        cell: ({ row }) => (
          <span className="truncate" title={CONSENT_TYPE_LABELS[row.original.type]}>
            {CONSENT_TYPE_LABELS[row.original.type]}
          </span>
        ),
      },
      {
        accessorKey: "action",
        meta: { label: "Ενέργεια" },
        header: "Ενέργεια",
        size: 120,
        cell: ({ row }) => (
          <Badge variant={row.original.action === "GRANTED" ? "success" : "neutral"}>
            {CONSENT_ACTION_LABELS[row.original.action]}
          </Badge>
        ),
      },
      {
        accessorKey: "ipAddress",
        meta: { label: "IP" },
        header: "IP",
        size: 140,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.ipAddress || "—"}</span>
        ),
      },
      {
        accessorKey: "policyVersion",
        meta: { label: "Έκδοση πολιτικής" },
        header: "Έκδοση πολιτικής",
        size: 140,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.policyVersion || "—"}</span>
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
        title="Αρχείο συγκαταθέσεων"
        description="Κάθε συγκατάθεση και κάθε ανάκληση, με το ακριβές κείμενο που είδε ο χρήστης, την ώρα, την IP και τη συσκευή. Οι εγγραφές δεν αλλάζουν ποτέ — η ανάκληση γράφει νέα γραμμή."
        icon={ShieldCheck}
        actions={
          <Button variant="outline" onClick={exportCsv} title="Εξαγωγή των γραμμών του φίλτρου">
            <FileText className="size-4" />
            Εξαγωγή CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Σύνολο εγγραφών"
          value={nf.format(counts.total)}
          hint="οι πιο πρόσφατες πρώτες"
          icon={ShieldCheck}
          tone="blue"
        />
        <KpiTile
          label="Δόθηκαν"
          value={nf.format(counts.granted)}
          hint="ενεργές συγκαταθέσεις"
          icon={CheckCircle2}
          tone="green"
        />
        <KpiTile
          label="Ανακλήθηκαν"
          value={nf.format(counts.withdrawn)}
          hint="ο χρήστης πήρε πίσω τη συγκατάθεση"
          icon={XCircle}
          tone="amber"
        />
        <KpiTile
          label="Cookies"
          value={nf.format(counts.cookies)}
          hint="στατιστικά και μάρκετινγκ"
          icon={BarChart3}
          tone="violet"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consent-search">Αναζήτηση</Label>
            <Input
              id="consent-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email, IP, μέθοδος ή κείμενο συγκατάθεσης…"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consent-type">Τύπος</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="consent-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Όλοι οι τύποι</SelectItem>
                    {Object.entries(CONSENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consent-action">Ενέργεια</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="consent-action" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Όλες οι ενέργειες</SelectItem>
                    {Object.entries(CONSENT_ACTION_LABELS).map(([value, label]) => (
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

      {consents.length === 0 ? (
        <EmptyState
          title="Δεν υπάρχουν καταγεγραμμένες συγκαταθέσεις"
          description="Μόλις κάποιος επισκέπτης δηλώσει τις προτιμήσεις cookie ή υποβάλει φόρμα, η εγγραφή θα εμφανιστεί εδώ."
          icon={ShieldCheck}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Καμία εγγραφή δεν ταιριάζει στα φίλτρα"
          description="Δοκιμάστε άλλη αναζήτηση ή καθαρίστε τα φίλτρα."
          icon={ShieldCheck}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setType(ALL);
                setAction(ALL);
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
          title={`${nf.format(filtered.length)} εγγραφές`}
          searchPlaceholder="Email, IP, μέθοδος ή κείμενο συγκατάθεσης…"
          searchValue={search}
          onSearchChange={setSearch}
          totalItems={filtered.length}
          pageSize={filtered.length || 1}
          currentPage={1}
          totalPages={1}
          showExport
          onExport={exportCsv}
          getRowId={(row) => row.id}
          columnVisibility={DEFAULT_COLUMN_VISIBILITY}
          fixedLayout
          expandableContent={(row) => (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{row.email || "Χωρίς διεύθυνση"}</span>
                <Badge variant="info">{CONSENT_TYPE_LABELS[row.type]}</Badge>
                <Badge variant={row.action === "GRANTED" ? "success" : "neutral"}>
                  {CONSENT_ACTION_LABELS[row.action]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatAthens(row.createdAt)} · Κωδικός {row.id}
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <InfoPanel title="Απόδειξη" accent="bg-chart-1">
                  <InfoRow label="Μέθοδος">{row.method || "—"}</InfoRow>
                  <InfoRow label="Έκδοση πολιτικής" mono>
                    {row.policyVersion || "—"}
                  </InfoRow>
                  <InfoRow label="Γλώσσα">{row.locale?.toUpperCase() || "—"}</InfoRow>
                </InfoPanel>

                <InfoPanel title="Προέλευση" accent="bg-chart-2">
                  <InfoRow label="IP" mono>
                    {row.ipAddress || "—"}
                  </InfoRow>
                  <InfoRow label="Σελίδα" wrap>
                    {row.sourceUrl || "—"}
                  </InfoRow>
                </InfoPanel>

                <InfoPanel title="Συσκευή" accent="bg-chart-3">
                  <InfoRow label="User agent" wrap>
                    {row.userAgent || "—"}
                  </InfoRow>
                </InfoPanel>
              </div>

              <div className="rounded-md border bg-card p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Το κείμενο που είδε ο χρήστης
                </p>
                <p className="mt-1 text-xs break-words">{row.consentText || "—"}</p>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
