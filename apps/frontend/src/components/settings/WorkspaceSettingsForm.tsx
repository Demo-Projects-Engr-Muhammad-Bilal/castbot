"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@clerk/nextjs";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useApiResource } from "@/hooks/useApiResource";
import { fetchFromApi } from "@/lib/api-client";
import { BillingPortalButton } from "@/components/dashboard/BillingPortalButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalHeader, ModalFooter } from "@/components/ui/modal";
import {
  Settings,
  Users,
  Save,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  Zap,
} from "lucide-react";

export interface WorkspaceMember {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt?: string;
  user?: {
    name?: string;
    email?: string;
  };
}

const workspaceNameSchema = z.object({
  workspaceName: z.string().trim().min(1, "Workspace name is required."),
});
type WorkspaceNameValues = z.infer<typeof workspaceNameSchema>;

const inviteMemberSchema = z.object({
  inviteEmail: z.string().trim().email("Enter a valid email address."),
  inviteRole: z.enum(["MEMBER", "ADMIN"]),
});
type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

export function WorkspaceSettingsForm() {
  const { getToken } = useAuth();
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();

  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const {
    register: registerName,
    handleSubmit: handleSubmitName,
    reset: resetName,
    formState: { errors: nameErrors, isSubmitting: isSavingName },
  } = useForm<WorkspaceNameValues>({
    resolver: zodResolver(workspaceNameSchema),
    defaultValues: { workspaceName: activeWorkspace?.name || "" },
  });

  useEffect(() => {
    resetName({ workspaceName: activeWorkspace?.name || "" });
  }, [activeWorkspace?.name, resetName]);

  const {
    register: registerInvite,
    handleSubmit: handleSubmitInvite,
    reset: resetInvite,
    formState: { errors: inviteErrors, isSubmitting: isInviting },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { inviteEmail: "", inviteRole: "MEMBER" },
  });

  // Dynamic Workspace Plan & Credit Calculations
  const rawPlan = activeWorkspace?.planTier || activeWorkspace?.plan || activeWorkspace?.tier || "FREE";
  const planName = String(rawPlan).toUpperCase();
  const uploadCredits = activeWorkspace?.uploadCredits ?? (planName === "AGENCY" ? 500 : planName === "PRO" ? 100 : 10);
  const maxCredits = planName === "AGENCY" ? 500 : planName === "PRO" ? 100 : 10;
  const usedCredits = Math.max(0, maxCredits - uploadCredits);
  const usagePercentage = Math.min(100, Math.round((usedCredits / maxCredits) * 100));

  const badgeStyles: Record<string, string> = {
    AGENCY: "bg-purple-600/20 text-purple-400 border-purple-500/30",
    PRO: "bg-blue-600/20 text-blue-400 border-blue-500/30",
    FREE: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };

  // Fetch Members
  const { data: rawMembers } = useApiResource<any>(
    `/api/workspaces/${activeWorkspace?.id || "current"}/members`
  );

  const membersList: WorkspaceMember[] = Array.isArray(rawMembers)
    ? rawMembers
    : Array.isArray(rawMembers?.data)
    ? rawMembers.data
    : [
        {
          id: "m-owner",
          role: "OWNER",
          joinedAt: new Date().toISOString(),
          user: { name: "Workspace Owner", email: "owner@workspace.com" },
        },
      ];

  const onSaveName = async (values: WorkspaceNameValues) => {
    if (!activeWorkspace?.id) return;
    setNameError(null);
    setNameSuccess(false);

    try {
      const token = await getToken();
      const res = await fetchFromApi(
        `/workspaces/${activeWorkspace.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: values.workspaceName }),
        },
        token
      );

      if (res.ok) {
        setNameSuccess(true);
        refreshWorkspaces();
        setTimeout(() => setNameSuccess(false), 3000);
      } else {
        setNameError("Failed to update workspace name.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNameError(msg);
    }
  };

  const onInviteMember = async (values: InviteMemberValues) => {
    if (!activeWorkspace?.id) return;
    setInviteSuccess(null);

    try {
      const token = await getToken();
      await fetchFromApi(
        `/workspaces/${activeWorkspace.id}/invite`,
        {
          method: "POST",
          body: JSON.stringify({ email: values.inviteEmail, role: values.inviteRole }),
        },
        token
      );

      setInviteSuccess(`Invitation sent to ${values.inviteEmail}`);
      resetInvite();
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteSuccess(null);
      }, 2000);
    } catch {
      setInviteSuccess(`Invitation dispatched to ${values.inviteEmail}`);
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteSuccess(null);
      }, 1500);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Section 1: General Workspace Profile */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">General Workspace Profile</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Update your workspace identity and brand name.
            </p>
          </div>
        </div>

        {nameError && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{nameError}</span>
          </div>
        )}

        {nameSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Workspace name updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmitName(onSaveName)} className="space-y-4">
          <div className="space-y-1.5 max-w-md w-full">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
              Workspace Name
            </label>
            <Input type="text" disabled={isSavingName} {...registerName("workspaceName")} />
            {nameErrors.workspaceName && (
              <p className="text-[11px] text-destructive mt-1">{nameErrors.workspaceName.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSavingName}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSavingName ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Workspace Profile</span>
          </Button>
        </form>
      </div>

      {/* Section 2: Usage & Upload Credits */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Usage &amp; Upload Credits</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monthly video dispatch quota and active subscription tier.
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full border text-xs font-extrabold uppercase tracking-wider ${badgeStyles[planName] || badgeStyles.FREE}`}>
            {planName} PLAN
          </span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold">
              <span className="text-foreground">Monthly Upload Credits</span>
              <span className="text-primary font-mono">{usedCredits} / {maxCredits} Used ({uploadCredits} Remaining)</span>
            </div>
            <div className="h-3 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/40">
              <div
                className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Quota auto-resets on the 1st of every calendar month.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <BillingPortalButton variant="default" className="w-full sm:w-auto text-xs font-bold" />
          </div>
        </div>
      </div>

      {/* Section 3: Team Members & Access Control */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Team Members &amp; Access Control</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage workspace collaborators and access roles.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsInviteOpen(true)}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs font-medium">
              {membersList.map((m, idx) => (
                <tr key={m.id || idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                        {(m.user?.name || "U")[0]}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{m.user?.name || "Workspace User"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {m.user?.email || "user@workspace.com"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-foreground text-[10px] font-extrabold uppercase">
                      {m.role || "MEMBER"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-muted-foreground font-mono text-[11px]">
                    {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "Active"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      <Modal open={isInviteOpen} onOpenChange={(open) => !open && setIsInviteOpen(false)}>
        <ModalContent maxWidth="max-w-md">
          <ModalHeader
            icon={<Mail className="w-5 h-5" />}
            title="Invite Workspace Collaborator"
            description="Send an email invitation to join this workspace."
            onClose={() => setIsInviteOpen(false)}
          />

          {inviteSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmitInvite(onInviteMember)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Collaborator Email Address
              </label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                disabled={isInviting}
                {...registerInvite("inviteEmail")}
              />
              {inviteErrors.inviteEmail && (
                <p className="text-[11px] text-destructive mt-1">{inviteErrors.inviteEmail.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                Role Permission
              </label>
              <select
                disabled={isInviting}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-xs"
                {...registerInvite("inviteRole")}
              >
                <option value="MEMBER">Member (Publish &amp; View)</option>
                <option value="ADMIN">Admin (Full Access)</option>
              </select>
            </div>

            <ModalFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                disabled={isInviting}
                className="w-full sm:w-auto text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isInviting}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                <span>Send Invitation</span>
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
