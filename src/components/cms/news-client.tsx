"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { ContentStatus } from "@prisma/client";
import {
  CalendarClock,
  Eye,
  EyeOff,
  Globe,
  ImageIcon,
  Languages,
  Newspaper,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { deletePost, setPublished } from "@/lib/actions/cms";
import { routing } from "@/i18n/routing";

export type NewsRow = {
  id: string;
  status: ContentStatus;
  coverImageUrl: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  locales: LocaleState[];
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

const PAGE_SIZE = 25;

/** Σταθερή αναφορά: ο πίνακας τη διαβάζει ως αρχική ορατότητα στηλών. */
const DEFAULT_COLUMNS = { updatedAt: false };

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("el-GR", { timeZone: "Europe/Athens" });
}

export function NewsClient({ posts }: { posts: NewsRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (!term) return true;
      return row.title.toLowerCase().includes(term) || row.slug.toLowerCase().includes(term);
    });
  }, [posts, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((row) => row.status === "PUBLISHED").length,
      drafts: posts.filter((row) => row.status === "DRAFT").length,
      pending: posts.filter(
        (row) => row.locales.length < routing.locales.length || row.locales.some((item) => item.machine),
      ).length,
    }),
    [posts],
  );

  function togglePublished(row: NewsRow) {
    startTransition(async () => {
      const result = await setPublished({
        entity: "news",
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

  function remove(row: NewsRow) {
    startTransition(async () => {
      const result = await deletePost(row.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  const columns: ColumnDef<NewsRow>[] = [
    {
      id: "cover",
      header: "Εξώφυλλο",
      size: 80,
      meta: { label: "Εξώφυλλο" },
      cell: ({ row }) => (
        <div className="flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
          {row.original.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.original.coverImageUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      ),
    },
    {
      accessorKey: "title",
      header: "Τίτλος",
      size: 320,
      meta: { label: "Τίτλος", flex: true },
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/cms/news/${row.original.id}`} className="block truncate font-medium hover:underline">
            {row.original.title || "Χωρίς τίτλο"}
          </Link>
          <span className="block truncate font-mono text-muted-foreground" title={row.original.slug}>
            /{routing.defaultLocale}/news/{row.original.slug}
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
      accessorKey: "publishedAt",
      header: "Δημοσίευση",
      size: 160,
      meta: { label: "Δημοσίευση" },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.publishedAt)}</span>,
    },
    {
      id: "locales",
      header: "Γλώσσες",
      size: 150,
      meta: { label: "Γλώσσες" },
      cell: ({ row }) => <LocaleBadges locales={row.original.locales} />,
    },
    {
      accessorKey: "updatedAt",
      header: "Ενημέρωση",
      size: 160,
      meta: { label: "Ενημέρωση" },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.updatedAt)}</span>,
    },
  ];

  const expandableContent = (row: NewsRow) => (
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
        Δημιουργήθηκε {formatDate(row.createdAt)} · Ενημερώθηκε {formatDate(row.updatedAt)} · Δημοσίευση{" "}
        {formatDate(row.publishedAt)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/cms/news/${row.id}`}>Επεξεργασία</Link>
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
              <AlertDialogTitle>Διαγραφή του άρθρου;</AlertDialogTitle>
              <AlertDialogDescription>
                Το άρθρο «{row.title || row.slug}» θα διαγραφεί οριστικά σε όλες τις γλώσσες. Η ενέργεια δεν
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
        <InfoPanel title="Άρθρο" accent="bg-chart-1">
          <InfoRow label="Διεύθυνση" mono wrap>
            /{routing.defaultLocale}/news/{row.slug}
          </InfoRow>
          <InfoRow label="Περίληψη" wrap>
            {row.excerpt || "—"}
          </InfoRow>
        </InfoPanel>
        <InfoPanel title="Δημοσίευση" accent="bg-chart-2">
          <InfoRow label="Κατάσταση">{CONTENT_STATUS_LABEL[row.status]}</InfoRow>
          <InfoRow label="Ημερομηνία">{formatDate(row.publishedAt)}</InfoRow>
        </InfoPanel>
        <InfoPanel title="Εξώφυλλο" accent="bg-chart-3">
          <InfoRow label="Εικόνα" mono wrap>
            {row.coverImageUrl || "—"}
          </InfoRow>
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
        title="Νέα"
        description="Τα άρθρα του δημόσιου site: εξώφυλλο, ημερομηνία δημοσίευσης και τρεις γλώσσες."
        icon={Newspaper}
        actions={
          <Button asChild>
            <Link href="/cms/news/new">
              <Plus aria-hidden />
              Νέο άρθρο
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <KpiTile label="Άρθρα" value={stats.total.toLocaleString("el-GR")} hint="Σύνολο εγγραφών" icon={Newspaper} tone="blue" />
        <KpiTile
          label="Δημοσιευμένα"
          value={stats.published.toLocaleString("el-GR")}
          hint="Ορατά στο site"
          icon={Globe}
          tone="green"
        />
        <KpiTile
          label="Πρόχειρα"
          value={stats.drafts.toLocaleString("el-GR")}
          hint="Δεν φαίνονται ακόμη"
          icon={CalendarClock}
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
            <Label htmlFor="news-search">Αναζήτηση</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="news-search"
                value={search}
                className="pl-8"
                placeholder="Τίτλος ή διεύθυνση…"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="news-status">Κατάσταση</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="news-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Όλα</SelectItem>
                    <SelectItem value="DRAFT">Πρόχειρα</SelectItem>
                    <SelectItem value="PUBLISHED">Δημοσιευμένα</SelectItem>
                    <SelectItem value="ARCHIVED">Αρχειοθετημένα</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Κανένα άρθρο ακόμη"
          description="Γράψε το πρώτο νέο της MEGA Parking — τα ελληνικά είναι υποχρεωτικά, οι άλλες γλώσσες μπορούν να προκύψουν με αυτόματη μετάφραση."
          action={
            <Button asChild>
              <Link href="/cms/news/new">
                <Plus aria-hidden />
                Νέο άρθρο
              </Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          title={`Νέα (${filtered.length.toLocaleString("el-GR")})`}
          fixedLayout
          showExport={false}
          getRowId={(row) => row.id}
          columnVisibility={DEFAULT_COLUMNS}
          columnVisibilityStorageKey="cms-news"
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
