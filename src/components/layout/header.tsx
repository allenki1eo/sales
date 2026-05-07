"use client";

import { Menu, Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
  onCollapseClick: () => void;
  collapsed: boolean;
  title?: string;
}

export function Header({ onMenuClick, onCollapseClick, collapsed, title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open sidebar</span>
      </Button>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost" size="icon"
        className="hidden lg:flex"
        onClick={onCollapseClick}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed
          ? <PanelLeftOpen className="h-5 w-5" />
          : <PanelLeftClose className="h-5 w-5" />
        }
      </Button>

      {title && <h1 className="text-lg font-semibold hidden sm:block">{title}</h1>}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
