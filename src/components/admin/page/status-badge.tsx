import { Badge } from "@/components/ui/badge";

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

/**
 * Ένα λεξικό καταστάσεων για όλη την εφαρμογή: ίδιο χρώμα και ίδια ελληνική
 * λέξη για την ίδια κατάσταση, σε κάθε σελίδα. Άγνωστη κατάσταση δείχνεται
 * όπως ήρθε, σε ουδέτερο.
 */
const STATUS: Record<string, { label: string; variant: Variant }> = {
  SUCCESS: { label: "Επιτυχία", variant: "success" },
  COMPLETED: { label: "Ολοκληρώθηκε", variant: "success" },
  DONE: { label: "Ολοκληρώθηκε", variant: "success" },
  OK: { label: "Εντάξει", variant: "success" },
  ACTIVE: { label: "Ενεργό", variant: "success" },
  PAID: { label: "Πληρωμένη", variant: "success" },
  INVOICED: { label: "Τιμολογήθηκε", variant: "success" },
  ACCEPTED: { label: "Αποδεκτή", variant: "success" },
  RUNNING: { label: "Σε εξέλιξη", variant: "info" },
  IN_PROGRESS: { label: "Σε εξέλιξη", variant: "info" },
  PROCESSING: { label: "Σε επεξεργασία", variant: "info" },
  QUEUED: { label: "Σε αναμονή", variant: "neutral" },
  PENDING: { label: "Εκκρεμεί", variant: "warning" },
  PENDING_PAYMENT: { label: "Αναμονή πληρωμής", variant: "warning" },
  DRAFT: { label: "Πρόχειρο", variant: "neutral" },
  SCHEDULED: { label: "Προγραμματισμένη", variant: "info" },
  SKIPPED: { label: "Παραλείφθηκε", variant: "neutral" },
  RESTORED: { label: "Επαναφέρθηκε", variant: "neutral" },
  INACTIVE: { label: "Ανενεργό", variant: "neutral" },
  EXPIRED: { label: "Έληξε", variant: "neutral" },
  CANCELLED: { label: "Ακυρώθηκε", variant: "neutral" },
  WARNING: { label: "Προειδοποίηση", variant: "warning" },
  OVERDUE: { label: "Καθυστερεί", variant: "warning" },
  SILENT: { label: "Χωρίς αλλαγές", variant: "warning" },
  FAILED: { label: "Απέτυχε", variant: "danger" },
  ERROR: { label: "Σφάλμα", variant: "danger" },
  REJECTED: { label: "Απορρίφθηκε", variant: "danger" },
  PARTIAL_SUCCESS: { label: "Με σφάλματα", variant: "warning" },
  // Παραγγελίες marketplace (Skroutz): έρχονται με μικρά γράμματα.
  OPEN: { label: "Ανοιχτή", variant: "info" },
  DISPATCHED: { label: "Απεστάλη", variant: "success" },
  DELIVERED: { label: "Παραδόθηκε", variant: "success" },
  RETURNED: { label: "Επιστράφηκε", variant: "warning" },
  CANCELED: { label: "Ακυρώθηκε", variant: "neutral" },
  SHIPPED: { label: "Απεστάλη", variant: "success" },
};

export function StatusBadge({
  status,
  label,
  variant,
  className,
}: {
  status?: string | null;
  /** Ρητή ετικέτα — υπερισχύει του λεξικού. */
  label?: string;
  variant?: Variant;
  className?: string;
}) {
  const key = (status ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  const known = STATUS[key];
  return (
    <Badge variant={variant ?? known?.variant ?? "neutral"} className={className}>
      {label ?? known?.label ?? (status || "—")}
    </Badge>
  );
}
