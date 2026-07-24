"use client";

import React, { useState } from "react";
import { VideoPublisherForm } from "@/components/publish/VideoPublisherForm";
import { useDataContext } from "@/context/DataContext";
import { JobExecutionInspectorModal, PublishJobDetail } from "@/components/queue/JobExecutionInspectorModal";
import { Film, Clock, Loader2, Eye } from "lucide-react";

export default function PublishPage() {
  const [inspectJob, setInspectJob] = useState<PublishJobDetail | null>(null);
  const { queueJobs, queueLoading, refetchQueue } = useDataContext();

  const jobsList: PublishJobDetail[] = Array.isArray(queueJobs) ? queueJobs : [];

  const activeJobs = jobsList.filter(
    (j) => j.status === "PENDING" || j.status === "PROCESSING" || j.status === "SCHEDULED"
  );

  return (
    <div className="max-w-7xl w-full mx-auto px-2  space-y-8 pb-12 animate-fade-in">
      <div className="flex items-center justify-between pb-6 border-b border-border/60">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Publish Video Engine</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Upload short vertical videos and distribute them across YouTube, Meta, TikTok &amp; Telegram.
          </p>
        </div>
      </div>

      {/* Main Publishing Form */}
      <VideoPublisherForm />

      {/* Active Queue Section */}
      <div id="active-queue-section" className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 pt-4">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Active &amp; Scheduled Queue ({activeJobs.length})</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Jobs currently scheduled, queued, or executing across worker threads.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetchQueue()}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Refresh Queue
          </button>
        </div>

        {queueLoading && jobsList.length === 0 ? (
          <div className="py-8 flex items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Syncing live queue status...
          </div>
        ) : activeJobs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No active or scheduled jobs in queue right now.
          </div>
        ) : (
          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => setInspectJob(job)}
                className="bg-background border border-border/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/50 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground truncate max-w-sm">
                      {job.caption || job.title || "Untitled Publish Job"}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {job.tasks?.length || 0} Platforms · {job.scheduledFor ? `Scheduled for ${new Date(job.scheduledFor).toLocaleString()}` : `Queued ${new Date(job.createdAt).toLocaleTimeString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> {job.status}
                  </span>
                  <button type="button" className="text-xs font-bold text-primary flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Inspect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspector Modal */}
      <JobExecutionInspectorModal
        job={inspectJob}
        isOpen={Boolean(inspectJob)}
        onClose={() => setInspectJob(null)}
      />
    </div>
  );
}
