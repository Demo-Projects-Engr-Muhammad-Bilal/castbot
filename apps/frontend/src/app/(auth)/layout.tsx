import React from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Zap, ShieldCheck, Globe } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-slate-50 text-slate-900 select-none antialiased">
      {/* Left Column: Branding & Value Prop (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-col justify-between p-12 lg:p-16 relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50/50 to-slate-100 border-r border-slate-200/80">
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Header Logo */}
        <Link href="/" className="flex items-center gap-3 relative z-10 group cursor-pointer w-fit">
          <Image
            src="/logo/logo.jpeg"
            alt="CastBot Logo"
            width={48}
            height={48}
            className="rounded-2xl object-cover shadow-md ring-2 ring-primary/20 group-hover:scale-105 transition-transform"
          />
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              CastBot
              <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-wider">
                v2.0
              </span>
            </span>
            <span className="text-xs text-slate-500 font-medium -mt-0.5">
              Multi-Channel Video Automation
            </span>
          </div>
        </Link>

        {/* Middle Value Proposition Hero */}
        <div className="relative z-10 space-y-8 max-w-lg my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-xs font-extrabold tracking-wider uppercase shadow-xs">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Automated Social Dispatch</span>
          </div>

          <h1 className="text-4xl lg:text-2xl font-black tracking-tight text-slate-900 leading-[1.15]">
            Schedule &amp; Publish Short Videos Across Every Platform in Seconds
          </h1>

          <p className="text-slate-600 text-sm leading-relaxed">
            Eliminate manual uploads. Connect your Telegram channels, YouTube Shorts, TikTok, and Meta pages to dispatch video content automatically with full browser stealth.
          </p>

          <div className="space-y-4 pt-2 text-xs font-semibold text-slate-700">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>Automated Telegram-to-Social Pipeline</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span>Stealth Browser &amp; Cloudflare Anti-Detection</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <span>Multi-Platform Dispatch (YouTube, TikTok, Meta &amp; Telegram)</span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 text-xs text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} CastBot Inc. All rights reserved.
        </div>
      </div>

      {/* Right Column: Form Container (Full Width on Mobile) */}
      <div className="relative flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 w-full min-h-screen bg-slate-50">
        {/* Mobile Header Logo (Visible on screens < lg) */}
        <div className="lg:hidden mb-8 flex flex-col items-center gap-3">
          <Link href="/" className="flex flex-col items-center gap-2">
            <Image
              src="/logo/logo.jpeg"
              alt="CastBot Logo"
              width={48}
              height={48}
              className="rounded-2xl object-cover shadow-md ring-2 ring-primary/20"
            />
            <div className="text-center">
              <span className="text-xl font-black text-slate-900">CastBot</span>
              <p className="text-xs text-slate-500">Multi-Channel Video Automation</p>
            </div>
          </Link>
        </div>

        {/* Form Child Container */}
        <div className="w-full max-w-[420px] relative z-10 flex justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
