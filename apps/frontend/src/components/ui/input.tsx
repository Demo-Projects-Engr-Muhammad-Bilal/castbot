import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentPropsWithoutRef<"input"> {
  /** Renders the field with monospace styling (tokens, IDs, secrets) */
  mono?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        data-slot="input"
        className={cn(
          "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed",
          mono && "font-mono",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
