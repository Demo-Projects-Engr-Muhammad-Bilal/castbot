"use client";

import React, { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { DataProvider } from "@/context/DataContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { BillingPortalButton } from "@/components/dashboard/BillingPortalButton";
import { CreateWorkspaceModal } from "@/components/dashboard/CreateWorkspaceModal";
import { Zap, Menu } from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = "castbot_sidebar_collapsed";

function WorkspacePlanBadge() {
  const { activeWorkspace } = useWorkspace();
  const rawPlan = activeWorkspace?.planTier || activeWorkspace?.plan || activeWorkspace?.tier || "FREE";
  const plan = String(rawPlan).toUpperCase();

  const badgeStyles: Record<string, string> = {
    AGENCY: "bg-purple-600/20 text-purple-400 border-purple-500/30",
    PRO: "bg-blue-600/20 text-blue-400 border-blue-500/30",
    FREE: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border flex items-center gap-1 shadow-xs ${
        badgeStyles[plan] || badgeStyles.FREE
      }`}
    >
      <Zap className="w-3 h-3" />
      <span>{plan} PLAN</span>
    </span>
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isModalOpen, closeModal } = useWorkspace();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <DataProvider>
      <div className="relative min-h-screen flex bg-slate-50/50 dark:bg-slate-950/50 text-foreground antialiased select-none">
        {/* Collapsible Desktop Sidebar & Mobile Slide-Over Drawer */}
        <AppSidebar
          isCollapsed={isCollapsed}
          onToggle={toggleSidebar}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Minimal Sticky Top Header */}
          <header className="sticky top-0 z-20 w-full h-14 border-b border-border/60 bg-background/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Hamburger Toggle Button (lg:hidden) */}
              <button
                type="button"
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                title="Open Mobile Menu"
              >
                <Menu className="w-4 h-4" />
              </button>

              <WorkspaceSwitcher />
              <WorkspacePlanBadge />
            </div>

            <div className="flex items-center gap-3">
              <BillingPortalButton variant="outline" className="hidden sm:inline-flex text-[11px]" />
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8 rounded-full ring-2 ring-primary/20 hover:scale-105 transition-transform",
                  },
                }}
              />
            </div>
          </header>

          {/* Dynamic Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Single shared instance: controlled entirely through WorkspaceContext
            so no descendant needs to own its own create-workspace modal state. */}
        <CreateWorkspaceModal isOpen={isModalOpen} onClose={closeModal} />
      </div>
    </DataProvider>
  );
}
