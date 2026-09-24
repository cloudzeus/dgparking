"use client";

import { Suspense, use, useCallback, useMemo, useState } from "react";
import { Check, Images, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/admin/page";
import { MediaDropzone } from "@/components/media/media-dropzone";
import { MediaThumb } from "@/components/media/media-thumb";
import { listMediaAssets } from "@/lib/actions/media";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  mediaKind,
  type MediaAssetDTO,
  type MediaKind,
} from "@/lib/media-asset";

/**
 * Ποιον τύπο αρχείων δέχεται ο επιλογέας.
 * Δεκτές και οι μορφές MIME με αστερίσκο («image/*»), για ευκολία στα call sites.
 */
export type MediaPickerAccept =
  MediaKind | "all" | "image/*" | "video/*" | "audio/*";

const ACCEPT_ALIASES: Record<string, MediaKind> = {
  "image/*": "image",
  "video/*": "video",
  "audio/*": "audio",
};

function normalizeAccept(accept: MediaPickerAccept): MediaKind | "all" {
  return ACCEPT_ALIASES[accept] ?? (accept as MediaKind | "all");
}

export type MediaPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Καλείται με τα επιλεγμένα αρχεία· ο επιλογέας κλείνει μόνος του. */
  onSelect: (assets: MediaAssetDTO[]) => void;
  /** Περιορισμός τύπου — π.χ. "image" για εικόνα άρθρου. Προεπιλογή: όλα. */
  accept?: MediaPickerAccept;
  /** Πολλαπλή επιλογή. Προεπιλογή: όχι. */
  multiple?: boolean;
  /** Τίτλος του διαλόγου (ελληνικά). */
  title?: string;
  /** Μία πρόταση κάτω από τον τίτλο. */
  description?: string;
};

/**
 * Επιλογέας αρχείων από τη βιβλιοθήκη πολυμέσων.
 *
 * Το χρησιμοποιούν το CMS και το newsletter:
 * `<MediaPicker open={open} onOpenChange={setOpen} onSelect={(assets) => …} accept="image" />`
 */
export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  accept = "all",
  multiple = false,
  title = "Επιλογή από τη βιβλιοθήκη",
  description = "Διάλεξε αρχείο από τη βιβλιοθήκη ή ανέβασε καινούργιο.",
}: MediaPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Το περιεχόμενο στήνεται με το άνοιγμα, ώστε η επιλογή να ξεκινά καθαρή. */}
        <Suspense fallback={<PickerSkeleton />}>
          <MediaPickerBody
            accept={accept}
            multiple={multiple}
            onSelect={onSelect}
            onOpenChange={onOpenChange}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

/** Σκελετός όσο φορτώνει η λίστα της βιβλιοθήκης. */
function PickerSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="aspect-square w-full rounded-lg" />
      ))}
    </div>
  );
}

function MediaPickerBody({
  accept,
  multiple,
  onSelect,
  onOpenChange,
}: {
  accept: MediaPickerAccept;
  multiple: boolean;
  onSelect: (assets: MediaAssetDTO[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const kindFilter = normalizeAccept(accept);

  // Η λίστα ζητιέται μία φορά, με το άνοιγμα του διαλόγου.
  const [libraryPromise] = useState(() =>
    listMediaAssets({ kind: kindFilter, take: 300 }).catch(() => {
      toast.error("Η βιβλιοθήκη δεν φορτώθηκε.");
      return [] as MediaAssetDTO[];
    }),
  );
  const library = use(libraryPromise);

  const [uploaded, setUploaded] = useState<MediaAssetDTO[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"library" | "upload">("library");

  const assets = useMemo(() => {
    const fresh = new Set(uploaded.map((asset) => asset.id));
    return [...uploaded, ...library.filter((asset) => !fresh.has(asset.id))];
  }, [uploaded, library]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (kindFilter !== "all" && mediaKind(asset.mimeType) !== kindFilter)
        return false;
      if (!term) return true;
      return (
        asset.title.toLowerCase().includes(term) ||
        asset.fileName.toLowerCase().includes(term)
      );
    });
  }, [assets, search, kindFilter]);

  const toggle = (id: string) => {
    setSelectedIds((previous) => {
      if (previous.includes(id))
        return previous.filter((value) => value !== id);
      return multiple ? [...previous, id] : [id];
    });
  };

  const confirm = () => {
    const chosen = selectedIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset): asset is MediaAssetDTO => Boolean(asset));
    if (chosen.length === 0) return;
    onSelect(chosen);
    onOpenChange(false);
  };

  const handleUploaded = (added: MediaAssetDTO[]) => {
    setUploaded((previous) => [...added, ...previous]);
    setSelectedIds(
      multiple ? added.map((asset) => asset.id) : added.slice(0, 1).map((asset) => asset.id),
    );
    setTab("library");
    toast.success(
      added.length === 1 ? "Το αρχείο ανέβηκε." : `Ανέβηκαν ${added.length} αρχεία.`,
    );
  };

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "library" | "upload")}
      >
        <TabsList>
          <TabsTrigger value="library">Βιβλιοθήκη</TabsTrigger>
          <TabsTrigger value="upload">Μεταφόρτωση</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Αναζήτηση αρχείου…"
              aria-label="Αναζήτηση αρχείου"
              className="pl-8"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Images}
              title="Δεν βρέθηκαν αρχεία"
              description="Άλλαξε την αναζήτηση ή ανέβασε νέο αρχείο από την καρτέλα «Μεταφόρτωση»."
            />
          ) : (
            <ul className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              {filtered.map((asset) => {
                const isSelected = selectedIds.includes(asset.id);
                return (
                  <li key={asset.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => toggle(asset.id)}
                      aria-pressed={isSelected}
                      title={asset.fileName}
                      className={cn(
                        "relative flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors hover:bg-accent/40",
                        isSelected && "border-primary ring-1 ring-primary",
                      )}
                    >
                      {isSelected && (
                        <span className="absolute top-1 right-1 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" aria-hidden />
                        </span>
                      )}
                      <MediaThumb
                        asset={asset}
                        className="aspect-square w-full"
                        sizes="200px"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5 border-t p-2">
                        <span className="truncate text-xs font-medium">
                          {asset.title}
                        </span>
                        <span className="truncate text-xs text-muted-foreground tabular-nums">
                          {formatFileSize(asset.fileSize)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="upload">
          <MediaDropzone onUploaded={handleUploaded} compact />
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Ακύρωση
        </Button>
        <Button onClick={confirm} disabled={selectedIds.length === 0}>
          {selectedIds.length > 1
            ? `Επιλογή (${selectedIds.length})`
            : "Επιλογή"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Βοηθός για τα σημεία κλήσης:
 * `const picker = useMediaPicker();` → `<Button onClick={picker.openPicker}>…</Button>`
 * και `<MediaPicker {...picker.pickerProps} onSelect={…} />`
 */
export function useMediaPicker() {
  const [open, setOpen] = useState(false);
  const openPicker = useCallback(() => setOpen(true), []);
  const closePicker = useCallback(() => setOpen(false), []);
  return {
    open,
    openPicker,
    closePicker,
    /** Δώσ' τα με spread στο `<MediaPicker>` — λείπει μόνο το `onSelect`. */
    pickerProps: { open, onOpenChange: setOpen },
  };
}
