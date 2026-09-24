"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  Car,
  Settings,
  UserCog,
  LogOut,
  ChevronDown,
  User,
  Database,
  Plug,
  Link2,
  Network,
  FileText,
  Clock,
  Camera,
  BarChart3,
  ArrowDownRight,
  FileCheck,
  Mail,
  ShieldCheck,
  Scale,
  Newspaper,
  Images,
  UserCheck,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleLabel, roleVariant } from "@/lib/roles";

interface AppSidebarProps {
  user: {
    id: string;
    email: string;
    role: Role;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
  };
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

interface MenuGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "Επισκόπηση",
    icon: LayoutDashboard,
    items: [
      {
        title: "Πίνακας ελέγχου",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"],
      },
    ],
  },
  {
    title: "Διαχείριση",
    icon: Users,
    items: [
      {
        title: "Χρήστες",
        href: "/users",
        icon: Users,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "SoftOne ERP",
        href: "/softone",
        icon: Database,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Πελάτες",
        href: "/customers",
        icon: Users,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "Συμβόλαια",
        href: "/contracts",
        icon: FileText,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "Αντιπαραβολή",
        href: "/reconciliation",
        icon: Scale,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "Αιτήματα πελατών",
        href: "/portal-access",
        icon: UserCheck,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Πινακίδες",
        href: "/items",
        icon: Car,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "Διασυνδέσεις",
        href: "/integrations",
        icon: Network,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "Newsletter",
    icon: Mail,
    items: [
      {
        title: "Εκστρατείες",
        href: "/newsletter",
        icon: Mail,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Συνδρομητές",
        href: "/newsletter/subscribers",
        icon: Users,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Στατιστικά",
        href: "/newsletter/stats",
        icon: BarChart3,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "Αναφορές",
    icon: BarChart3,
    items: [
      {
        title: "Έξοδοι χωρίς είσοδο",
        href: "/reports/out-without-in",
        icon: ArrowDownRight,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "GDPR",
    icon: ShieldCheck,
    items: [
      {
        title: "Αρχείο συγκαταθέσεων",
        href: "/gdpr/consents",
        icon: ShieldCheck,
        roles: ["ADMIN"],
      },
      {
        title: "Αιτήματα δικαιωμάτων",
        href: "/gdpr/requests",
        icon: Scale,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    title: "CMS",
    icon: FileText,
    items: [
      {
        title: "Σελίδες",
        href: "/cms/pages",
        icon: FileText,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Νέα",
        href: "/cms/news",
        icon: Newspaper,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Βιβλιοθήκη πολυμέσων",
        href: "/media",
        icon: Images,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "Συνδέσεις API",
    icon: Plug,
    items: [
      {
        title: "Πελάτες προς ERP",
        href: "/customers-2-erp",
        icon: Link2,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    title: "Λογαριασμός",
    icon: UserCog,
    items: [
      {
        title: "Ο λογαριασμός μου",
        href: "/account",
        icon: UserCog,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"],
      },
      {
        title: "Άδεια χρήσης",
        href: "/account/license",
        icon: FileCheck,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"],
      },
      {
        title: "Ιστορικό cron",
        href: "/account/cron-logs",
        icon: Clock,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Ιστορικό αναγνώρισης",
        href: "/lpr-logs",
        icon: Camera,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Ρυθμίσεις",
        href: "/settings",
        icon: Settings,
        roles: ["ADMIN"],
      },
    ],
  },
];

/** Αρχικά για το Avatar όταν δεν υπάρχει φωτογραφία. */
function initials(user: AppSidebarProps["user"]) {
  const letters = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.trim();
  return (letters || user.email[0] || "?").toUpperCase();
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter menu groups based on user role
  const filteredMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(user.role)),
    }))
    .filter((group) => group.items.length > 0);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  const renderItems = (items: NavItem[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className="h-8">
              <Link href={item.href}>
                <Icon className="size-4" />
                <span className="text-xs">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <Car className="size-4 text-primary-foreground" aria-hidden />
          </span>
          {!isCollapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">KOLLERIS</span>
              <span className="block truncate text-xs text-muted-foreground">Διαχείριση στάθμευσης</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent suppressHydrationWarning>
        {filteredMenuGroups.map((group) => {
          const GroupIcon = group.icon;
          // Only render Collapsible after mount to avoid hydration mismatches with Radix UI random IDs
          if (!isMounted) {
            return (
              <SidebarGroup key={group.title}>
                <SidebarGroupLabel className="gap-2 text-xs font-semibold text-muted-foreground">
                  <GroupIcon className="size-3.5" aria-hidden />
                  {group.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>{renderItems(group.items)}</SidebarGroupContent>
              </SidebarGroup>
            );
          }
          return (
            <Collapsible key={group.title} defaultOpen className="group/collapsible" suppressHydrationWarning>
              <SidebarGroup>
                <CollapsibleTrigger asChild suppressHydrationWarning>
                  <SidebarGroupLabel
                    className="group flex cursor-pointer items-center justify-between text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    suppressHydrationWarning
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon className="size-3.5" aria-hidden />
                      {group.title}
                    </span>
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent suppressHydrationWarning>
                  <SidebarGroupContent>{renderItems(group.items)}</SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-2" suppressHydrationWarning>
        {!isMounted ? (
          <Button
            variant="ghost"
            disabled
            className="h-auto w-full justify-start gap-2 p-2 group-data-[collapsible=icon]:justify-center"
          >
            <Avatar className="size-7">
              <AvatarImage src={user.image ?? undefined} alt="" />
              <AvatarFallback className="text-xs">{initials(user)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-medium">{fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild suppressHydrationWarning>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2 p-2 group-data-[collapsible=icon]:justify-center"
                suppressHydrationWarning
              >
                <Avatar className="size-7">
                  <AvatarImage src={user.image ?? undefined} alt="" />
                  <AvatarFallback className="text-xs">{initials(user)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-xs font-medium">{fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60" suppressHydrationWarning>
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="truncate text-xs font-medium">{fullName}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                <Badge variant={roleVariant(user.role)} className="w-fit">
                  {roleLabel(user.role)}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild className="text-xs">
                  <Link href="/account">
                    <User className="size-3.5" />
                    Ο λογαριασμός μου
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-xs">
                  <Link href="/settings">
                    <Settings className="size-3.5" />
                    Ρυθμίσεις
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <form action={logout}>
                <DropdownMenuItem asChild className="text-xs text-destructive focus:text-destructive">
                  <button type="submit" className="flex w-full items-center">
                    <LogOut className="size-3.5" />
                    Αποσύνδεση
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
