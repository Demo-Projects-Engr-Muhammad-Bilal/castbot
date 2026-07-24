"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDataContext } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Calendar,
  CheckCircle2,
  Activity,
  PlusCircle,
  Link2,
  Clock,
  Sparkles,
  TrendingUp,
  Loader2,
  Video,
  FolderPlus,
} from "lucide-react";

export function OverviewMetrics() {
  const { activeWorkspace, openCreateModal } = useWorkspace();
  const { metrics, metricsLoading } = useDataContext();

  const {
    connectedAccountsCount,
    scheduledQueueCount,
    publishedVideosCount,
    recentActivity,
    enabledPlatformsCount,
  } = useMemo(() => {
    const metricsData = metrics?.data || metrics || {};
    const recentActivityList = Array.isArray(metricsData.recentActivity) ? metricsData.recentActivity : [];

    return {
      connectedAccountsCount:
        metricsData.connectedAccounts ?? (activeWorkspace?.connectedSocialAccounts?.length || 0),
      scheduledQueueCount: metricsData.scheduledQueue ?? 0,
      publishedVideosCount: metricsData.publishedVideos ?? 0,
      recentActivity: recentActivityList,
      enabledPlatformsCount: activeWorkspace?.enabledPlatforms?.length || 0,
    };
  }, [metrics, activeWorkspace?.connectedSocialAccounts, activeWorkspace?.enabledPlatforms]);

  const recentActivityFormatted = useMemo(
    () =>
      recentActivity.map((job: any) => ({
        ...job,
        formattedTime: new Date(job.createdAt).toLocaleTimeString(),
      })),
    [recentActivity]
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 4 Top Metric Cards (Dynamic Responsive Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Connected Accounts */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Connected Accounts
            </span>
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            {metricsLoading && !metrics ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {connectedAccountsCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="text-emerald-500 font-semibold flex items-center">
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                    Active
                  </span>{" "}
                  across {enabledPlatformsCount} capabilities
                </p>
              </>
            )}
          </div>
        </div>

        {/* Metric 2: Scheduled Queue */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Scheduled Queue
            </span>
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            {metricsLoading && !metrics ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {scheduledQueueCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pending automated publishing</p>
              </>
            )}
          </div>
        </div>

        {/* Metric 3: Published Videos */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Published Videos
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            {metricsLoading && !metrics ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  {publishedVideosCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Completed video dispatch jobs</p>
              </>
            )}
          </div>
        </div>

        {/* Metric 4: Queue Health */}
        <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Queue Health
            </span>
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span className="text-lg font-bold text-emerald-500">Operational</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">BullMQ &amp; Redis active</p>
          </div>
        </div>
      </div>

      {/* Quick Action Bar (Responsive Flex & Full-Width Buttons on Mobile) */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Quick Actions</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Schedule uploads, connect social channels, or launch workspaces.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link href="/dashboard/publish" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
              <PlusCircle className="w-4 h-4" />
              <span>Schedule New Video</span>
            </Button>
          </Link>

          <Link href="/dashboard/accounts" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer border-border hover:bg-muted/40 whitespace-nowrap"
            >
              <Link2 className="w-4 h-4" />
              <span>Connect Accounts</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={openCreateModal}
            className="w-full sm:w-auto text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer border-border hover:bg-muted/40 text-primary whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create Workspace</span>
          </Button>
        </div>
      </div>

      {/* Recent Activity Stream (With Overflow Horizontal Wrapper) */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Live Logs</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-full divide-y divide-border/60">
            {recentActivityFormatted.length > 0 ? (
              recentActivityFormatted.map((job: any) => (
                <div key={job.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate max-w-xs sm:max-w-sm">
                        {job.caption || "Untitled Video Job"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Status: <span className="font-semibold uppercase">{job.status}</span> · {job.tasks?.length || 0} Platform Tasks
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {job.formattedTime}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Workspace Initialized</p>
                    <p className="text-[11px] text-muted-foreground">
                      Workspace &apos;{activeWorkspace?.name || "Main Workspace"}&apos; ready for video dispatch.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">Just now</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
