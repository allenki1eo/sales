"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, FilePlus, FileText, Users,
  Package, ShieldCheck, LogOut, Wine, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
}

const navItems = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/requests/new", label: "New Request",  icon: FilePlus },
  { href: "/requests",     label: "All Requests", icon: FileText },
  { href: "/customers",    label: "Customers",    icon: Users },
  { href: "/products",     label: "Products",     icon: Package },
];

export function Sidebar({ mobileOpen, onMobileClose, collapsed }: SidebarProps) {
  const pathname  = usePathname();
  const { data: session } = useSession();

  const isAdmin = session?.user?.role === "admin";
  const initials = session?.user?.name
    ?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "U";

  const roleLabel: Record<string, string> = {
    admin:         "Administrator",
    accountant:    "Accountant",
    sales_officer: "Sales Officer",
  };

  const NavLink = ({ href, label, icon: Icon }: typeof navItems[0]) => {
    const isActive = href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

    const link = (
      <Link
        href={href}
        onClick={onMobileClose}
        className={cn(
          "flex items-center rounded-lg text-sm font-medium transition-all",
          collapsed
            ? "justify-center w-10 h-10 mx-auto"
            : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-sidebar-accent text-white shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground",
          "transition-all duration-300 ease-in-out",
          "lg:static lg:translate-x-0 lg:z-auto",
          collapsed ? "lg:w-[68px]" : "lg:w-64",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border h-14 shrink-0",
          collapsed ? "justify-center px-0" : "justify-between px-4"
        )}>
          {collapsed ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Wine className="h-5 w-5" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <Wine className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">EAS Sales</p>
                  <p className="text-xs text-sidebar-foreground/60 mt-0.5">Management</p>
                </div>
              </div>
              <Button
                variant="ghost" size="icon"
                className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={onMobileClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-4 space-y-1", collapsed ? "px-2" : "px-3")}>
          {navItems.map((item) => <NavLink key={item.href} {...item} />)}

          {isAdmin && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              {!collapsed && (
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Administration
                </p>
              )}
              <NavLink href="/admin" label="Admin Panel" icon={ShieldCheck} />
            </>
          )}
        </nav>

        {/* User section */}
        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-default">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{session?.user?.name}</p>
                  <p className="text-xs opacity-70">{roleLabel[session?.user?.role ?? ""] ?? "User"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg p-2 mb-2">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-sidebar-foreground">
                    {session?.user?.name}
                  </p>
                  <Badge variant="outline" className="text-xs border-sidebar-border text-sidebar-foreground/60 px-1.5 py-0">
                    {roleLabel[session?.user?.role ?? ""] ?? "User"}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
