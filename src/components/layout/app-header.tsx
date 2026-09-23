"use client";

import type { Role } from "@prisma/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Database } from "lucide-react";

interface AppHeaderProps {
  user: {
    id: string;
    email: string;
    role: Role;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
  };
  isSoftOneConnected?: boolean;
}

/** Ελληνικός τίτλος ανά διαδρομή — ίδιος με το μενού. */
const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Πίνακας ελέγχου",
  "/users": "Χρήστες",
  "/softone": "SoftOne ERP",
  "/customers": "Πελάτες",
  "/contracts": "Συμβόλαια",
  "/items": "Πινακίδες",
  "/integrations": "Διασυνδέσεις",
  "/reports/out-without-in": "Έξοδοι χωρίς είσοδο",
  "/customers-2-erp": "Πελάτες προς ERP",
  "/account": "Ο λογαριασμός μου",
  "/account/license": "Άδεια χρήσης",
  "/account/cron-logs": "Ιστορικό cron",
  "/lpr-logs": "Ιστορικό αναγνώρισης",
  "/settings": "Ρυθμίσεις",
};

export function AppHeader({ user, isSoftOneConnected = false }: AppHeaderProps) {
  const pathname = usePathname() ?? "";

  const title =
    ROUTE_TITLES[pathname] ??
    // Υποδιαδρομές (π.χ. /integrations/123/records) κρατούν τον τίτλο του γονέα.
    Object.entries(ROUTE_TITLES).find(([href]) => href !== "/" && pathname.startsWith(`${href}/`))?.[1] ??
    "Πίνακας ελέγχου";

  const greetingName = user.firstName || user.email;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-xs font-medium">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {isSoftOneConnected && (
          <Badge variant="success" title="Ενεργή σύνδεση με το SoftOne">
            <Database aria-hidden />
            Σύνδεση SoftOne
          </Badge>
        )}
        <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:block">
          Καλώς ήρθες, <span className="font-medium text-foreground">{greetingName}</span>
        </span>
      </div>
    </header>
  );
}
