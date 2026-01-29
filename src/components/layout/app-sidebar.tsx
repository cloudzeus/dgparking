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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Car,
  Settings,
  Shield,
  UserCog,
  Building2,
  LogOut,
  ChevronDown,
  User,
  Edit,
  Database,
  Plug,
  Link2,
  Network,
  FileText,
  Clock,
  Camera,
  BarChart3,
  ArrowDownRight,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { getRoleBadgeColor } from "@/lib/role-colors";

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
    title: "OVERVIEW",
    icon: LayoutDashboard,
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"],
      },
    ],
  },
  {
    title: "MANAGEMENT",
    icon: Users,
    items: [
      {
        title: "Users",
        href: "/users",
        icon: Users,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Parking",
        href: "/parking",
        icon: Car,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "Locations",
        href: "/locations",
        icon: Building2,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "SoftOne ERP",
        href: "/softone",
        icon: Database,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "Contracts",
        href: "/contracts",
        icon: FileText,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "License plates",
        href: "/items",
        icon: Database,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE"],
      },
      {
        title: "Integrations",
        href: "/integrations",
        icon: Network,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "REPORTS",
    icon: BarChart3,
    items: [
      {
        title: "OUT Without IN",
        href: "/reports/out-without-in",
        icon: ArrowDownRight,
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    title: "API CONNECTORS",
    icon: Plug,
    items: [
      {
        title: "Customers 2 ERP",
        href: "/customers-2-erp",
        icon: Link2,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    title: "ACCOUNT",
    icon: UserCog,
    items: [
      {
        title: "My Account",
        href: "/account",
        icon: UserCog,
        roles: ["ADMIN", "MANAGER", "EMPLOYEE", "CLIENT"],
      },
      {
        title: "Cron Logs",
        href: "/account/cron-logs",
        icon: Clock,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "LPR Logs",
        href: "/lpr-logs",
        icon: Camera,
        roles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["ADMIN"],
      },
    ],
  },
];

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


  return (
    <Sidebar collapsible="icon" className="border-0">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2 justify-center group-data-[collapsible=icon]:justify-center">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
            <Car className="h-5 w-5 text-primary-foreground flex-shrink-0" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-sm font-bold tracking-tight">KOLLERIS</h2>
            </div>
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
                <SidebarGroupLabel className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                  <div className="flex items-center gap-2">
                    <GroupIcon className="h-3 w-3" />
                    {group.title}
                  </div>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className="h-9"
                          >
                            <Link href={item.href}>
                              <Icon className="h-4 w-4" />
                              <span className="text-[11px]">{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }
          return (
            <Collapsible 
              key={group.title} 
              defaultOpen 
              className="group/collapsible"
              suppressHydrationWarning
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild suppressHydrationWarning>
                  <SidebarGroupLabel 
                    className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-violet-600 hover:text-violet-700 transition-colors cursor-pointer group"
                    suppressHydrationWarning
                  >
                    <div className="flex items-center gap-2">
                      <GroupIcon className="h-3 w-3" />
                      {group.title}
                    </div>
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent suppressHydrationWarning>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              className="h-9"
                            >
                              <Link href={item.href}>
                                <Icon className="h-4 w-4" />
                                <span className="text-[11px]">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-4" suppressHydrationWarning>
        {!isMounted ? (
          // Simple non-interactive version for SSR
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-lg bg-muted/50 p-3"
            disabled
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-xs font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user.email}
              </p>
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[7px] font-medium mt-1 ${getRoleBadgeColor(
                  user.role
                )}`}
              >
                {user.role}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild suppressHydrationWarning>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-3 rounded-lg bg-muted/50 p-3 hover:bg-muted/70 transition-colors"
                suppressHydrationWarning
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden text-left">
                  <p className="truncate text-xs font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {user.email}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[7px] font-medium mt-1 ${getRoleBadgeColor(
                      user.role
                    )}`}
                  >
                    {user.role}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" suppressHydrationWarning>
              <DropdownMenuLabel className="text-xs">
                {user.firstName} {user.lastName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-xs">
                <Link href="/account">
                  <User className="mr-2 h-3 w-3" />
                  My Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-xs">
                <Link href="/account">
                  <Edit className="mr-2 h-3 w-3" />
                  Edit Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={logout}>
                <DropdownMenuItem asChild className="text-xs text-destructive focus:text-destructive">
                  <button type="submit" className="w-full flex items-center">
                    <LogOut className="mr-2 h-3 w-3" />
                    Sign Out
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

