"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, Check, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { decideOverrun } from "@/lib/actions/overruns";

/**
 * Η απόφαση για ένα περιστατικό υπέρβασης.
 *
 * Τρεις καταστάσεις και όχι δύο: «εκκρεμεί» δεν είναι το ίδιο με «δεν
 * χρεώνεται». Χωρίς την τρίτη, κάθε υπέρβαση που αποφασίστηκε να μη χρεωθεί
 * θα ξαναεμφανιζόταν ως εκκρεμής για πάντα.
 */
export function OverrunDecision({
  inst,
  windowAt,
  amount,
  status,
  note,
  decidedBy,
}: {
  inst: number;
  windowAt: string;
  amount: number;
  status: "PENDING" | "INVOICED" | "WAIVED";
  note: string | null;
  decidedBy: string | null;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<null | "INVOICED" | "WAIVED">(null);
  const [text, setText] = useState("");

  function submit(next: "INVOICED" | "WAIVED" | "PENDING", value?: string) {
    start(async () => {
      const r = await decideOverrun(inst, windowAt, next, amount, value);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setOpen(null);
      setText("");
      toast.success(
        next === "INVOICED"
          ? "Σημειώθηκε ως τιμολογημένο."
          : next === "WAIVED"
            ? "Σημειώθηκε ως μη χρεώσιμο."
            : "Επανήλθε σε εκκρεμότητα."
      );
    });
  }

  if (status !== "PENDING") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={
            status === "INVOICED"
              ? "border-chart-2/40 text-chart-2"
              : "border-muted-foreground/30 text-muted-foreground"
          }
        >
          {status === "INVOICED" ? "Τιμολογήθηκε" : "Δεν χρεώθηκε"}
        </Badge>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
        {decidedBy && <span className="text-xs text-muted-foreground/70">· {decidedBy}</span>}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => submit("PENDING")}
          title="Επαναφορά σε εκκρεμότητα"
        >
          <Undo2 className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen("INVOICED")}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Τιμολογήθηκε
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen("WAIVED")}>
          <Ban className="size-3.5" />
          Δεν χρεώνεται
        </Button>
      </div>

      <Dialog open={open != null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {open === "INVOICED" ? "Σημείωση παραστατικού" : "Γιατί δεν χρεώνεται;"}
            </DialogTitle>
            <DialogDescription>
              {open === "INVOICED"
                ? "Γράψε τον κωδικό του παραστατικού που έκοψες, ώστε να βρίσκεται αργότερα."
                : "Η αιτιολόγηση είναι υποχρεωτική — σε έναν μήνα κανείς δεν θα θυμάται γιατί."}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={open === "INVOICED" ? "π.χ. ΑΛΠ0003041" : "π.χ. συνεννόηση με τον πελάτη"}
          />
          <DialogFooter>
            <Button
              disabled={pending || (open === "WAIVED" && !text.trim())}
              onClick={() => open && submit(open, text)}
            >
              {pending && <Loader2 className="animate-spin" />}
              Καταχώρηση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
