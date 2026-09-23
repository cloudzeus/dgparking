import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Κεφαλίδα σελίδας διαχείρισης — ΜΙΑ για όλες τις σελίδες.
 *
 * Πυκνή, γιατί είναι εργαλείο δουλειάς: τίτλος 20px σε μία γραμμή, μία
 * σύντομη περιγραφή, ενέργειες δεξιά. Όχι hero, όχι gradients, όχι text-3xl.
 * Σε στενή οθόνη οι ενέργειες πέφτουν κάτω από τον τίτλο.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Κουμπιά δεξιά — ένα κύριο (default) το πολύ, τα υπόλοιπα outline/ghost. */
  actions?: ReactNode;
  /** Π.χ. tabs ή φίλτρα που ανήκουν στην κεφαλίδα. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl leading-tight font-semibold tracking-tight">
            {Icon && <Icon className="size-5 shrink-0 text-primary" aria-hidden />}
            <span className="truncate">{title}</span>
          </h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
