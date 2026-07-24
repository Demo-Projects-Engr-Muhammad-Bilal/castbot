"use client";

import React, { useState } from "react";
import { useDataContext } from "@/context/DataContext";
import { WorkspaceSettingsForm } from "@/components/settings/WorkspaceSettingsForm";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const { invalidateAll, metricsLoading } = useDataContext();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await invalidateAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading = metricsLoading || isRefreshing;

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Workspace Settings</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Manage workspace configuration, team members &amp; upload credit allocations.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={handleRefresh}
          className="w-full sm:w-auto text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer border-border hover:bg-muted/50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh Settings</span>
        </Button>
      </div>

      <WorkspaceSettingsForm />
    </div>
  );
}
