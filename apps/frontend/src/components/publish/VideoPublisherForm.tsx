"use client";

import { SubscriptionModal } from "@/components/dashboard/SubscriptionModal";
import { InstagramIcon, TiktokIcon, YoutubeIcon } from "@/components/social-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getPlanConfig } from "@/config/plans";
import { useDataContext } from "@/context/DataContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fetchFromApi } from "@/lib/api-client";
import { useAuth } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  Sparkles,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const publisherFormSchema = z.object({
  title: z.string().trim().min(1, "Please enter a video title.").max(100),
  description: z.string().max(5000).optional().default(""),
  selectedPlatforms: z.array(z.string()).min(1, "Please select at least one target platform."),
  publishMode: z.enum(["IMMEDIATE", "SCHEDULED"]),
  scheduledDateStr: z.string(),
  scheduledTimeStr: z.string(),
});

type PublisherFormValues = z.infer<typeof publisherFormSchema>;

export function VideoPublisherForm() {
  const { activeWorkspace } = useWorkspace();
  const { getToken } = useAuth();
  const { accounts, accountsLoading, refetchQueue, refetchMetrics } = useDataContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const planConfig = getPlanConfig(activeWorkspace?.planTier);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PublisherFormValues>({
    resolver: zodResolver(publisherFormSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      selectedPlatforms: [],
      publishMode: "IMMEDIATE",
      scheduledDateStr: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      scheduledTimeStr: "09:00",
    },
  });

  const title = watch("title");
  const description = watch("description");
  const selectedPlatforms = watch("selectedPlatforms");
  const publishMode = watch("publishMode");
  const scheduledDateStr = watch("scheduledDateStr");
  const scheduledTimeStr = watch("scheduledTimeStr");

  // Form State (non-RHF: raw File object + derived preview URL)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);

  const accountsList: any[] = Array.isArray(accounts) ? accounts : [];

  const connectedProviders = accountsList
    .filter((a) => a.connected)
    .map((a) => a.provider);

  const platformDefinitions = [
    { id: "YOUTUBE", label: "YouTube Shorts", icon: YoutubeIcon, color: "text-red-500" },
    { id: "META", label: "Meta Reels", icon: InstagramIcon, color: "text-pink-500" },
    { id: "TIKTOK", label: "TikTok Video", icon: TiktokIcon, color: "text-cyan-400" },
  ];

  const availablePlatforms = platformDefinitions.filter((p) => {
    if (p.id === "META") {
      return connectedProviders.includes("FACEBOOK") || connectedProviders.includes("INSTAGRAM");
    }
    return connectedProviders.includes(p.id);
  });

  const getCombinedScheduledDate = (): Date => {
    return new Date(`${scheduledDateStr}T${scheduledTimeStr}:00`);
  };

  const formattedScheduledText = () => {
    const d = getCombinedScheduledDate();
    if (isNaN(d.getTime())) return "Select Date & Time";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("video/")) {
      setSubmitError("Please select a valid video file (.mp4, .mov, .webm).");
      return;
    }
    setSelectedFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setSubmitError(null);
  };

  const togglePlatform = (pId: string) => {
    if (selectedPlatforms.includes(pId)) {
      setValue("selectedPlatforms", selectedPlatforms.filter((id) => id !== pId), { shouldValidate: true });
    } else {
      setValue("selectedPlatforms", [...selectedPlatforms, pId], { shouldValidate: true });
    }
  };

  const handleSelectAllPlatforms = () => {
    if (selectedPlatforms.length === availablePlatforms.length) {
      setValue("selectedPlatforms", [], { shouldValidate: true });
    } else {
      setValue("selectedPlatforms", availablePlatforms.map((p) => p.id), { shouldValidate: true });
    }
  };

  const onSubmit = async (values: PublisherFormValues) => {
    if (!selectedFile) {
      setSubmitError("Please upload a video file.");
      return;
    }

    const targetTenantId = activeWorkspace?.id?.trim();
    if (!targetTenantId) {
      setSubmitError("No active workspace selected.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const token = await getToken();

      const combinedCaption = `${values.title.trim()}${values.description?.trim() ? `\n\n${values.description.trim()}` : ""}`;

      console.log("🚀 [VideoPublisherForm] Dispatching publish request for tenant ID:", targetTenantId);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("video", selectedFile);
      formData.append("title", values.title.trim());
      formData.append("caption", combinedCaption);
      formData.append("platforms", JSON.stringify(values.selectedPlatforms));
      formData.append("publishMode", values.publishMode);

      if (values.publishMode === "SCHEDULED") {
        const scheduledDateObj = getCombinedScheduledDate();
        formData.append("scheduledFor", scheduledDateObj.toISOString());
      }

      const res = await fetchFromApi(
        "/publish",
        {
          method: "POST",
          body: formData,
        },
        token
      );

      console.log("📡 [VideoPublisherForm] Response status code:", res.status);

      const contentType = res.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      }

      if (res.ok && (data.success || data.id || data.jobId)) {
        setSubmitSuccess(
          values.publishMode === "SCHEDULED"
            ? `Video dispatch successfully scheduled for ${formattedScheduledText()}!`
            : "Video job dispatched to queue!"
        );
        setSelectedFile(null);
        setVideoPreviewUrl(null);
        reset({
          title: "",
          description: "",
          selectedPlatforms: [],
          publishMode: "IMMEDIATE",
          scheduledDateStr: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          scheduledTimeStr: "09:00",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        // Trigger DataContext cache updates
        refetchQueue();
        refetchMetrics();

        setTimeout(() => {
          document.getElementById("active-queue-section")?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      } else {
        setSubmitError(data.error || data.message || `Publish dispatch failed with status ${res.status}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("❌ [VideoPublisherForm] Exception during submit:", msg);
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Alerts */}
        {submitError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {/* Video Upload Dropzone */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-4">
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
            Video Source File <span className="text-destructive">*</span>
          </label>

          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-muted/20 hover:bg-primary/5 flex flex-col items-center justify-center space-y-3"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Click to upload or drag &amp; drop</p>
                <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                  MP4, MOV, or WEBM (Max 500MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-border bg-slate-950 max-h-[320px] flex items-center justify-center">
                {videoPreviewUrl && (
                  <video src={videoPreviewUrl} controls className="max-h-[320px] w-auto rounded-xl" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setVideoPreviewUrl(null);
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-red-600 transition-all cursor-pointer shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-mono text-muted-foreground truncate">
                File: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            </div>
          )}
        </div>

        {/* Video Metadata */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-foreground pb-3 border-b border-border/60">
            Metadata &amp; Description
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Video Title <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground font-mono">{title?.length || 0} / 100</span>
              </div>
              <Input
                type="text"
                maxLength={100}
                placeholder="Catchy title for YouTube, TikTok & Reels..."
                disabled={isSubmitting}
                {...register("title")}
              />
              {errors.title && (
                <p className="text-[11px] text-destructive mt-1">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Description / Caption
              </label>
              <Textarea
                rows={4}
                placeholder="Write your video caption, hashtags (#shorts #reels), or description..."
                disabled={isSubmitting}
                {...register("description")}
              />
            </div>
          </div>
        </div>

        {/* Target Platforms Selector */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div>
              <h3 className="text-base font-bold text-foreground">Target Destinations</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select connected platforms for automated distribution.
              </p>
            </div>

            {availablePlatforms.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllPlatforms}
                className="text-xs font-bold text-primary hover:bg-primary/10 rounded-xl cursor-pointer"
              >
                {selectedPlatforms.length === availablePlatforms.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>

          {accountsLoading && accountsList.length === 0 ? (
            <div className="py-6 flex items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading connected channels...
            </div>
          ) : availablePlatforms.length === 0 ? (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-center space-y-3">
              <p className="text-xs font-bold">No connected channels found in this workspace.</p>
              <Link href="/dashboard/accounts">
                <Button size="sm" className="bg-amber-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer">
                  Connect Channels Now
                </Button>
              </Link>
            </div>
          ) : (
            <Controller
              control={control}
              name="selectedPlatforms"
              render={() => (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {availablePlatforms.map((p) => {
                    const Icon = p.icon;
                    const isSelected = selectedPlatforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border/80 bg-background text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${p.color}`} />
                        <span className="truncate">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          )}
          {errors.selectedPlatforms && (
            <p className="text-[11px] text-destructive">{errors.selectedPlatforms.message}</p>
          )}
        </div>

        {/* Scheduling & Publish CTA */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-foreground pb-3 border-b border-border/60">
            Publish Dispatch Timing
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setValue("publishMode", "IMMEDIATE")}
              className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                publishMode === "IMMEDIATE"
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="font-bold">Publish Immediately</p>
                <p className="text-[10px] text-muted-foreground font-normal">Enqueue for instant worker dispatch</p>
              </div>
            </button>

            {/* Scheduled Mode (Locked on Free Plan) */}
            <div className="relative">
              {!planConfig.allowScheduling && (
                <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-xs rounded-2xl flex items-center justify-between p-3 border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-bold text-foreground">Locked on Free Plan</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsSubModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] rounded-lg cursor-pointer"
                  >
                    <Zap className="w-3 h-3 mr-1" /> Upgrade
                  </Button>
                </div>
              )}

              <button
                type="button"
                onClick={() => planConfig.allowScheduling && setValue("publishMode", "SCHEDULED")}
                disabled={!planConfig.allowScheduling}
                className={`w-full p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 transition-all cursor-pointer ${
                  publishMode === "SCHEDULED"
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <Clock className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="text-left">
                  <p className="font-bold">Schedule for Later</p>
                  <p className="text-[10px] text-muted-foreground font-normal">Pick target release date &amp; time</p>
                </div>
              </button>
            </div>
          </div>

          {/* Clean SaaS Date & Time Popover Picker */}
          {publishMode === "SCHEDULED" && planConfig.allowScheduling && (
            <div className="p-5 rounded-2xl bg-muted/30 border border-border/80 space-y-4 animate-fade-in relative">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Target Release Schedule
                </label>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-extrabold uppercase">
                  {formattedScheduledText()}
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-background border border-border/80 rounded-xl text-xs font-bold text-foreground hover:border-primary/50 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span>{formattedScheduledText()}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isDatePickerOpen ? "rotate-180" : ""}`} />
                </button>

                {isDatePickerOpen && (
                  <div className="absolute left-0 mt-2 w-full max-w-md bg-card border border-border/80 rounded-2xl p-4 shadow-xl z-30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Target Date</label>
                        <Input type="date" mono {...register("scheduledDateStr")} className="px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Target Time</label>
                        <Input type="time" mono {...register("scheduledTimeStr")} className="px-3 py-2" />
                      </div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="bg-primary text-primary-foreground font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Confirm Schedule
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3 px-8 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enqueuing Dispatch...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>{publishMode === "SCHEDULED" ? "Schedule Video Post" : "Publish Video Now"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Subscription Upgrade Modal */}
      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
      />
    </div>
  );
}