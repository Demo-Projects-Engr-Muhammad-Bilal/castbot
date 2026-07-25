"use client";

import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDataContext } from "@/context/DataContext";
import { LoadingState } from "@/components/ui/LoadingState";
import { TikTokCookieModal } from "@/components/accounts/TikTokCookieModal";
import { TelegramConnectionModal } from "@/components/accounts/TelegramConnectionModal";
import { SubscriptionModal } from "@/components/dashboard/SubscriptionModal";
import { getPlanConfig } from "@/config/plans";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Key,
  Send,
  Lock,
  Zap,
} from "lucide-react";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/social-icons";

export interface AccountStatusItem {
  id: string | null;
  provider: "YOUTUBE" | "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "TELEGRAM";
  connected: boolean;
  providerAccountId: string;
  updatedAt: string | null;
  status: "ACTIVE" | "EXPIRED" | "NOT_CONNECTED";
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function SocialAccountsGrid() {
  const { activeWorkspace } = useWorkspace();
  const { getToken } = useAuth();
  const { accounts, accountsLoading, refetchAccounts } = useDataContext();

  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [isTikTokModalOpen, setIsTikTokModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const planConfig = getPlanConfig(activeWorkspace?.planTier);

  const accountsList: AccountStatusItem[] = Array.isArray(accounts) ? accounts : [];

  const youtubeAccount = accountsList.find((a) => a.provider === "YOUTUBE");
  const facebookAccount = accountsList.find((a) => a.provider === "FACEBOOK");
  const instagramAccount = accountsList.find((a) => a.provider === "INSTAGRAM");
  const tiktokAccount = accountsList.find((a) => a.provider === "TIKTOK");
  const telegramAccount = accountsList.find((a) => a.provider === "TELEGRAM");

  const isMetaConnected = (facebookAccount?.connected || instagramAccount?.connected) ?? false;

  const handleConnectYoutube = async () => {
    if (!activeWorkspace?.id) return;
    setConnectingProvider("YOUTUBE");
    try {
      const token = await getToken();
      if (!token) return;
      window.location.href = `${BACKEND_URL}/auth/youtube?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(activeWorkspace.id)}`;
    } catch (err) {
      console.error("Failed to initiate YouTube OAuth:", err);
      setConnectingProvider(null);
    }
  };

  const handleConnectMeta = async () => {
    if (!activeWorkspace?.id) return;
    setConnectingProvider("META");
    try {
      const token = await getToken();
      if (!token) return;
      window.location.href = `${BACKEND_URL}/auth/facebook?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(activeWorkspace.id)}`;
    } catch (err) {
      console.error("Failed to initiate Meta OAuth:", err);
      setConnectingProvider(null);
    }
  };

  if (accountsLoading && accountsList.length === 0) {
    return <LoadingState message="Fetching connected social accounts..." />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Grid of 4 Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full">
        {/* Card 1: YouTube Shorts */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full min-h-[300px] space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                <YoutubeIcon className="w-6 h-6 text-red-500" />
              </div>
              {youtubeAccount?.connected ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Not Connected</span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">YouTube Shorts</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Directly upload vertical video clips and shorts to YouTube.
              </p>
            </div>

            {youtubeAccount?.connected && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs font-mono text-muted-foreground truncate">
                Channel ID: {youtubeAccount.providerAccountId}
              </div>
            )}
          </div>

          <div className="pt-2 w-full">
            {youtubeAccount?.connected ? (
              <Button
                variant="outline"
                onClick={handleConnectYoutube}
                disabled={connectingProvider === "YOUTUBE"}
                className="w-full text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                {connectingProvider === "YOUTUBE" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">Re-auth Channel</span>
              </Button>
            ) : (
              <Button
                onClick={handleConnectYoutube}
                disabled={connectingProvider === "YOUTUBE"}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                {connectingProvider === "YOUTUBE" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">Connect YouTube</span>
              </Button>
            )}
          </div>
        </div>

        {/* Card 2: Meta Reels */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full min-h-[300px] space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 h-12 px-3 rounded-2xl bg-blue-500/10 shrink-0">
                <FacebookIcon className="w-5 h-5 text-blue-500" />
                <InstagramIcon className="w-5 h-5 text-pink-500" />
              </div>
              {isMetaConnected ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Not Connected</span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">Meta Reels</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Publish video reels across Facebook Pages &amp; Instagram Business.
              </p>
            </div>

            {isMetaConnected && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs font-mono text-muted-foreground truncate">
                Page ID: {facebookAccount?.providerAccountId || instagramAccount?.providerAccountId}
              </div>
            )}
          </div>

          <div className="pt-2 w-full">
            {isMetaConnected ? (
              <Button
                variant="outline"
                onClick={handleConnectMeta}
                disabled={connectingProvider === "META"}
                className="w-full text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                {connectingProvider === "META" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">Re-auth Meta</span>
              </Button>
            ) : (
              <Button
                onClick={handleConnectMeta}
                disabled={connectingProvider === "META"}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                {connectingProvider === "META" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">Connect Meta</span>
              </Button>
            )}
          </div>
        </div>

        {/* Card 3: TikTok Video */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full min-h-[300px] space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                <TiktokIcon className="w-6 h-6 text-cyan-400" />
              </div>
              {tiktokAccount?.connected ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Not Connected</span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">TikTok Video</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Post short videos directly to TikTok via session cookies.
              </p>
            </div>

            {tiktokAccount?.connected && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs font-mono text-muted-foreground truncate">
                TikTok ID: {tiktokAccount.providerAccountId}
              </div>
            )}
          </div>

          <div className="pt-2 w-full">
            {tiktokAccount?.connected ? (
              <Button
                variant="outline"
                onClick={() => setIsTikTokModalOpen(true)}
                className="w-full text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Update Cookies</span>
              </Button>
            ) : (
              <Button
                onClick={() => setIsTikTokModalOpen(true)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Connect TikTok</span>
              </Button>
            )}
          </div>
        </div>

        {/* Card 4: Telegram Channel (Feature Locked on Free Plan) */}
        <div className="relative bg-card border border-border/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full min-h-[300px] space-y-6 overflow-hidden">
          {!planConfig.allowTelegram && (
            <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-3 animate-fade-in">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Pro Feature Locked</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Upgrade to Pro to connect Telegram.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsSubscriptionModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] py-2 px-3 rounded-xl shadow-xs cursor-pointer truncate whitespace-nowrap"
              >
                <Zap className="w-3 h-3 mr-1 shrink-0" /> Upgrade Plan
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <Send className="w-6 h-6" />
              </div>
              {telegramAccount?.connected ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Not Connected</span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground">Telegram Channel</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Dispatch video posts directly to Telegram channels via bot.
              </p>
            </div>

            {telegramAccount?.connected && (
              <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs font-mono text-muted-foreground truncate">
                Target: {telegramAccount.providerAccountId}
              </div>
            )}
          </div>

          <div className="pt-2 w-full">
            {telegramAccount?.connected ? (
              <Button
                variant="outline"
                onClick={() => setIsTelegramModalOpen(true)}
                className="w-full text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">Update Bot</span>
              </Button>
            ) : (
              <Button
                onClick={() => setIsTelegramModalOpen(true)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-2 truncate whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Connect Telegram</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* TikTok Cookie Modal */}
      <TikTokCookieModal
        isOpen={isTikTokModalOpen}
        onClose={() => setIsTikTokModalOpen(false)}
        onSuccess={() => refetchAccounts()}
      />

      {/* Telegram Connection Modal */}
      <TelegramConnectionModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        onSuccess={() => refetchAccounts()}
      />

      {/* Subscription Upgrade Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
      />
    </div>
  );
}
