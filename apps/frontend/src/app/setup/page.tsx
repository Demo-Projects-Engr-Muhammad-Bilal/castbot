"use client";

import React from "react";
import { WorkspaceSetupWizard } from "@/components/setup/WorkspaceSetupWizard";

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex items-center justify-center p-4 sm:p-6 lg:p-8 select-none">
      <WorkspaceSetupWizard />
    </div>
  );
}
