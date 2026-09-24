"use client";

import { useCallback, useState } from "react";
import type { MediaAssetDTO } from "@/lib/media-asset";
import { EditorContent, useEditor } from "@tiptap/react";
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
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MediaPicker } from "@/components/media/media-picker";
import type { JsonLike } from "@/components/cms/types";

/**
 * Επεξεργαστής περιεχομένου του CMS (Tiptap).
 *
 * Τα επιτρεπτά στοιχεία μένουν λίγα επίτηδες: επικεφαλίδες, έντονα/πλάγια,
 * λίστες, σύνδεσμοι, παράθεση, εικόνα από τη βιβλιοθήκη και στοίχιση. Δεν
 * υπάρχει κόμβος ακατέργαστου HTML ούτε script — το δημόσιο site αποδίδει
 * απευθείας το `contentHtml`.
 *
 * Το περιεχόμενο δίνεται μία φορά κατά την προσάρτηση· όταν ο γονιός το
 * αλλάξει από έξω (π.χ. αυτόματη μετάφραση), ξαναφτιάχνει το component με
 * νέο `key`.
 */
export function CmsRichTextEditor({
  initialContent,
  onChange,
  disabled,
}: {
  /** Tiptap JSON αν υπάρχει, αλλιώς HTML. */
  initialContent: Record<string, unknown> | string | null;
  onChange: (html: string, json: JsonLike) => void;
  disabled?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

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
    content: initialContent || "<p></p>",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "min-h-72 w-full px-3 py-3 text-sm leading-6 outline-none [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML(), instance.getJSON() as JsonLike),
  });

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

  const busy = Boolean(disabled);

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
        <ToolbarButton
          label="Παράθεση"
          active={editor.isActive("blockquote")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
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
          label="Εικόνα από τη βιβλιοθήκη"
          disabled={busy}
          onClick={() => setPickerOpen(true)}
        >
          <ImagePlus />
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

      <EditorContent editor={editor} />

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        accept="image/*"
        multiple
        onSelect={(assets: MediaAssetDTO[]) => {
          const chain = editor.chain().focus();
          for (const asset of assets) {
            chain.setImage({ src: asset.url, alt: asset.title });
          }
          chain.run();
          setPickerOpen(false);
        }}
      />
    </div>
  );
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
