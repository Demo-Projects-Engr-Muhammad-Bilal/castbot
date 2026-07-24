"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@clerk/nextjs";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDataContext } from "@/context/DataContext";
import { fetchFromApi } from "@/lib/api-client";
import { SubscriptionModal } from "@/components/dashboard/SubscriptionModal";
import { getPlanConfig } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import {
  Plus,
  Loader2,
  AlertCircle,
  Zap,
  Layers,
} from "lucide-react";
import { YoutubeIcon, InstagramIcon, FacebookIcon, TiktokIcon } from "@/components/social-icons";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Please enter a workspace name."),
  enabledPlatforms: z.array(z.string()).min(1, "Please select at least one target platform."),
});

type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const { getToken } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces } = useWorkspace();
  const { invalidateAll } = useDataContext();
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      enabledPlatforms: ["YOUTUBE", "INSTAGRAM", "FACEBOOK", "TIKTOK"],
    },
  });

  const selectedPlatforms = watch("enabledPlatforms");

  const currentPlanTier = activeWorkspace?.planTier || "PRO";
  const planConfig = getPlanConfig(currentPlanTier);
  const isLimitReached = workspaces.length >= planConfig.maxWorkspaces;

  const handleClose = () => {
    onClose();
  };

  const togglePlatform = (p: string) => {
    if (selectedPlatforms.includes(p)) {
      setValue("enabledPlatforms", selectedPlatforms.filter((i) => i !== p), { shouldValidate: true });
    } else {
      setValue("enabledPlatforms", [...selectedPlatforms, p], { shouldValidate: true });
    }
  };

  const toggleMeta = () => {
    const hasMeta = selectedPlatforms.includes("INSTAGRAM") || selectedPlatforms.includes("FACEBOOK");
    if (hasMeta) {
      setValue(
        "enabledPlatforms",
        selectedPlatforms.filter((p) => p !== "INSTAGRAM" && p !== "FACEBOOK"),
        { shouldValidate: true }
      );
    } else {
      setValue("enabledPlatforms", [...selectedPlatforms, "INSTAGRAM", "FACEBOOK"], { shouldValidate: true });
    }
  };

  const onSubmit = async (values: CreateWorkspaceValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetchFromApi(
        "/workspaces",
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name,
            enabledPlatforms: values.enabledPlatforms,
          }),
        },
        token
      );

      const data = await res.json();

      if (res.ok && (data.id || data.success)) {
        await refreshWorkspaces();
        const createdWs = data.data || data;
        if (createdWs?.id) {
          setActiveWorkspace(createdWs);
        }
        invalidateAll();
        reset();
        onClose();
      } else {
        setError(data.error || "Failed to create workspace.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <ModalContent>
          <ModalHeader
            icon={<Layers className="w-5 h-5" />}
            title="Create New Workspace"
            description="Set up a dedicated workspace for your brand or client."
            onClose={handleClose}
          />

          {isLimitReached ? (
            <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 space-y-4">
              <div className="flex items-start gap-2.5">
                <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold">Workspace Limit Reached</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Your current plan ({currentPlanTier}) allows up to <span className="font-bold text-foreground">{planConfig.maxWorkspaces} workspace(s)</span> ({workspaces.length} / {planConfig.maxWorkspaces} active). Upgrade to create more workspaces.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => setIsSubModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 mr-1" /> Upgrade Subscription
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 flex-1 overflow-y-auto">
              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Workspace Name <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Crypto News Channel"
                  disabled={isSubmitting}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-[11px] text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <Controller
                control={control}
                name="enabledPlatforms"
                render={() => (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                      Enabled Target Platforms
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => togglePlatform("YOUTUBE")}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          selectedPlatforms.includes("YOUTUBE")
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        <YoutubeIcon className="w-5 h-5 text-red-500" />
                        <span className="text-[11px] truncate">YouTube</span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleMeta}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          selectedPlatforms.includes("INSTAGRAM") || selectedPlatforms.includes("FACEBOOK")
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <FacebookIcon className="w-4 h-4 text-blue-500" />
                          <InstagramIcon className="w-4 h-4 text-pink-500" />
                        </div>
                        <span className="text-[11px] truncate">Meta Reels</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePlatform("TIKTOK")}
                        className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          selectedPlatforms.includes("TIKTOK")
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        <TiktokIcon className="w-5 h-5 text-cyan-400" />
                        <span className="text-[11px] truncate">TikTok</span>
                      </button>
                    </div>
                    {errors.enabledPlatforms && (
                      <p className="text-[11px] text-destructive mt-1">{errors.enabledPlatforms.message}</p>
                    )}
                  </div>
                )}
              />

              <ModalFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Workspace</span>
                    </>
                  )}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
      />
    </>
  );
}
