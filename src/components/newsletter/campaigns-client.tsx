"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Mail, Plus, Search, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader, StatusBadge } from "@/components/admin/page";
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
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT } from "@/lib/newsletter";
import { newsletterTemplateLabel } from "@/emails/newsletters";
import { deleteCampaign, type NewsletterFormState } from "@/lib/actions/newsletter";

export type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  template: string;
  status: string;
  locale: string;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
};

export type CampaignStats = {
  campaigns: number;
  subscribers: number;
  sent: number;
  drafts: number;
};

const PAGE_SIZE = 25;

/** Σταθερή αναφορά: ο πίνακας τη διαβάζει ως αρχική ορατότητα στηλών. */
const DEFAULT_COLUMNS = { createdAt: false, failedCount: false };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

export function CampaignsClient({ campaigns, stats }: { campaigns: CampaignRow[]; stats: CampaignStats }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [template, setTemplate] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [deleteState, deleteAction] = useActionState<NewsletterFormState | undefined, FormData>(
    deleteCampaign,
    undefined,
  );

  useEffect(() => {
    if (deleteState?.success) {
      toast.success(deleteState.success);
      router.refresh();
    }
    if (deleteState?.error) toast.error(deleteState.error);
  }, [deleteState, router]);

  const templates = useMemo(
    () => Array.from(new Set(campaigns.map((campaign) => campaign.template))),
    [campaigns],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (status !== "all" && campaign.status !== status) return false;
      if (template !== "all" && campaign.template !== template) return false;
      if (!term) return true;
      return (
        campaign.name.toLowerCase().includes(term) ||
        campaign.subject.toLowerCase().includes(term) ||
        (campaign.preheader ?? "").toLowerCase().includes(term)
      );
    });
  }, [campaigns, search, status, template]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const columns: ColumnDef<CampaignRow>[] = [
    {
      accessorKey: "name",
      header: "Εκστρατεία",
      size: 280,
      meta: { label: "Εκστρατεία", flex: true },
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/newsletter/${row.original.id}`} className="block truncate font-medium hover:underline">
            {row.original.name}
          </Link>
          <span className="block truncate text-muted-foreground" title={row.original.subject}>
            {row.original.subject}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "template",
      header: "Πρότυπο",
      size: 170,
      meta: { label: "Πρότυπο" },
      cell: ({ row }) => <span className="truncate">{newsletterTemplateLabel(row.original.template)}</span>,
    },
    {
      accessorKey: "status",
      header: "Κατάσταση",
      size: 130,
      meta: { label: "Κατάσταση" },
      cell: ({ row }) => (
        <StatusBadge
          variant={CAMPAIGN_STATUS_VARIANT[row.original.status] ?? "neutral"}
          label={CAMPAIGN_STATUS_LABEL[row.original.status] ?? row.original.status}
        />
      ),
    },
    {
      accessorKey: "totalRecipients",
      header: "Παραλήπτες",
      size: 110,
      meta: { label: "Παραλήπτες", align: "right" },
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.totalRecipients.toLocaleString("el-GR")}</div>
      ),
    },
    {
      accessorKey: "failedCount",
      header: "Αποτυχίες",
      size: 100,
      meta: { label: "Αποτυχίες", align: "right" },
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.failedCount.toLocaleString("el-GR")}</div>
      ),
    },
    {
      accessorKey: "sentAt",
      header: "Αποστολή",
      size: 160,
      meta: { label: "Αποστολή" },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.sentAt)}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Δημιουργία",
      size: 160,
      meta: { label: "Δημιουργία" },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.createdAt)}</span>,
    },
  ];

  const expandableContent = (campaign: CampaignRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{campaign.name}</span>
        <StatusBadge
          variant={CAMPAIGN_STATUS_VARIANT[campaign.status] ?? "neutral"}
          label={CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Δημιουργήθηκε {formatDate(campaign.createdAt)} · Πρότυπο{" "}
        {newsletterTemplateLabel(campaign.template)} · Γλώσσα {campaign.locale === "en" ? "Αγγλικά" : "Ελληνικά"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/newsletter/${campaign.id}`}>
            {campaign.status === "SENT" ? "Προβολή" : "Επεξεργασία"}
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/newsletter/stats">Στατιστικά</Link>
        </Button>
        {campaign.status !== "SENT" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive">
                <Trash2 aria-hidden />
                Διαγραφή
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Διαγραφή της εκστρατείας;</AlertDialogTitle>
                <AlertDialogDescription>
                  Η εκστρατεία «{campaign.name}» θα διαγραφεί οριστικά. Η ενέργεια δεν αναιρείται.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
                <AlertDialogAction asChild>
                  <button type="submit" form={`delete-campaign-${campaign.id}`}>
                    Διαγραφή
                  </button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPanel title="Μήνυμα" accent="bg-chart-1">
          <InfoRow label="Θέμα" wrap>
            {campaign.subject}
          </InfoRow>
          <InfoRow label="Προεπισκόπηση" wrap>
            {campaign.preheader || "—"}
          </InfoRow>
        </InfoPanel>
        <InfoPanel title="Αποστολή" accent="bg-chart-2">
          <InfoRow label="Ημερομηνία">{formatDate(campaign.sentAt)}</InfoRow>
          <InfoRow label="Παραλήπτες">{campaign.totalRecipients.toLocaleString("el-GR")}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Αποτέλεσμα" accent={campaign.failedCount > 0 ? "bg-chart-5" : "bg-chart-3"}>
          <InfoRow label="Παραδόθηκαν">{campaign.deliveredCount.toLocaleString("el-GR")}</InfoRow>
          <InfoRow label="Αποτυχίες">{campaign.failedCount.toLocaleString("el-GR")}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Αναγνωριστικά" accent="bg-chart-4">
          <InfoRow label="Κωδικός" mono>
            {campaign.id}
          </InfoRow>
          <InfoRow label="Πρότυπο" mono>
            {campaign.template}
          </InfoRow>
        </InfoPanel>
      </div>

      <form id={`delete-campaign-${campaign.id}`} action={deleteAction} className="hidden">
        <input type="hidden" name="id" value={campaign.id} />
      </form>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Εκστρατείες"
        description="Τα ενημερωτικά δελτία της MEGA Parking: πρόχειρα, αποστολές και αποτελέσματα."
        icon={Mail}
        actions={
          <Button asChild>
            <Link href="/newsletter/new">
              <Plus aria-hidden />
              Νέα εκστρατεία
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile
          label="Εκστρατείες"
          value={stats.campaigns.toLocaleString("el-GR")}
          hint="Σύνολο δελτίων"
          icon={Mail}
          tone="blue"
        />
        <KpiTile
          label="Συνδρομητές"
          value={stats.subscribers.toLocaleString("el-GR")}
          hint="Εγγεγραμμένοι που λαμβάνουν"
          icon={Users}
          tone="green"
          href="/newsletter/subscribers"
        />
        <KpiTile
          label="Στάλθηκαν"
          value={stats.sent.toLocaleString("el-GR")}
          hint="Ολοκληρωμένες αποστολές"
          icon={Send}
          tone="violet"
        />
        <KpiTile
          label="Πρόχειρα"
          value={stats.drafts.toLocaleString("el-GR")}
          hint="Περιμένουν αποστολή"
          icon={FileText}
          tone="amber"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-search">Αναζήτηση</Label>
            <div className="relative">
              <Search
                className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="campaign-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Όνομα, θέμα ή προεπισκόπηση…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-status">Κατάσταση</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="campaign-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Όλες</SelectItem>
                    <SelectItem value="DRAFT">Πρόχειρες</SelectItem>
                    <SelectItem value="SENDING">Αποστέλλονται</SelectItem>
                    <SelectItem value="SENT">Στάλθηκαν</SelectItem>
                    <SelectItem value="FAILED">Απέτυχαν</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-template">Πρότυπο</Label>
              <Select
                value={template}
                onValueChange={(value) => {
                  setTemplate(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="campaign-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Όλα</SelectItem>
                    {templates.map((id) => (
                      <SelectItem key={id} value={id}>
                        {newsletterTemplateLabel(id)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="Καμία εκστρατεία"
          description="Δεν βρέθηκε δελτίο με αυτά τα φίλτρα. Ξεκίνα μια νέα εκστρατεία."
          icon={Mail}
          action={
            <Button asChild>
              <Link href="/newsletter/new">
                <Plus aria-hidden />
                Νέα εκστρατεία
              </Link>
            </Button>
          }
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
          showExport={false}
          expandableContent={expandableContent}
          columnVisibility={DEFAULT_COLUMNS}
        />
      )}
    </div>
  );
}
