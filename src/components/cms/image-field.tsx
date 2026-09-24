"use client";

import { useState } from "react";
import type { MediaAssetDTO } from "@/lib/media-asset";
import { ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MediaPicker } from "@/components/media/media-picker";

/**
 * Πεδίο εικόνας: μικρή προεπισκόπηση, επιλογή από τη βιβλιοθήκη πολυμέσων και
 * αφαίρεση. Κρατάμε μόνο το URL — η βιβλιοθήκη είναι η πηγή του αρχείου.
 */
export function ImageField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
              <ImageIcon aria-hidden />
              {value ? "Αλλαγή εικόνας" : "Επιλογή από τη βιβλιοθήκη"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={disabled}
                onClick={() => onChange("")}
              >
                <Trash2 aria-hidden />
                Αφαίρεση
              </Button>
            )}
          </div>
          {value ? (
            <span className="max-w-full truncate font-mono text-xs text-muted-foreground" title={value}>
              {value}
            </span>
          ) : (
            description && <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      </div>

      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        accept="image/*"
        onSelect={(assets: MediaAssetDTO[]) => {
          const asset = assets[0];
          if (asset) onChange(asset.url);
          setOpen(false);
        }}
      />
    </div>
  );
}
