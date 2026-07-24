"use client";

import React, { useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { SubscriptionModal } from "@/components/dashboard/SubscriptionModal";
import { Zap } from "lucide-react";

interface BillingPortalButtonProps {
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function BillingPortalButton({
  variant = "outline",
  className = "",
}: BillingPortalButtonProps) {
  const { activeWorkspace } = useWorkspace();
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const rawPlan =
    activeWorkspace?.planTier ||
    activeWorkspace?.plan ||
    activeWorkspace?.tier ||
    "FREE";
  const planTier = String(rawPlan).toUpperCase();

  const badgeColor =
    planTier === "AGENCY"
      ? "bg-purple-600/20 text-purple-400 border-purple-500/30"
      : planTier === "PRO"
      ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
      : "bg-zinc-800 text-zinc-400 border-zinc-700";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        onClick={() => setIsSubscriptionModalOpen(true)}
        className={`font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs ${className}`}
      >
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>Manage Subscription</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${badgeColor}`}>
          {planTier}
        </span>
      </Button>

      {/* Subscription Modal Trigger */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />
    </>
  );
}
