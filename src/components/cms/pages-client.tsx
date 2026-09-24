"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { ContentStatus } from "@prisma/client";
import { Eye, EyeOff, FileText, Globe, Languages, ListTree, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, InfoPanel, InfoRow, KpiTile, PageHeader, StatusBadge } from "@/components/admin/page";
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
import { LocaleBadges, type LocaleState } from "@/components/cms/locale-badges";
import { CONTENT_STATUS_LABEL, CONTENT_STATUS_VARIANT } from "@/components/cms/types";
import { deletePage, setPublished } from "@/lib/actions/cms";
import { routing } from "@/i18n/routing";

export type PageRow = {
  id: string;
  key: string;
  status: ContentStatus;
  showInMenu: boolean;
  menuOrder: number | null;
  title: string;
  slug: string;
  locales: LocaleState[];
  updatedAt: string;
  createdAt: string;
  publishedAt: string | null;
};

const PAGE_SIZE = 25;

/** Σταθερή αναφορά: ο πίνακας τη διαβάζει ως αρχική ορατότητα στηλών. */
const DEFAULT_COLUMNS = { menu: false };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

export function PagesClient({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pages.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (!term) return true;
      return (
        row.title.toLowerCase().includes(term) ||
        row.key.toLowerCase().includes(term) ||
        row.slug.toLowerCase().includes(term)
      );
    });
  }, [pages, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(
    () => ({
      total: pages.length,
      published: pages.filter((row) => row.status === "PUBLISHED").length,
      drafts: pages.filter((row) => row.status === "DRAFT").length,
      pending: pages.filter(
        (row) => row.locales.length < routing.locales.length || row.locales.some((item) => item.machine),
      ).length,
    }),
    [pages],
  );

  function togglePublished(row: PageRow) {
    startTransition(async () => {
      const result = await setPublished({
        entity: "page",
        id: row.id,
        published: row.status !== "PUBLISHED",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function remove(row: PageRow) {
    startTransition(async () => {
      const result = await deletePage(row.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  const columns: ColumnDef<PageRow>[] = [
    {
      accessorKey: "key",
      header: "Κλειδί",
      size: 150,
      meta: { label: "Κλειδί" },
      cell: ({ row }) => <span className="truncate font-mono">{row.original.key}</span>,
    },
    {
      accessorKey: "title",
      header: "Τίτλος",
      size: 300,
      meta: { label: "Τίτλος", flex: true },
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/cms/pages/${row.original.id}`} className="block truncate font-medium hover:underline">
            {row.original.title || "Χωρίς τίτλο"}
          </Link>
          <span className="block truncate font-mono text-muted-foreground" title={row.original.slug}>
            /{routing.defaultLocale}/{row.original.slug}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Κατάσταση",
      size: 130,
      meta: { label: "Κατάσταση" },
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          label={CONTENT_STATUS_LABEL[row.original.status]}
          variant={CONTENT_STATUS_VARIANT[row.original.status]}
        />
      ),
    },
    {
      id: "locales",
      header: "Γλώσσες",
      size: 150,
      meta: { label: "Γλώσσες" },
      cell: ({ row }) => <LocaleBadges locales={row.original.locales} />,
    },
    {
      id: "menu",
      header: "Μενού",
      size: 110,
      meta: { label: "Μενού" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.showInMenu ? `Ναι${row.original.menuOrder != null ? ` · ${row.original.menuOrder}` : ""}` : "Όχι"}
        </span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Ενημέρωση",
      size: 160,
      meta: { label: "Ενημέρωση" },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.updatedAt)}</span>,
    },
  ];

  const expandableContent = (row: PageRow) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{row.title || "Χωρίς τίτλο"}</span>
        <StatusBadge
          status={row.status}
          label={CONTENT_STATUS_LABEL[row.status]}
          variant={CONTENT_STATUS_VARIANT[row.status]}
        />
        <LocaleBadges locales={row.locales} />
      </div>
      <p className="text-xs text-muted-foreground">
        Κλειδί {row.key} · Δημιουργήθηκε {formatDate(row.createdAt)} · Ενημερώθηκε {formatDate(row.updatedAt)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/cms/pages/${row.id}`}>Επεξεργασία</Link>
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => togglePublished(row)}>
          {row.status === "PUBLISHED" ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {row.status === "PUBLISHED" ? "Απόσυρση" : "Δημοσίευση"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="ml-auto text-destructive" disabled={pending}>
              <Trash2 aria-hidden />
              Διαγραφή
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Διαγραφή της σελίδας;</AlertDialogTitle>
              <AlertDialogDescription>
                Η σελίδα «{row.title || row.key}» θα διαγραφεί οριστικά σε όλες τις γλώσσες. Η ενέργεια δεν
                αναιρείται.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove(row)}>Διαγραφή</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPanel title="Σελίδα" accent="bg-chart-1">
          <InfoRow label="Κλειδί" mono>
            {row.key}
          </InfoRow>
          <InfoRow label="Διεύθυνση" mono wrap>
            /{routing.defaultLocale}/{row.slug}
          </InfoRow>
        </InfoPanel>
        <InfoPanel title="Μενού" accent="bg-chart-2">
          <InfoRow label="Εμφάνιση">{row.showInMenu ? "Ναι" : "Όχι"}</InfoRow>
          <InfoRow label="Σειρά">{row.menuOrder ?? "—"}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Δημοσίευση" accent="bg-chart-3">
          <InfoRow label="Κατάσταση">{CONTENT_STATUS_LABEL[row.status]}</InfoRow>
          <InfoRow label="Ημερομηνία">{formatDate(row.publishedAt)}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Μεταφράσεις" accent="bg-chart-4">
          <InfoRow label="Έτοιμες">
            {row.locales.filter((item) => !item.machine).length} / {routing.locales.length}
          </InfoRow>
          <InfoRow label="Μηχανικές">{row.locales.filter((item) => item.machine).length}</InfoRow>
        </InfoPanel>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Σελίδες"
        description="Το περιεχόμενο του δημόσιου site: μία σελίδα, τρεις γλώσσες."
        icon={FileText}
        actions={
          <Button asChild>
            <Link href="/cms/pages/new">
              <Plus aria-hidden />
              Νέα σελίδα
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile label="Σελίδες" value={stats.total.toLocaleString("el-GR")} hint="Σύνολο εγγραφών" icon={FileText} tone="blue" />
        <KpiTile
          label="Δημοσιευμένες"
          value={stats.published.toLocaleString("el-GR")}
          hint="Ορατές στο site"
          icon={Globe}
          tone="green"
        />
        <KpiTile
          label="Πρόχειρα"
          value={stats.drafts.toLocaleString("el-GR")}
          hint="Δεν φαίνονται ακόμη"
          icon={ListTree}
          tone="amber"
        />
        <KpiTile
          label="Θέλουν μετάφραση"
          value={stats.pending.toLocaleString("el-GR")}
          hint="Λείπει ή δεν ελέγχθηκε γλώσσα"
          icon={Languages}
          tone="violet"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pages-search">Αναζήτηση</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="pages-search"
                value={search}
                className="pl-8"
                placeholder="Τίτλος, κλειδί ή διεύθυνση…"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pages-status">Κατάσταση</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="pages-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Όλες</SelectItem>
                    <SelectItem value="DRAFT">Πρόχειρες</SelectItem>
                    <SelectItem value="PUBLISHED">Δημοσιευμένες</SelectItem>
                    <SelectItem value="ARCHIVED">Αρχειοθετημένες</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {pages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Καμία σελίδα ακόμη"
          description="Φτιάξε την πρώτη σελίδα του site — τα ελληνικά είναι υποχρεωτικά, τα αγγλικά και τα ιταλικά μπορούν να προκύψουν με αυτόματη μετάφραση."
          action={
            <Button asChild>
              <Link href="/cms/pages/new">
                <Plus aria-hidden />
                Νέα σελίδα
              </Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          title={`Σελίδες (${filtered.length.toLocaleString("el-GR")})`}
          fixedLayout
          showExport={false}
          getRowId={(row) => row.id}
          columnVisibility={DEFAULT_COLUMNS}
          columnVisibilityStorageKey="cms-pages"
          expandableContent={expandableContent}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
