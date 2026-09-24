"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Images,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, KpiTile, EmptyState } from "@/components/admin/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaDropzone } from "@/components/media/media-dropzone";
import { MediaThumb } from "@/components/media/media-thumb";
import { deleteMediaAsset, updateMediaAsset } from "@/lib/actions/media";
import {
  MEDIA_KIND_LABELS,
  MEDIA_LOCALES,
  MEDIA_LOCALE_LABELS,
  formatFileSize,
  formatMediaDate,
  mediaKind,
  type MediaAlt,
  type MediaAssetDTO,
  type MediaKind,
} from "@/lib/media-asset";

type KindFilter = MediaKind | "all";

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "Όλοι οι τύποι" },
  { value: "image", label: MEDIA_KIND_LABELS.image },
  { value: "pdf", label: MEDIA_KIND_LABELS.pdf },
  { value: "document", label: MEDIA_KIND_LABELS.document },
  { value: "archive", label: MEDIA_KIND_LABELS.archive },
  { value: "video", label: MEDIA_KIND_LABELS.video },
  { value: "audio", label: MEDIA_KIND_LABELS.audio },
];

/** Αντιγραφή κειμένου με μήνυμα επιβεβαίωσης. */
async function copyToClipboard(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error("Η αντιγραφή δεν ήταν δυνατή — αντίγραψε τη διεύθυνση χειροκίνητα.");
  }
}

export function MediaLibraryClient({ assets: initialAssets }: { assets: MediaAssetDTO[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Η λίστα του server είναι η πηγή αλήθειας· από πάνω της περνούν τα αρχεία
  // που μόλις ανέβηκαν, οι αλλαγές και οι διαγραφές, μέχρι να έρθει η ανανέωση.
  const [uploaded, setUploaded] = useState<MediaAssetDTO[]>([]);
  const [edited, setEdited] = useState<Record<string, MediaAssetDTO>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const assets = useMemo(() => {
    const seen = new Set<string>();
    const merged: MediaAssetDTO[] = [];
    for (const asset of [...uploaded, ...initialAssets]) {
      if (seen.has(asset.id) || deletedIds.includes(asset.id)) continue;
      seen.add(asset.id);
      merged.push(edited[asset.id] ?? asset);
    }
    return merged;
  }, [initialAssets, uploaded, edited, deletedIds]);

  const stats = useMemo(() => {
    let images = 0;
    let documents = 0;
    let bytes = 0;
    for (const asset of assets) {
      bytes += asset.fileSize;
      if (mediaKind(asset.mimeType) === "image") images += 1;
      else documents += 1;
    }
    return { total: assets.length, images, documents, bytes };
  }, [assets]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (kind !== "all" && mediaKind(asset.mimeType) !== kind) return false;
      if (!term) return true;
      return (
        asset.title.toLowerCase().includes(term) || asset.fileName.toLowerCase().includes(term)
      );
    });
  }, [assets, search, kind]);

  const selected = selectedId ? (assets.find((asset) => asset.id === selectedId) ?? null) : null;

  const handleUploaded = (added: MediaAssetDTO[]) => {
    setUploaded((previous) => [...added, ...previous]);
    toast.success(added.length === 1 ? "Το αρχείο ανέβηκε." : `Ανέβηκαν ${added.length} αρχεία.`);
    router.refresh();
  };

  const handleUpdated = (updated: MediaAssetDTO) => {
    setEdited((previous) => ({ ...previous, [updated.id]: updated }));
    router.refresh();
  };

  const handleDeleted = (id: string) => {
    setDeletedIds((previous) => [...previous, id]);
    setSelectedId(null);
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title="Βιβλιοθήκη πολυμέσων"
        description="Εικόνες και αρχεία για το site και τα newsletter. Οι εικόνες μετατρέπονται αυτόματα σε WebP έως 1440px."
        icon={Images}
      />

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <KpiTile
            label="Σύνολο αρχείων"
            value={stats.total.toLocaleString("el-GR")}
            hint="Όλα τα αρχεία της βιβλιοθήκης"
            icon={Images}
            tone="blue"
          />
          <KpiTile
            label="Εικόνες"
            value={stats.images.toLocaleString("el-GR")}
            hint="Σε μορφή WebP"
            icon={ImageIcon}
            tone="green"
          />
          <KpiTile
            label="Έγγραφα και άλλα"
            value={stats.documents.toLocaleString("el-GR")}
            hint="PDF, έγγραφα, βίντεο, ήχος"
            icon={FileText}
            tone="amber"
          />
          <KpiTile
            label="Συνολικός χώρος"
            value={formatFileSize(stats.bytes)}
            hint="Αποθηκευμένα στο BunnyCDN"
            icon={HardDrive}
            tone="violet"
          />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <MediaDropzone onUploaded={handleUploaded} />
            <Separator />
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
              <div className="relative lg:col-span-3">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Αναζήτηση με όνομα αρχείου ή τίτλο…"
                  aria-label="Αναζήτηση αρχείων"
                  className="pl-8"
                />
              </div>
              <Select value={kind} onValueChange={(value) => setKind(value as KindFilter)}>
                <SelectTrigger aria-label="Φίλτρο τύπου αρχείου">
                  <SelectValue placeholder="Όλοι οι τύποι" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {KIND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {assets.length === 0 ? (
          <EmptyState
            icon={Images}
            title="Η βιβλιοθήκη είναι κενή"
            description="Σύρε αρχεία στη ζώνη μεταφόρτωσης ή πάτησε «Επιλογή αρχείων» για να ανεβάσεις το πρώτο."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Κανένα αρχείο δεν ταιριάζει"
            description="Άλλαξε τους όρους αναζήτησης ή τον τύπο αρχείου."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setKind("all");
                }}
              >
                Καθαρισμός φίλτρων
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {filtered.map((asset) => (
              <li key={asset.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(asset.id)}
                  title={asset.fileName}
                  className="flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left shadow-xs transition-colors hover:bg-accent/40"
                >
                  <MediaThumb asset={asset} className="aspect-square w-full" />
                  <span className="flex min-w-0 flex-col gap-0.5 border-t p-2">
                    <span className="truncate text-xs font-medium">{asset.title}</span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                      {formatFileSize(asset.fileSize)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatMediaDate(asset.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <MediaDetailsDialog
          key={selected.id}
          asset={selected}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}

function MediaDetailsDialog({
  asset,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  asset: MediaAssetDTO;
  onOpenChange: (open: boolean) => void;
  onUpdated: (asset: MediaAssetDTO) => void;
  onDeleted: (id: string) => void;
}) {
  // Το component στήνεται με `key={asset.id}`, οπότε τα πεδία ξεκινούν καθαρά.
  const [title, setTitle] = useState(asset.title);
  const [alt, setAlt] = useState<MediaAlt>(asset.alt);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const kind = mediaKind(asset.mimeType);

  const save = () => {
    startSaving(async () => {
      const result = await updateMediaAsset({ id: asset.id, title, alt });
      if (result.ok) {
        toast.success(result.message);
        onUpdated({ ...asset, title: title.trim(), alt });
      } else {
        toast.error(result.error);
      }
    });
  };

  const remove = () => {
    startDeleting(async () => {
      const result = await deleteMediaAsset(asset.id);
      if (result.ok) {
        toast.success(result.message);
        if (result.warning) toast.warning(result.warning);
        onDeleted(asset.id);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{asset.title}</DialogTitle>
          <DialogDescription className="truncate">{asset.fileName}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <MediaThumb asset={asset} className="aspect-square w-full rounded-md border" sizes="400px" />
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="info">{MEDIA_KIND_LABELS[kind]}</Badge>
              <Badge variant="neutral" className="font-mono">
                {asset.mimeType}
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                {formatFileSize(asset.fileSize)}
              </Badge>
              {asset.width && asset.height && (
                <Badge variant="outline" className="tabular-nums">
                  {asset.width}×{asset.height}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Μεταφορτώθηκε: {formatMediaDate(asset.createdAt)}
            </p>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Διεύθυνση CDN</Label>
              <div className="flex items-center gap-1">
                <Input readOnly value={asset.url} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Αντιγραφή διεύθυνσης"
                  title="Αντιγραφή διεύθυνσης"
                  onClick={() => void copyToClipboard(asset.url, "Η διεύθυνση αντιγράφηκε.")}
                >
                  <Copy />
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  aria-label="Άνοιγμα σε νέα καρτέλα"
                  title="Άνοιγμα σε νέα καρτέλα"
                >
                  <a href={asset.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="media-title" className="text-xs">
                Τίτλος
              </Label>
              <Input
                id="media-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Τίτλος αρχείου"
              />
            </div>

            {MEDIA_LOCALES.map((locale) => (
              <div key={locale} className="flex flex-col gap-1">
                <Label htmlFor={`media-alt-${locale}`} className="text-xs">
                  Εναλλακτικό κείμενο · {MEDIA_LOCALE_LABELS[locale]}
                </Label>
                <Input
                  id={`media-alt-${locale}`}
                  value={alt[locale]}
                  onChange={(event) => setAlt((previous) => ({ ...previous, [locale]: event.target.value }))}
                  placeholder="Τι δείχνει η εικόνα"
                />
              </div>
            ))}

            <p className="text-xs text-muted-foreground">
              Το εναλλακτικό κείμενο διαβάζεται από αναγνώστες οθόνης και από τις μηχανές
              αναζήτησης — γράψε το σε κάθε γλώσσα του site.
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Button type="button" onClick={save} disabled={isSaving || isDeleting}>
                {isSaving ? <Spinner data-icon="inline-start" /> : <Check />}
                Αποθήκευση
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-auto text-destructive"
                    disabled={isSaving || isDeleting}
                  >
                    {isDeleting ? <Spinner data-icon="inline-start" /> : <Trash2 />}
                    Διαγραφή
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Διαγραφή αρχείου;</AlertDialogTitle>
                    <AlertDialogDescription>
                      Το «{asset.title}» θα διαγραφεί από τη βιβλιοθήκη και από το BunnyCDN. Όπου
                      χρησιμοποιείται (σελίδες, newsletter) θα πάψει να εμφανίζεται. Η ενέργεια δεν
                      αναιρείται.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
                    <AlertDialogAction onClick={remove}>Διαγραφή</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
