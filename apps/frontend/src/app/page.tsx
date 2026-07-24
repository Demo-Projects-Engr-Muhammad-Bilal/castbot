"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Navbar } from "@/components/layout/Navbar";
import { fetchFromApi } from "@/lib/api-client";
import { STRIPE_PRICES } from "@/config/env.config";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Play,
  Send,
  Calendar,
  Layers,
  ShieldCheck,
  Globe,
  Radio,
  Loader2,
} from "lucide-react";
import {
  YoutubeIcon,
  InstagramIcon,
  FacebookIcon,
  TiktokIcon,
} from "@/components/social-icons";

export default function LandingHomePage() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [activePlatformTab, setActivePlatformTab] = useState<string>("ALL");
  const [selectedLoadingPlan, setSelectedLoadingPlan] = useState<string | null>(null);

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

  const handlePlanAction = async (plan: (typeof plans)[number]) => {
    if (!isSignedIn) {
      router.push("/sign-up");
      return;
    }

    if (plan.id === "FREE") {
      router.push("/dashboard");
      return;
    }

    const targetPriceId =
      billingInterval === "YEARLY" ? plan.priceIdYearly : plan.priceIdMonthly;

    setSelectedLoadingPlan(plan.id);

    try {
      const token = await getToken();
      const activeTenantId =
        typeof window !== "undefined"
          ? localStorage.getItem("castbot_active_workspace_id") || ""
          : "";

      const res = await fetchFromApi(
        "/stripe/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(activeTenantId ? { "x-tenant-id": activeTenantId } : {}),
          },
          body: JSON.stringify({
            planType: plan.id,
            billingInterval,
            priceId: targetPriceId,
          }),
        },
        token
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("❌ Landing checkout error:", err);
      router.push("/dashboard");
    } finally {
      setSelectedLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased">
      {/* 1. Dynamic Glassmorphism Sticky Navbar */}
      <Navbar />

      <main className="flex-1">
        {/* 2. Hero Section & Interactive Live Preview Frame */}
        <section className="relative pt-20 pb-20 md:pt-28 md:pb-32 overflow-hidden bg-radial from-primary/10 via-transparent to-transparent">
          {/* Ambient Glowing Orbs */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center space-y-6 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold tracking-wide uppercase shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Next-Generation Social Media Dispatch Engine</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-foreground">
                Publish Once, Reach Millions{" "}
                <span className="bg-gradient-to-r from-primary via-purple-500 to-indigo-500 bg-clip-text text-transparent">
                  Across Every Platform
                </span>
              </h1>

              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Connect your Telegram channels, YouTube, TikTok, Instagram, and Facebook accounts. CastBot automatically processes, formats, and publishes your video content in seconds.
              </p>

              {/* Dual Action CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href={isSignedIn ? "/dashboard" : "/sign-up"}>
                  <Button className="w-full sm:w-auto h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-extrabold rounded-2xl px-8 shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105">
                    <span>Start Publishing Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>

                <Link href="#pricing">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto h-12 border-border/80 bg-background/80 hover:bg-muted text-sm font-bold rounded-2xl px-8 shadow-xs cursor-pointer"
                  >
                    View Pricing &amp; Plans
                  </Button>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-muted-foreground font-semibold">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Cloudflare &amp; Stealth Evasion</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Real-Time Dispatch Queue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-sky-500" />
                  <span>5 Social Networks Supported</span>
                </div>
              </div>
            </div>

            {/* Interactive Preview Frame (Multi-Platform Dispatch Card) */}
            <div className="mt-16 lg:mt-20 max-w-5xl mx-auto">
              <div className="relative bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden backdrop-blur-xl hover:border-primary/40 transition-all duration-300">
                {/* Top Mock Window Bar */}
                <div className="flex items-center justify-between pb-6 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs font-mono text-muted-foreground">
                      castbot-dispatch-daemon://live-queue
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-extrabold flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse" /> Live Dispatch Engine
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 pt-4 overflow-x-auto pb-2">
                  {["ALL", "YOUTUBE", "TIKTOK", "INSTAGRAM", "TELEGRAM"].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActivePlatformTab(tab)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                        activePlatformTab === tab
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Simulated Dispatch Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  {/* Dispatch Item 1 */}
                  <div className="bg-background border border-border/80 rounded-2xl p-4 space-y-3 shadow-xs hover:-translate-y-1 hover:border-primary/40 transition-all duration-200">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <YoutubeIcon className="w-4 h-4 text-red-500" />
                        <span>YouTube Shorts</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold">
                        Published
                      </span>
                    </div>
                    <div className="h-28 bg-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden group">
                      <Play className="w-8 h-8 text-white/80 group-hover:scale-110 transition-transform" />
                      <span className="absolute bottom-2 left-2 text-[9px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded">
                        0:45 • HD
                      </span>
                    </div>
                    <p className="text-xs font-bold text-foreground truncate">
                      Tech Trends 2026: AI Automation
                    </p>
                  </div>

                  {/* Dispatch Item 2 */}
                  <div className="bg-background border border-border/80 rounded-2xl p-4 space-y-3 shadow-xs hover:-translate-y-1 hover:border-primary/40 transition-all duration-200">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <TiktokIcon className="w-4 h-4 text-sky-400" />
                        <span>TikTok Video</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold">
                        Published
                      </span>
                    </div>
                    <div className="h-28 bg-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden group">
                      <Play className="w-8 h-8 text-white/80 group-hover:scale-110 transition-transform" />
                      <span className="absolute bottom-2 left-2 text-[9px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded">
                        0:30 • 1080p
                      </span>
                    </div>
                    <p className="text-xs font-bold text-foreground truncate">
                      Build Apps Faster with CastBot
                    </p>
                  </div>

                  {/* Dispatch Item 3 */}
                  <div className="bg-background border border-border/80 rounded-2xl p-4 space-y-3 shadow-xs hover:-translate-y-1 hover:border-primary/40 transition-all duration-200">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <InstagramIcon className="w-4 h-4 text-pink-500" />
                        <span>Instagram Reel</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-extrabold flex items-center gap-1">
                        <Zap className="w-3 h-3 animate-spin" /> Processing
                      </span>
                    </div>
                    <div className="h-28 bg-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden group">
                      <Play className="w-8 h-8 text-white/80 group-hover:scale-110 transition-transform" />
                      <span className="absolute bottom-2 left-2 text-[9px] font-mono text-white/70 bg-black/60 px-1.5 py-0.5 rounded">
                        1:00 • 4K
                      </span>
                    </div>
                    <p className="text-xs font-bold text-foreground truncate">
                      Multi-Channel Creator Playbook
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Workflow & HCI Progressive Disclosure Section */}
        <section id="how-it-works" className="py-20 lg:py-32 border-t border-border/60 bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-extrabold tracking-wider uppercase">
                Simple 3-Step Process
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
                How CastBot Automation Works
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Connect your social destinations once. Our background worker daemons automatically pick up, encode, and publish your videos 24/7.
              </p>
            </div>

            {/* 3 Steps Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative bg-background border border-border/80 rounded-3xl p-8 space-y-4 shadow-sm hover:-translate-y-1 hover:border-primary/50 transition-all duration-200">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl">
                  1
                </div>
                <h3 className="text-lg font-bold text-foreground">Connect Accounts</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Link YouTube, TikTok, Facebook, Instagram, and Telegram Bot credentials with one click.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative bg-background border border-border/80 rounded-3xl p-8 space-y-4 shadow-sm hover:-translate-y-1 hover:border-purple-500/50 transition-all duration-200">
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-black text-xl">
                  2
                </div>
                <h3 className="text-lg font-bold text-foreground">Schedule &amp; Queue</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload video files directly or configure Telegram Auto-Pilot to trigger uploads automatically.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative bg-background border border-border/80 rounded-3xl p-8 space-y-4 shadow-sm hover:-translate-y-1 hover:border-emerald-500/50 transition-all duration-200">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-xl">
                  3
                </div>
                <h3 className="text-lg font-bold text-foreground">Auto-Publish Everywhere</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  CastBot handles browser evasion, WAF bypassing, and multi-network dispatch simultaneously.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Platform Integration Showcase */}
        <section id="features" className="py-20 lg:py-32 border-t border-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
                Supported Social Platforms
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Native API integrations and browser stealth automation built for high-volume creators.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="bg-background border border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center shadow-xs hover:-translate-y-1 hover:border-red-500/40 transition-all duration-200">
                <YoutubeIcon className="w-8 h-8 text-red-500" />
                <span className="text-xs font-bold text-foreground">YouTube Shorts</span>
              </div>
              <div className="bg-background border border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center shadow-xs hover:-translate-y-1 hover:border-sky-400/40 transition-all duration-200">
                <TiktokIcon className="w-8 h-8 text-sky-400" />
                <span className="text-xs font-bold text-foreground">TikTok Video</span>
              </div>
              <div className="bg-background border border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center shadow-xs hover:-translate-y-1 hover:border-pink-500/40 transition-all duration-200">
                <InstagramIcon className="w-8 h-8 text-pink-500" />
                <span className="text-xs font-bold text-foreground">Instagram Reels</span>
              </div>
              <div className="bg-background border border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center shadow-xs hover:-translate-y-1 hover:border-blue-600/40 transition-all duration-200">
                <FacebookIcon className="w-8 h-8 text-blue-600" />
                <span className="text-xs font-bold text-foreground">Facebook Reels</span>
              </div>
              <div className="bg-background border border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 text-center shadow-xs hover:-translate-y-1 hover:border-sky-500/40 transition-all duration-200">
                <Send className="w-8 h-8 text-sky-500" />
                <span className="text-xs font-bold text-foreground">Telegram Bot</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Dynamic Pricing Section */}
        <section id="pricing" className="py-20 lg:py-32 border-t border-border/60 bg-muted/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-extrabold tracking-wider uppercase">
                Flexible Monetization
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
                Simple, Transparent Pricing
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                Choose the workspace tier that fits your publishing volume.
              </p>

              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-3 pt-4">
                <div className="flex items-center gap-2 bg-background p-1.5 rounded-2xl border border-border/80 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setBillingInterval("MONTHLY")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      billingInterval === "MONTHLY"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval("YEARLY")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      billingInterval === "YEARLY"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Annual (Save 20%)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => {
                const price = billingInterval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
                const isLoadingThis = selectedLoadingPlan === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`bg-background border rounded-3xl p-8 flex flex-col justify-between space-y-6 transition-all duration-200 hover:-translate-y-1 ${
                      plan.popular
                        ? "border-primary shadow-xl ring-2 ring-primary/40 hover:border-primary"
                        : "border-border/80 shadow-sm hover:shadow-md hover:border-primary/50"
                    }`}
                  >
                    <div className="space-y-4">
                      {plan.popular && (
                        <span className="px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-wider">
                          Most Popular
                        </span>
                      )}
                      <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {plan.description}
                      </p>

                      <div className="flex items-baseline gap-1 pt-2">
                        <span className="text-4xl font-black text-foreground">{price}</span>
                        <span className="text-xs text-muted-foreground font-semibold">{plan.period}</span>
                      </div>

                      <ul className="space-y-3 pt-4 border-t border-border/40 text-xs">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-foreground font-medium">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      onClick={() => handlePlanAction(plan)}
                      disabled={Boolean(selectedLoadingPlan)}
                      className={`w-full font-bold text-xs rounded-xl py-3 flex items-center justify-center gap-2 cursor-pointer ${
                        plan.popular
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                          : "bg-background border border-border hover:bg-muted text-foreground"
                      }`}
                    >
                      {isLoadingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Opening Checkout...</span>
                        </>
                      ) : isSignedIn ? (
                        <span>{plan.id === "FREE" ? "Go to Dashboard" : `Upgrade to ${plan.name}`}</span>
                      ) : (
                        <span>{plan.id === "FREE" ? "Get Started Free" : "Sign Up to Upgrade"}</span>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* 6. Footer Layout */}
      <footer className="border-t border-border bg-card py-12 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm text-foreground tracking-tight">CastBot Inc.</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 font-semibold">
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#features" className="hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>

          <div>&copy; {new Date().getFullYear()} CastBot Inc. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
