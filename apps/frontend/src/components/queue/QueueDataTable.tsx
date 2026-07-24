"use client";

import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDataContext } from "@/context/DataContext";
import { fetchFromApi } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";
import { JobExecutionInspectorModal, PublishJobDetail } from "@/components/queue/JobExecutionInspectorModal";
import { Button } from "@/components/ui/button";
import {
  Film,
  Trash2,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Eye,
} from "lucide-react";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/social-icons";

export function QueueDataTable() {
  const { activeWorkspace } = useWorkspace();
  const { getToken } = useAuth();
  const { queueJobs, queueLoading, refetchQueue } = useDataContext();

  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [inspectJob, setInspectJob] = useState<PublishJobDetail | null>(null);

  const jobsList: PublishJobDetail[] = Array.isArray(queueJobs) ? queueJobs : [];

  const activeQueueJobs = jobsList.filter(
    (j) => j.status === "PENDING" || j.status === "PROCESSING" || j.status === "SCHEDULED"
  );
  const historyJobs = jobsList.filter(
    (j) => j.status === "COMPLETED" || j.status === "FAILED"
  );

  const displayJobs = activeTab === "ACTIVE" ? activeQueueJobs : historyJobs;

  const handleDeleteJob = async (jobId: string, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === "PROCESSING") {
      setDeleteError("Cannot cancel an active dispatch job currently executing on workers.");
      return;
    }

    setDeletingId(jobId);
    setDeleteError(null);

    try {
      const token = await getToken();
      const res = await fetchFromApi(
        `/scheduled/${jobId}`,
        {
          method: "DELETE",
          headers: {
            "x-tenant-id": activeWorkspace?.id || "",
          },
        },
        token
      );

      if (res.ok) {
        refetchQueue();
      } else {
        setDeleteError("Failed to cancel job. It may currently be executing on the worker.");
      }
    } catch {
      setDeleteError("Failed to cancel job. It may currently be executing on the worker.");
    } finally {
      setDeletingId(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toUpperCase();
    if (p === "YOUTUBE") return <YoutubeIcon key="yt" className="w-4 h-4 text-red-500" />;
    if (p === "INSTAGRAM" || p === "FACEBOOK" || p === "META") return <InstagramIcon key="ig" className="w-4 h-4 text-pink-500" />;
    if (p === "TIKTOK") return <TiktokIcon key="tt" className="w-4 h-4 text-cyan-400" />;
    return null;
  };

  if (queueLoading && jobsList.length === 0) {
    return <LoadingState message="Syncing publishing queue jobs..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error Alert */}
      {deleteError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchQueue()} className="text-xs cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("ACTIVE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "ACTIVE"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          Active Queue ({activeQueueJobs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HISTORY")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "HISTORY"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          Scheduled &amp; History ({historyJobs.length})
        </button>
      </div>

      {/* Data Table Wrapper */}
      <div className="bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden">
        {displayJobs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-foreground">No Jobs Found</h4>
            <p className="text-xs text-muted-foreground">
              {activeTab === "ACTIVE"
                ? "No publish jobs currently pending or executing in queue."
                : "No past published or completed job history."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3.5 px-4">Video / Caption</th>
                  <th className="py-3.5 px-4">Destinations</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Target Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs font-medium">
                {displayJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => setInspectJob(job)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Film className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground truncate max-w-xs sm:max-w-sm">
                            {job.caption || job.title || "Untitled Video Job"}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            ID: {job.id.substring(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {(job.tasks || []).map((t, idx) => (
                          <span key={t.id || idx} title={t.platform}>
                            {getPlatformIcon(t.platform)}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {job.status === "COMPLETED" ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      ) : job.status === "FAILED" ? (
                        <span className="px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      ) : job.status === "PROCESSING" ? (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processing
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3" /> {job.status}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px] text-muted-foreground">
                      {job.scheduledFor
                        ? new Date(job.scheduledFor).toLocaleString()
                        : new Date(job.createdAt).toLocaleTimeString()}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectJob(job);
                          }}
                          className="h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                        </Button>

                        <button
                          type="button"
                          disabled={job.status === "PROCESSING" || deletingId === job.id}
                          title={job.status === "PROCESSING" ? "Cannot cancel an active dispatch job" : "Cancel Job"}
                          onClick={(e) => handleDeleteJob(job.id, job.status, e)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            job.status === "PROCESSING"
                              ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
                              : "border-destructive/30 hover:bg-destructive/10 text-destructive"
                          }`}
                        >
                          {deletingId === job.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : job.status === "PROCESSING" ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
