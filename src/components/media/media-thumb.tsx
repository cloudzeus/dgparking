"use client";

import Image from "next/image";
import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mediaKind, type MediaAssetDTO } from "@/lib/media-asset";

/** Το εικονίδιο που αντιστοιχεί στον τύπο του αρχείου. */
export function MediaKindIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  switch (mediaKind(mimeType)) {
    case "image":
      return <ImageIcon className={className} aria-hidden />;
    case "video":
      return <FileVideo className={className} aria-hidden />;
    case "audio":
      return <FileAudio className={className} aria-hidden />;
    case "pdf":
      return <FileText className={className} aria-hidden />;
    case "archive":
      return <FileArchive className={className} aria-hidden />;
    default:
      return <FileIcon className={className} aria-hidden />;
  }
}

/** Η επέκταση του αρχείου, για την ετικέτα κάτω από το εικονίδιο. */
function extensionLabel(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match ? match[1].toUpperCase() : "—";
}

/**
 * Μικρογραφία αρχείου: η εικόνα για εικόνες, εικονίδιο τύπου για όλα τα άλλα.
 */
export function MediaThumb({
  asset,
  className,
  sizes = "(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 200px",
}: {
  asset: MediaAssetDTO;
  className?: string;
  sizes?: string;
}) {
  const isImage = mediaKind(asset.mimeType) === "image";

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-muted", className)}>
      {isImage ? (
        <Image
          src={asset.url}
          alt={asset.alt.el || asset.title}
          fill
          sizes={sizes}
          className="object-contain"
          unoptimized={asset.mimeType === "image/svg+xml"}
        />
      ) : (
        <span className="flex flex-col items-center gap-1 text-muted-foreground">
          <MediaKindIcon mimeType={asset.mimeType} className="size-8" />
          <span className="text-xs font-medium">{extensionLabel(asset.fileName)}</span>
        </span>
      )}
    </div>
  );
}
