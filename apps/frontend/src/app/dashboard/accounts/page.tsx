"use client";

import React from "react";
import { useDataContext } from "@/context/DataContext";
import { SocialAccountsGrid } from "@/components/accounts/SocialAccountsGrid";
import { Button } from "@/components/ui/button";
import { RefreshCw, Share2 } from "lucide-react";

export default function SocialAccountsPage() {
  const { refetchAccounts, accountsLoading } = useDataContext();

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-foreground tracking-tight">Social Accounts</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold flex items-center gap-1">
              <Share2 className="w-3 h-3" />
              <span>Channel Integration</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Connect and manage target publishing destinations for this workspace.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={accountsLoading}
          onClick={() => refetchAccounts()}
          className="text-xs font-semibold py-2 px-3.5 rounded-xl flex items-center gap-2 cursor-pointer border-border hover:bg-muted/50 shadow-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${accountsLoading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh Accounts</span>
        </Button>
      </div>

      <SocialAccountsGrid />
    </div>
  );
}
