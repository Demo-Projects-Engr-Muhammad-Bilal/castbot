"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useApiResource } from "@/hooks/useApiResource";
import { fetchFromApi } from "@/lib/api-client";
import { LoadingState } from "@/components/ui/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Database,
} from "lucide-react";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/social-icons";

const setupSchema = z.object({
  name: z.string().min(3, "Workspace name must be at least 3 characters long."),
  platforms: z.array(z.string()).min(1, "Please select at least one target platform capability."),
});

type SetupFormValues = z.infer<typeof setupSchema>;

export function WorkspaceSetupWizard() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  // Profile Sync State
  const [isSyncingProfile, setIsSyncingProfile] = useState(true);
  const [dbUserMissing, setDbUserMissing] = useState(false);
  const hasSyncedRef = useRef(false);

  // Extract Clerk User Data
  const clerkUserId = user?.id || "";
  const clerkEmail = user?.primaryEmailAddress?.emailAddress || "";
  const clerkFullName = user?.fullName || user?.firstName || "User";

  // Attempt user sync / verification call on mount
  useEffect(() => {
    if (isSignedIn && user && !hasSyncedRef.current) {
      hasSyncedRef.current = true;

      const syncUserProfile = async () => {
        setIsSyncingProfile(true);
        try {
          const token = await getToken();
          const res = await fetchFromApi("/workspaces", {}, token);
          const data = await res.json();

          if (!res.ok && data?.error && String(data.error).includes("User account not found")) {
            setDbUserMissing(true);
            setApiError("User profile record is missing in PostgreSQL (local webhook pending).");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("User account not found") || msg.includes("404")) {
            setDbUserMissing(true);
            setApiError("User profile record is missing in PostgreSQL.");
          }
        } finally {
          setIsSyncingProfile(false);
        }
      };

      syncUserProfile();
    } else if (isLoaded && !isSignedIn) {
      setIsSyncingProfile(false);
    }
  }, [isSignedIn, isLoaded, user, getToken]);

  const { data: rawWorkspaces, loading: isCheckingWorkspaces } = useApiResource<any>("/api/workspaces");

  const workspacesList = Array.isArray(rawWorkspaces)
    ? rawWorkspaces
    : rawWorkspaces?.data && Array.isArray(rawWorkspaces.data)
    ? rawWorkspaces.data
    : [];

  useEffect(() => {
    if (!isCheckingWorkspaces && workspacesList.length > 0) {
      router.replace("/dashboard");
    }
  }, [isCheckingWorkspaces, workspacesList, router]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      name: "",
      platforms: ["YOUTUBE", "INSTAGRAM", "FACEBOOK", "TIKTOK"],
    },
  });

  const onSubmit = async (values: SetupFormValues) => {
    setApiError(null);
    try {
      const token = await getToken();
      const res = await fetchFromApi(
        "/workspaces",
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            enabledPlatforms: values.platforms,
          }),
        },
        token
      );

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/dashboard");
      } else {
        if (data?.error && String(data.error).includes("not found")) {
          setDbUserMissing(true);
        }
        setApiError(data.error || "Failed to create workspace.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(msg);
    }
  };

  if (!isLoaded || isSyncingProfile) {
    return <LoadingState message="Synchronizing user profile with Clerk session..." />;
  }

  if (!isSignedIn) {
    return null;
  }

  if (isCheckingWorkspaces || workspacesList.length > 0) {
    return <LoadingState message="Verifying workspace account status..." />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Header Badge & Title */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Step 1 of 1: Workspace Onboarding</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Setup Your Workspace
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Create your brand workspace to manage social destinations, automated publishing pipelines, and channel analytics.
        </p>
      </div>

      {/* Database User Missing Banner */}
      {dbUserMissing && (
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-foreground space-y-3 shadow-md">
          <div className="flex items-center gap-2.5 text-amber-500 font-bold text-sm">
            <Database className="w-4 h-4 shrink-0" />
            <span>Local Development: User DB Record Pending</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Authenticated via Clerk as <strong className="text-foreground">{clerkEmail}</strong> ({clerkUserId}). Since local Clerk webhooks do not reach localhost without a tunnel, run this SQL statement in your Supabase SQL Editor:
          </p>
          <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto flex items-center justify-between border border-slate-800">
            <code>
              INSERT INTO users (id, &quot;clerkId&quot;, email, name, role, &quot;createdAt&quot;, &quot;updatedAt&quot;) VALUES (gen_random_uuid(), &apos;{clerkUserId}&apos;, &apos;{clerkEmail}&apos;, &apos;{clerkFullName}&apos;, &apos;USER&apos;, NOW(), NOW());
            </code>
          </div>
        </div>
      )}

      {/* General Error Alert */}
      {apiError && !dbUserMissing && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Form Card Container */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-10 shadow-xl space-y-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Workspace Name Input */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
              Workspace / Brand Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register("name")}
              type="text"
              placeholder="e.g. Crypto Shorts, Tech News, Gaming Hub"
              disabled={isSubmitting}
              className="w-full bg-background border border-border rounded-xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 transition-all shadow-xs"
            />
            {errors.name && (
              <p className="text-xs text-destructive font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.name.message}</span>
              </p>
            )}
          </div>

          {/* Selectable Platform Cards */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Target Platform Capabilities <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select target video destinations enabled for this workspace.
              </p>
            </div>

            <Controller
              name="platforms"
              control={control}
              render={({ field }) => {
                const isYoutubeChecked = field.value.includes("YOUTUBE");
                const isMetaChecked = field.value.includes("INSTAGRAM") || field.value.includes("FACEBOOK");
                const isTiktokChecked = field.value.includes("TIKTOK");

                const toggleYoutube = () => {
                  if (isYoutubeChecked) {
                    field.onChange(field.value.filter((p) => p !== "YOUTUBE"));
                  } else {
                    field.onChange([...field.value, "YOUTUBE"]);
                  }
                };

                const toggleMeta = () => {
                  if (isMetaChecked) {
                    field.onChange(field.value.filter((p) => p !== "INSTAGRAM" && p !== "FACEBOOK"));
                  } else {
                    const next = new Set([...field.value, "INSTAGRAM", "FACEBOOK"]);
                    field.onChange(Array.from(next));
                  }
                };

                const toggleTiktok = () => {
                  if (isTiktokChecked) {
                    field.onChange(field.value.filter((p) => p !== "TIKTOK"));
                  } else {
                    field.onChange([...field.value, "TIKTOK"]);
                  }
                };

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    {/* Card 1: YouTube Shorts */}
                    <div
                      onClick={toggleYoutube}
                      className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        isYoutubeChecked
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                          <YoutubeIcon className="w-5 h-5 text-red-500" />
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                            isYoutubeChecked
                              ? "bg-primary text-primary-foreground scale-100"
                              : "border border-border bg-background scale-90"
                          }`}
                        >
                          {isYoutubeChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">YouTube Shorts</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Vertical Video Posts</p>
                      </div>
                    </div>

                    {/* Card 2: Meta Reels */}
                    <div
                      onClick={toggleMeta}
                      className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        isMetaChecked
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5 h-10 px-2.5 rounded-xl bg-blue-500/10">
                          <FacebookIcon className="w-4 h-4 text-blue-500" />
                          <InstagramIcon className="w-4 h-4 text-pink-500" />
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                            isMetaChecked
                              ? "bg-primary text-primary-foreground scale-100"
                              : "border border-border bg-background scale-90"
                          }`}
                        >
                          {isMetaChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">Meta Reels</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">FB &amp; Instagram Reels</p>
                      </div>
                    </div>

                    {/* Card 3: TikTok Video */}
                    <div
                      onClick={toggleTiktok}
                      className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                        isTiktokChecked
                          ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                          <TiktokIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                            isTiktokChecked
                              ? "bg-primary text-primary-foreground scale-100"
                              : "border border-border bg-background scale-90"
                          }`}
                        >
                          {isTiktokChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">TikTok Video</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Short-Form Content</p>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            {errors.platforms && (
              <p className="text-xs text-destructive font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.platforms.message}</span>
              </p>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Workspace &amp; Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>AES-256 Encrypted Credentials &amp; Multi-Tenant Security</span>
      </div>
    </div>
  );
}
