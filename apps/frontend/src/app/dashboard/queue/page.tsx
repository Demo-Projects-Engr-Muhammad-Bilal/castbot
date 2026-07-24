"use client";

import React from "react";
import { useDataContext } from "@/context/DataContext";
import { QueueDataTable } from "@/components/queue/QueueDataTable";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function QueuePage() {
  const { refetchQueue, queueLoading } = useDataContext();

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Publishing Queue &amp; History
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Monitor real-time worker execution logs, scheduled posts &amp; dispatch history.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={queueLoading}
          onClick={() => refetchQueue()}
          className="w-full sm:w-auto text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer border-border hover:bg-muted/50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh Queue</span>
        </Button>
      </div>

      <QueueDataTable />
    </div>
  );
}
