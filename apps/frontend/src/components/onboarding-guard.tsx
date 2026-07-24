"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/context/WorkspaceContext";

interface OnboardingGuardProps {
  hasActiveConnections: boolean;
  children: React.ReactNode;
}

export function OnboardingGuard({
  hasActiveConnections,
  children,
}: OnboardingGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaces, isLoading } = useWorkspace();

  useEffect(() => {
    if (isLoading) return;

    // 1. Mandatory Workspace Setup Guard (0 workspaces)
    if (workspaces.length === 0 && pathname !== "/dashboard/setup/workspace") {
      router.replace("/dashboard/setup/workspace");
      return;
    }

    // 2. Mandatory Account Connection Guard (0 connected accounts for workspace)
    if (
      workspaces.length > 0 &&
      !hasActiveConnections &&
      pathname !== "/dashboard/accounts" &&
      pathname !== "/dashboard/setup/workspace"
    ) {
      router.replace("/dashboard/accounts?setup=required");
    }
  }, [workspaces, isLoading, hasActiveConnections, pathname, router]);

  return <>{children}</>;
}
