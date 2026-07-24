"use client";

import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-[400px] w-full flex flex-col items-center justify-center space-y-4 p-8 text-center animate-fade-in">
      <div className="relative flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 animate-pulse" />
        <Loader2 className="h-8 w-8 text-primary animate-spin absolute" />
      </div>
      <p className="text-xs font-semibold text-muted-foreground animate-pulse">
        {message}
      </p>
    </div>
  );
}
