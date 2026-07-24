"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@clerk/nextjs";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDataContext } from "@/context/DataContext";
import { fetchFromApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import {
  Key,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { TiktokIcon } from "@/components/social-icons";

interface TikTokCookieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const tikTokCookieSchema = z.object({
  cookieString: z.string().trim().min(1, "Please paste a valid raw TikTok cookie string or JSON array."),
});

type TikTokCookieValues = z.infer<typeof tikTokCookieSchema>;

export function TikTokCookieModal({
  isOpen,
  onClose,
  onSuccess,
}: TikTokCookieModalProps) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { refetchAccounts, refetchMetrics } = useDataContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TikTokCookieValues>({
    resolver: zodResolver(tikTokCookieSchema),
    defaultValues: { cookieString: "" },
  });

  const handleClose = () => {
    onClose();
  };

  const onSubmit = async (values: TikTokCookieValues) => {
    if (!activeWorkspace?.id) {
      setError("No active workspace selected.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      const res = await fetchFromApi(
        "/accounts",
        {
          method: "POST",
          body: JSON.stringify({
            provider: "TIKTOK",
            providerAccountId: "tiktok-cookies",
            accessToken: values.cookieString,
            refreshToken: values.cookieString,
          }),
        },
        token
      );

      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        if (contentType && contentType.includes("application/json")) {
          const errData = await res.json();
          throw new Error(errData.message || errData.error || `Server returned ${res.status}`);
        } else {
          throw new Error(`Server returned ${res.status}: Route not found or backend error.`);
        }
      }

      const data = contentType && contentType.includes("application/json") ? await res.json() : {};

      if (res.ok && (data.success || data.account || data.message)) {
        setSuccess("TikTok session cookies encrypted & stored successfully!");
        reset();
        refetchAccounts();
        refetchMetrics();
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(data.error || data.message || "Failed to save TikTok cookies.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <ModalContent maxWidth="max-w-lg">
        <ModalHeader
          icon={<TiktokIcon className="w-5 h-5" />}
          title="Configure TikTok Stealth Cookies"
          description="Encrypted via AES-256-GCM for headless video publishing."
          onClose={handleClose}
        />

        {error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Cookies are encrypted in database storage and strictly scoped to tenant ID{" "}
            <span className="font-mono text-foreground font-semibold">{activeWorkspace?.id}</span>.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
              Raw Cookie Payload <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={5}
              mono
              placeholder="Paste sessionid=...; ttwid=...; or JSON exported cookies"
              disabled={isSubmitting}
              {...register("cookieString")}
            />
            {errors.cookieString && (
              <p className="text-[11px] text-destructive mt-1">{errors.cookieString.message}</p>
            )}
          </div>

          <ModalFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Encrypting &amp; Saving...</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>Save TikTok Cookies</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
