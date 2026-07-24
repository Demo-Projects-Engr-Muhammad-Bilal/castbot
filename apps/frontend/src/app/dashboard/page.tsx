"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDataContext } from "@/context/DataContext";
import { OverviewMetrics } from "@/components/dashboard/OverviewMetrics";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, X } from "lucide-react";

function OverviewContent() {
  const { refetchMetrics, metricsLoading, invalidateAll } = useDataContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [checkoutSuccessMsg, setCheckoutSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "success") {
      setCheckoutSuccessMsg("🎉 Subscription upgraded successfully! Your workspace limits have been updated.");
      invalidateAll();
      router.replace("/dashboard");
    } else if (checkoutStatus === "cancelled") {
      router.replace("/dashboard");
    }
  }, [searchParams, router, invalidateAll]);

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Checkout Success Banner */}
      {checkoutSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{checkoutSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutSuccessMsg(null)}
            className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Refresh Action (Responsive Flex Wrap) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Overview &amp; Metrics</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Real-time status monitor across connected accounts, publishing queues &amp; workspace activity.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={metricsLoading}
          onClick={() => refetchMetrics()}
          className="w-full sm:w-auto text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer border-border hover:bg-muted/50 shadow-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? "animate-spin text-primary" : ""}`} />
          <span>Refresh Overview</span>
        </Button>
      </div>

      <OverviewMetrics />
    </div>
  );
}

export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-xs text-muted-foreground">Loading overview dashboard...</div>}>
      <OverviewContent />
    </Suspense>
  );
}
