"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Επεξεργαστής περιεχομένου δελτίου (Tiptap).
 *
 * Οι εικόνες ΔΕΝ μπαίνουν ποτέ ως base64 στο μήνυμα: ό,τι σύρει ή επικολλήσει
 * ο συντάκτης ανεβαίνει στο CDN μέσω `/api/newsletter/upload-image`, που το
 * μετατρέπει σε μορφή που καταλαβαίνουν τα email clients, και στο κείμενο
 * μπαίνει μόνο το URL.
 */

const MAX_BYTES = 10 * 1024 * 1024;

async function uploadImage(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    toast.error("Επιτρέπονται μόνο εικόνες.");
    return null;
  }
  if (file.size > MAX_BYTES) {
    toast.error("Η εικόνα ξεπερνά τα 10 MB.");
    return null;
  }

  const body = new FormData();
  body.append("file", file);

  try {
    const res = await fetch("/api/newsletter/upload-image", { method: "POST", body });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      toast.error(data.error ?? "Το ανέβασμα απέτυχε.");
      return null;
    }
    return data.url;
  } catch {
    toast.error("Το ανέβασμα απέτυχε.");
    return null;
  }
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertImages = useCallback(async (files: File[], position?: number) => {
    const editor = editorRef.current;
    if (!editor || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadImage(file);
        if (!url) continue;
        const chain = editor.chain().focus();
        if (typeof position === "number") chain.insertContentAt(position, { type: "image", attrs: { src: url } });
        else chain.setImage({ src: url });
        chain.run();
      }
    } finally {
      setUploading(false);
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "<p></p>",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "prose-newsletter min-h-72 w-full px-3 py-3 text-sm leading-6 outline-none [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_hr]:my-4 [&_hr]:border-t",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void insertImages(files, coords?.pos);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Διεύθυνση συνδέσμου (https://…)", previous ?? "https://");
    if (href === null) return;
    if (href.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  }, [editor]);

  if (!editor) {
    return <div className="min-h-72 rounded-md border bg-muted/30" aria-hidden />;
  }

  const busy = Boolean(disabled) || uploading;

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b p-1.5">
        <ToolbarButton
          label="Επικεφαλίδα 2"
          active={editor.isActive("heading", { level: 2 })}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="Επικεφαλίδα 3"
          active={editor.isActive("heading", { level: 3 })}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton
          label="Έντονα"
          active={editor.isActive("bold")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Πλάγια"
          active={editor.isActive("italic")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton
          label="Λίστα με κουκκίδες"
          active={editor.isActive("bulletList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Αριθμημένη λίστα"
          active={editor.isActive("orderedList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton
          label="Στοίχιση αριστερά"
          active={editor.isActive({ textAlign: "left" })}
          disabled={busy}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft />
        </ToolbarButton>
        <ToolbarButton
          label="Στοίχιση στο κέντρο"
          active={editor.isActive({ textAlign: "center" })}
          disabled={busy}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter />
        </ToolbarButton>
        <ToolbarButton
          label="Στοίχιση δεξιά"
          active={editor.isActive({ textAlign: "right" })}
          disabled={busy}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton label="Σύνδεσμος" active={editor.isActive("link")} disabled={busy} onClick={setLink}>
          <Link2 />
        </ToolbarButton>
        <ToolbarButton
          label="Αφαίρεση συνδέσμου"
          disabled={busy || !editor.isActive("link")}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2Off />
        </ToolbarButton>
        <ToolbarButton
          label="Διαχωριστική γραμμή — χωρίζει τις ενότητες του προτύπου"
          disabled={busy}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <ToolbarButton label="Εισαγωγή εικόνας" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Spinner /> : <ImagePlus />}
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton label="Αναίρεση" disabled={busy} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 />
          </ToolbarButton>
          <ToolbarButton label="Επανάληψη" disabled={busy} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 />
          </ToolbarButton>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void insertImages(files);
        }}
      />

      <EditorContent editor={editor} className={cn(uploading && "opacity-60")} />

      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Σύρε ή επικόλλησε εικόνα μέσα στο κείμενο — ανεβαίνει στο CDN και μετατρέπεται σε μορφή
        κατάλληλη για email. Η διαχωριστική γραμμή χωρίζει τις ενότητες που χρησιμοποιούν τα
        πρότυπα με στήλες και κάρτες.
      </p>
    </div>
  );
}
