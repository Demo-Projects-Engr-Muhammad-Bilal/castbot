import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.ComponentPropsWithoutRef<"textarea"> {
  mono?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, mono = false, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-xs resize-none disabled:opacity-60 disabled:cursor-not-allowed",
          mono && "font-mono",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
