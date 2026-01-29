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

export function AppHeader({ user, isSoftOneConnected = false }: AppHeaderProps) {
  const pathname = usePathname();
  
  const getPageTitle = () => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "DASHBOARD";
    return segments[segments.length - 1].toUpperCase().replace(/-/g, " ");
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-xs font-medium">
              {getPageTitle()}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-3">
        {isSoftOneConnected && (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[8px] font-bold gap-1">
            <Database className="h-3 w-3" />
            SOFTONE CONNECTED
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Welcome, <span className="font-medium text-foreground">{user.firstName || user.email}</span>
        </span>
      </div>
    </header>
  );
}


