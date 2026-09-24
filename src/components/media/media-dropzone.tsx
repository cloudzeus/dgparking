"use client";

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatFileSize, type MediaAssetDTO } from "@/lib/media-asset";

/** Οι επεκτάσεις που δέχεται το `<input type="file">` — ίδιες με τον server. */
const ACCEPT_ATTRIBUTE =
  ".jpg,.jpeg,.png,.gif,.webp,.avif,.tif,.tiff,.bmp,.svg," +
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.csv,.txt,.rtf," +
  ".zip,.rar,.7z,.mp4,.webm,.mov,.m4v,.mp3,.wav,.ogg,.m4a";

type UploadStatus = "uploading" | "done" | "error";

type UploadRow = {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
};

type UploadResponse = {
  error?: string;
  results?: Array<
    { ok: true; name: string; asset: MediaAssetDTO } | { ok: false; name: string; error: string }
  >;
};

const GENERIC_ERROR = "Η μεταφόρτωση απέτυχε.";

function uploadOne(
  file: File,
  onProgress: (percent: number) => void
): Promise<{ ok: true; asset: MediaAssetDTO } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const body = new FormData();
    body.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/media/upload");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    });

    xhr.addEventListener("load", () => {
      let payload: UploadResponse = {};
      try {
        payload = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        resolve({ ok: false, error: GENERIC_ERROR });
        return;
      }
      if (xhr.status >= 400) {
        resolve({ ok: false, error: payload.error ?? GENERIC_ERROR });
        return;
      }
      const first = payload.results?.[0];
      if (!first) {
        resolve({ ok: false, error: GENERIC_ERROR });
        return;
      }
      resolve(first.ok ? { ok: true, asset: first.asset } : { ok: false, error: first.error });
    });

    xhr.addEventListener("error", () => resolve({ ok: false, error: "Πρόβλημα δικτύου." }));
    xhr.addEventListener("abort", () => resolve({ ok: false, error: "Η μεταφόρτωση ακυρώθηκε." }));

    xhr.send(body);
  });
}

/**
 * Ζώνη μεταφόρτωσης με μεταφορά & απόθεση, πρόοδο ανά αρχείο και σφάλμα ανά
 * αρχείο που απέτυχε. Τα αρχεία ανεβαίνουν ένα-ένα ώστε η πρόοδος να είναι
 * πραγματική και ένα αποτυχημένο να μην παρασύρει τα υπόλοιπα.
 */
export function MediaDropzone({
  onUploaded,
  className,
  compact = false,
}: {
  onUploaded: (assets: MediaAssetDTO[]) => void;
  className?: string;
  /** Μικρότερη μορφή για μέσα σε διάλογο. */
  compact?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const queue: UploadRow[] = files.map((file, index) => ({
        key: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "uploading",
      }));

      setRows((previous) => [...queue, ...previous]);
      setIsUploading(true);

      const uploaded: MediaAssetDTO[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const row = queue[index];
        const result = await uploadOne(files[index], (percent) => {
          setRows((previous) =>
            previous.map((item) => (item.key === row.key ? { ...item, progress: percent } : item))
          );
        });

        if (result.ok) {
          uploaded.push(result.asset);
          setRows((previous) =>
            previous.map((item) =>
              item.key === row.key ? { ...item, progress: 100, status: "done" } : item
            )
          );
        } else {
          setRows((previous) =>
            previous.map((item) =>
              item.key === row.key ? { ...item, status: "error", error: result.error } : item
            )
          );
        }
      }

      setIsUploading(false);
      if (uploaded.length > 0) onUploaded(uploaded);
    },
    [onUploaded]
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  };

  const pending = rows.filter((row) => row.status !== "done");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 text-center transition-colors",
          compact && "p-4",
          isDragging && "border-primary bg-accent/50"
        )}
      >
        <CloudUpload className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Σύρε αρχεία εδώ για μεταφόρτωση</p>
        <p className="text-xs text-muted-foreground">
          Εικόνες, έγγραφα, βίντεο και ήχος — έως 25 MB ανά αρχείο. Οι εικόνες μετατρέπονται
          αυτόματα σε WebP.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          Επιλογή αρχείων
        </Button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          aria-label="Επιλογή αρχείων προς μεταφόρτωση"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void handleFiles(files);
          }}
        />
      </div>

      {pending.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pending.map((row) => (
            <li key={row.key} className="rounded-md border bg-card p-2">
              <div className="flex min-w-0 items-center gap-2">
                {row.status === "error" ? (
                  <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate text-xs" title={row.name}>
                  {row.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatFileSize(row.size)}
                </span>
              </div>
              {row.status === "uploading" && <Progress value={row.progress} className="mt-2 h-1" />}
              {row.status === "error" && (
                <p className="mt-1 text-xs text-destructive">{row.error ?? GENERIC_ERROR}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
