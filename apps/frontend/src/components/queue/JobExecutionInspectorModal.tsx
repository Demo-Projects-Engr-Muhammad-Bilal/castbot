"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchFromApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent } from "@/components/ui/modal";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Film,
  ExternalLink,
  Layers,
  Terminal,
  RefreshCw,
} from "lucide-react";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/social-icons";

export interface JobTask {
  id: string;
  platform: string;
  provider?: string;
  status: "PENDING" | "PROCESSING" | "SCHEDULED" | "COMPLETED" | "FAILED" | string;
  externalId?: string;
  postUrl?: string;
  errorLog?: string;
  errorMessage?: string;
}

export interface PublishJobDetail {
  id: string;
  videoUrl: string;
  caption?: string;
  title?: string;
  status: "PENDING" | "PROCESSING" | "SCHEDULED" | "COMPLETED" | "FAILED" | "PARTIAL_SUCCESS" | string;
  tasks?: JobTask[];
  createdAt: string;
  scheduledFor?: string;
}

interface JobExecutionInspectorModalProps {
  job: PublishJobDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export function JobExecutionInspectorModal({
  job,
  isOpen,
  onClose,
  onRefreshParent,
}: JobExecutionInspectorModalProps) {
  const { getToken } = useAuth();
  const [currentJob, setCurrentJob] = useState<PublishJobDetail | null>(job);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    setCurrentJob(job);
  }, [job]);

  // Real-time polling effect every 2000ms while status is active
  useEffect(() => {
    if (!isOpen || !currentJob?.id) return;

    const currentStatus = (currentJob.status || "").toUpperCase();
    const isActiveStatus =
      currentStatus === "PENDING" || currentStatus === "PROCESSING" || currentStatus === "SCHEDULED";

    if (!isActiveStatus) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const pollInterval = setInterval(async () => {
      try {
        const token = await getToken();
        const res = await fetchFromApi(`/scheduled/${currentJob.id}`, {}, token);

        if (res.ok) {
          const resData = await res.json();
          const updatedJob = resData.data || resData.job || resData;
          if (updatedJob && updatedJob.id) {
            setCurrentJob((prev) => ({
              ...prev,
              ...updatedJob,
              status: updatedJob.status || prev?.status,
              tasks: updatedJob.tasks || prev?.tasks,
            }));

            const updatedStatus = (updatedJob.status || "").toUpperCase();
            if (
              updatedStatus === "COMPLETED" ||
              updatedStatus === "FAILED" ||
              updatedStatus === "PARTIAL_SUCCESS"
            ) {
              setIsPolling(false);
              clearInterval(pollInterval);
              if (onRefreshParent) onRefreshParent();
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Job inspector polling error:", err);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [isOpen, currentJob?.id, currentJob?.status, getToken, onRefreshParent]);

  if (!currentJob) return null;

  const tasks = currentJob.tasks || [];

  const getPlatformIcon = (platform: string) => {
    const p = (platform || "").toUpperCase();
    if (p === "YOUTUBE") return <YoutubeIcon className="w-5 h-5 text-red-500 shrink-0" />;
    if (p === "INSTAGRAM" || p === "FACEBOOK" || p === "META") return <InstagramIcon className="w-5 h-5 text-pink-500 shrink-0" />;
    if (p === "TIKTOK") return <TiktokIcon className="w-5 h-5 text-cyan-400 shrink-0" />;
    return <Layers className="w-5 h-5 text-blue-500 shrink-0" />;
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "COMPLETED") {
      return (
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-extrabold flex items-center gap-1 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>COMPLETED</span>
        </span>
      );
    }
    if (s === "FAILED") {
      return (
        <span className="px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-extrabold flex items-center gap-1 shrink-0">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>FAILED</span>
        </span>
      );
    }
    if (s === "PROCESSING") {
      return (
        <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[11px] font-extrabold flex items-center gap-1 shrink-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>PROCESSING</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground text-[11px] font-extrabold flex items-center gap-1 shrink-0">
        <Clock className="w-3.5 h-3.5" />
        <span>PENDING</span>
      </span>
    );
  };

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent maxWidth="max-w-2xl" className="rounded-3xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground truncate max-w-md">
                {currentJob.caption || currentJob.title || "Job Execution Details"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono flex items-center gap-2">
                <span>Job ID: {currentJob.id}</span>
                {isPolling && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-extrabold flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Live Polling
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Job Summary Banner */}
        <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Film className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">Video Asset</p>
              <a
                href={currentJob.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline font-mono truncate max-w-xs flex items-center gap-1"
              >
                <span>View Raw Video Source</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(currentJob.createdAt).toLocaleString()}
            </span>
            {getStatusBadge(currentJob.status)}
          </div>
        </div>

        {/* Platform Task Breakdowns */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Platform Task Dispatches ({tasks.length})
          </h4>

          {tasks.length === 0 ? (
            <div className="p-4 rounded-xl bg-muted/40 text-xs text-muted-foreground text-center">
              No individual platform tasks assigned yet.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isTaskCompleted = (task.status || "").toUpperCase() === "COMPLETED";
                const taskUrl = task.postUrl;

                return (
                  <div
                    key={task.id}
                    className="bg-background border border-border/80 rounded-2xl p-4 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {getPlatformIcon(task.platform || task.provider || "")}
                        <span className="text-xs font-bold text-foreground uppercase">
                          {task.platform || task.provider}
                        </span>
                      </div>
                      {getStatusBadge(task.status)}
                    </div>

                    {isTaskCompleted && (taskUrl || task.externalId) && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-emerald-500 truncate">
                          Uploaded ID: {task.externalId || "Published"}
                        </span>
                        {taskUrl && (
                          <a
                            href={taskUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
                          >
                            <span>View Video Post</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}

                    {(task.errorLog || task.errorMessage) && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-mono whitespace-pre-wrap">
                        {task.errorLog || task.errorMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold rounded-xl cursor-pointer"
          >
            Close Inspector
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
