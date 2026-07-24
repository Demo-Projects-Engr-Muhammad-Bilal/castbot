"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Share2,
  UploadCloud,
  ListOrdered,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Social Accounts", href: "/dashboard/accounts", icon: Share2 },
  { label: "Publish Video", href: "/dashboard/publish", icon: UploadCloud },
  { label: "Queue & History", href: "/dashboard/queue", icon: ListOrdered },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

interface SidebarNavListProps {
  isCollapsed: boolean;
  onNavigate?: () => void;
  itemClassName: (isActive: boolean) => string;
}

/**
 * Shared nav-link rendering logic for both the desktop sidebar and the
 * mobile slide-over drawer, so the link list and active-state logic only
 * exist in one place.
 */
function SidebarNavList({ isCollapsed, onNavigate, itemClassName }: SidebarNavListProps) {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            title={isCollapsed ? item.label : undefined}
            onClick={onNavigate}
            className={itemClassName(isActive)}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </Link>
        );
      })}
    </>
  );
}

export function AppSidebar({
  isCollapsed,
  onToggle,
  isMobileOpen = false,
  onMobileClose,
}: AppSidebarProps) {
  return (
    <>
      {/* 1. Desktop Sidebar (Hidden on Mobile < lg) */}
      <aside
        className={`hidden lg:flex relative sticky top-0 h-screen border-r border-border/80 bg-background/95 backdrop-blur-md flex-col justify-between transition-all duration-300 z-30 select-none ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Top Branding Header */}
        <div
          className={`px-3 py-3 border-b border-border/60 flex items-center h-14 ${
            isCollapsed ? "justify-center relative" : "justify-between"
          }`}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative overflow-hidden rounded-lg shrink-0 shadow-xs ring-1 ring-border">
              <Image
                src="/logo/logo.jpeg"
                alt="CastBot Logo"
                width={32}
                height={32}
                className="rounded-lg object-cover"
                priority
              />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-black tracking-tight text-foreground whitespace-nowrap">
                Cast<span className="text-primary">Bot</span>
              </span>
            )}
          </Link>

          {/* Top Repositioned Collapse Toggle Button */}
          <button
            type="button"
            onClick={onToggle}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer ${
              isCollapsed ? "absolute -right-3 top-4 shadow-sm z-40 bg-card" : ""
            }`}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto">
          <SidebarNavList
            isCollapsed={isCollapsed}
            itemClassName={(isActive) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`
            }
          />
        </div>

        {/* Simplified Clean Footer */}
        {!isCollapsed && (
          <div className="p-3 border-t border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold px-1">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">CastBot v2.0</span>
            </div>
          </div>
        )}
      </aside>

      {/* 2. Mobile Drawer Overlay (Visible on screens < 1024px when isMobileOpen === true) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex animate-fade-in select-none">
          {/* Backdrop Listener */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
          />

          {/* Mobile Drawer Content */}
          <aside className="relative z-10 w-72 max-w-[80vw] h-full bg-background border-r border-border/80 shadow-2xl flex flex-col justify-between p-4">
            {/* Top Mobile Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <Link href="/dashboard" onClick={onMobileClose} className="flex items-center gap-2.5">
                <Image
                  src="/logo/logo.jpeg"
                  alt="CastBot Logo"
                  width={32}
                  height={32}
                  className="rounded-lg object-cover"
                />
                <span className="text-lg font-black tracking-tight text-foreground">
                  Cast<span className="text-primary">Bot</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={onMobileClose}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="flex-1 py-4 space-y-1.5 overflow-y-auto">
              <SidebarNavList
                isCollapsed={false}
                onNavigate={onMobileClose}
                itemClassName={(isActive) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`
                }
              />
            </div>

            {/* Mobile Footer */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>CastBot v2.0</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
