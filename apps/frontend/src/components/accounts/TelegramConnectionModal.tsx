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
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

interface TelegramConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Updated schema: renamed chatId -> targetChannelId
const telegramConnectionSchema = z.object({
  botToken: z.string().trim().min(1, "Bot Token is required."),
  targetChannelId: z.string().trim().min(1, "Channel / Group Chat ID is required."),
});

type TelegramConnectionValues = z.infer<typeof telegramConnectionSchema>;

export function TelegramConnectionModal({
  isOpen,
  onClose,
  onSuccess,
}: TelegramConnectionModalProps) {
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
  } = useForm<TelegramConnectionValues>({
    resolver: zodResolver(telegramConnectionSchema),
    defaultValues: { botToken: "", targetChannelId: "" },
  });

  const handleClose = () => {
    onClose();
  };

  const onSubmit = async (values: TelegramConnectionValues) => {
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
        "/telegram/register-bot",
        {
          method: "POST",
          body: JSON.stringify({
            botToken: values.botToken,
            targetChannelId: values.targetChannelId, // Corrected payload key
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
        setSuccess("Telegram Bot channel connected successfully!");
        reset();
        refetchAccounts();
        refetchMetrics();
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(data.error || data.message || "Failed to verify or connect Telegram bot.");
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
      <ModalContent maxWidth="max-w-md" className="rounded-3xl">
        <ModalHeader
          icon={<Send className="w-5 h-5" />}
          title="Connect Telegram Channel"
          description="Dispatch video uploads via Bot API."
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Bot Token <span className="text-destructive">*</span>
              </label>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" /> Get from @BotFather
              </a>
            </div>
            <Input
              type="password"
              mono
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              disabled={isSubmitting}
              {...register("botToken")}
            />
            {errors.botToken && (
              <p className="text-[11px] text-destructive mt-1">{errors.botToken.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
              Channel / Group Chat ID <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              mono
              placeholder="e.g. @MyChannel or -1001234567890"
              disabled={isSubmitting}
              {...register("targetChannelId")}
            />
            {errors.targetChannelId && (
              <p className="text-[11px] text-destructive mt-1">{errors.targetChannelId.message}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Ensure your bot is added as an Administrator with &quot;Post Messages&quot; permission.
            </p>
          </div>

          <ModalFooter>
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
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Connect Channel</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}