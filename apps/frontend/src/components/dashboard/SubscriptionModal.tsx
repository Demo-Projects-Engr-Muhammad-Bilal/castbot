"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDataContext } from "@/context/DataContext";
import { fetchFromApi } from "@/lib/api-client";
import { STRIPE_PRICES } from "@/config/env.config";
import { Button } from "@/components/ui/button";
import {
  X,
  CheckCircle2,
  Zap,
  Sparkles,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const [mounted, setMounted] = useState(false);
  const { getToken } = useAuth();
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { invalidateAll } = useDataContext();

  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const currentPlan =
    activeWorkspace?.planTier ||
    activeWorkspace?.plan ||
    activeWorkspace?.tier ||
    "FREE";

  const plans = [
    {
      id: "FREE",
      name: "Free Tier",
      priceMonthly: "$0",
      priceYearly: "$0",
      period: "/month",
      description: "Basic starter tools for personal publishing.",
      features: [
        "1 Active Workspace",
        "10 Upload Credits / mo",
        "Community Support",
      ],
      popular: false,
      priceIdMonthly: "",
      priceIdYearly: "",
    },
    {
      id: "PRO",
      name: "Pro Plan",
      priceMonthly: "$29",
      priceYearly: "$24",
      period: "/month",
      description: "For creators & small teams needing multi-channel automation.",
      features: [
        "Up to 3 Workspaces",
        "100 Upload Credits / mo",
        "YouTube, Meta & TikTok",
        "Queue Scheduling",
      ],
      popular: true,
      priceIdMonthly: STRIPE_PRICES.PRO_MONTHLY,
      priceIdYearly: STRIPE_PRICES.PRO_YEARLY,
    },
    {
      id: "AGENCY",
      name: "Agency Tier",
      priceMonthly: "$99",
      priceYearly: "$79",
      period: "/month",
      description: "Unlimited scale for digital agencies and high-volume brands.",
      features: [
        "Unlimited Workspaces",
        "500 Upload Credits / mo",
        "All Social Integrations",
        "Priority Dispatch Queue",
        "Dedicated Support",
      ],
      popular: false,
      priceIdMonthly: STRIPE_PRICES.AGENCY_MONTHLY,
      priceIdYearly: STRIPE_PRICES.AGENCY_YEARLY,
    },
  ];

  const handleSelectPlan = async (plan: (typeof plans)[number]) => {
    if (plan.id.toUpperCase() === String(currentPlan).toUpperCase() || !activeWorkspace?.id) return;
    setUpdatingPlan(plan.id);
    setError(null);
    setSuccessMsg(null);

    // 1. FREE TIER DOWNGRADE (Do NOT call Stripe Checkout!)
    if (plan.id === "FREE") {
      try {
        const token = await getToken();
        console.log("📉 [SubscriptionModal] Executing Free Tier Downgrade via /stripe/downgrade...");
        const res = await fetchFromApi(
          "/stripe/downgrade",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-id": activeWorkspace.id,
            },
          },
          token
        );

        if (res.ok) {
          setSuccessMsg("Workspace downgraded to Free Tier successfully!");
          await refreshWorkspaces();
          await invalidateAll();
          setTimeout(() => {
            onClose();
            setSuccessMsg(null);
          }, 1500);
          return;
        }

        // Fallback local update
        await fetchFromApi(
          `/workspaces/${activeWorkspace.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-id": activeWorkspace.id,
            },
            body: JSON.stringify({
              planTier: "FREE",
              uploadCredits: 10,
            }),
          },
          token
        );

        setSuccessMsg("Workspace downgraded to Free Tier successfully!");
        await refreshWorkspaces();
        await invalidateAll();
        setTimeout(() => {
          onClose();
          setSuccessMsg(null);
        }, 1500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Failed to downgrade workspace.");
      } finally {
        setUpdatingPlan(null);
      }
      return;
    }

    // 2. PRO & AGENCY TIER CHECKOUT WITH EXPLICIT JSON HEADERS AND BINDING PAYLOAD
    const isYearly = billingInterval === "YEARLY";
    const targetPriceId = isYearly ? plan.priceIdYearly : plan.priceIdMonthly;

    const payload = {
      priceId: targetPriceId,
      planType: plan.id,
      billingInterval,
    };

    console.log("💳 [SubscriptionModal] Dispatching Checkout payload:", payload);

    try {
      const token = await getToken();
      const res = await fetchFromApi(
        "/stripe/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": activeWorkspace.id,
          },
          body: JSON.stringify(payload),
        },
        token
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.url) {
        console.log("🌐 [SubscriptionModal] Redirecting to Stripe Checkout URL:", data.url);
        window.location.href = data.url;
        return;
      }

      throw new Error(data.error || data.message || `Checkout initiation failed with status ${res.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("❌ [SubscriptionModal] Checkout error:", msg);
      setError(msg || `Failed to initiate checkout for ${plan.name}.`);
    } finally {
      setUpdatingPlan(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto select-none">
      {/* Backdrop Listener */}
      <div className="fixed inset-0 z-0" onClick={onClose} />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-w-4xl my-auto bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col space-y-6 max-h-[90vh] overflow-y-auto text-card-foreground animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-foreground tracking-tight">
                Subscription &amp; Workspace Plans
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage your active workspace tier and upload credit limits.
              </p>
            </div>
          </div>

          {/* Billing Interval Toggle */}
          <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-2xl border border-border/80 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingInterval("MONTHLY")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                billingInterval === "MONTHLY"
                  ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("YEARLY")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                billingInterval === "YEARLY"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Annual (Save 20%)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Plans Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {plans.map((plan) => {
            const isCurrent = String(currentPlan).toUpperCase() === plan.id.toUpperCase();
            const isLoadingThis = updatingPlan === plan.id;
            const displayedPrice = billingInterval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

            return (
              <div
                key={plan.id}
                className={`relative bg-background border rounded-2xl p-6 flex flex-col justify-between space-y-6 transition-all ${
                  isCurrent
                    ? "border-emerald-500/60 ring-2 ring-emerald-500/20 bg-emerald-500/5"
                    : plan.popular
                    ? "border-primary shadow-lg ring-1 ring-primary/40"
                    : "border-border/80 shadow-sm hover:shadow-md"
                }`}
              >
                {isCurrent ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider shadow-xs flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Current Plan
                  </span>
                ) : plan.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-wider shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Popular
                  </span>
                ) : null}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-foreground">{plan.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-foreground">{displayedPrice}</span>
                    <span className="text-xs text-muted-foreground font-semibold">{plan.period}</span>
                  </div>

                  <ul className="space-y-2.5 pt-2 border-t border-border/40 text-xs">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-foreground font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  {isCurrent ? (
                    <Button
                      disabled
                      className="w-full bg-muted border border-border text-muted-foreground font-bold text-xs rounded-xl opacity-80 cursor-not-allowed"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                      <span>Current Plan</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={Boolean(updatingPlan)}
                      className={`w-full font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                        plan.popular
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                          : "bg-background border border-border hover:bg-muted text-foreground"
                      }`}
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{plan.id === "FREE" ? "Downgrading..." : "Opening Checkout..."}</span>
                        </>
                      ) : (
                        <span>{plan.id === "FREE" ? "Switch to Free Tier" : `Switch to ${plan.name}`}</span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
