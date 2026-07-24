"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Reusable modal primitive built on @base-ui/react/dialog.
 * Consolidates the hand-rolled `createPortal` + fixed-overlay markup that
 * was previously duplicated across every modal in the app.
 */

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Modal({ open, onOpenChange, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

interface ModalContentProps extends React.ComponentPropsWithoutRef<typeof Dialog.Popup> {
  /** Tailwind max-width utility for the modal card, e.g. "max-w-lg" */
  maxWidth?: string;
}

const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, maxWidth = "max-w-lg", children, ...props }, ref) => {
    return (
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm select-none" />
        <Dialog.Popup
          ref={ref}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto outline-none select-none",
            className
          )}
          {...props}
        >
          <div
            className={cn(
              "relative w-full my-auto bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col space-y-6 max-h-[85vh] overflow-y-auto text-card-foreground animate-fade-in",
              maxWidth
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    );
  }
);
ModalContent.displayName = "ModalContent";

interface ModalHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

function ModalHeader({ icon, title, description, onClose, className }: ModalHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between pb-3 border-b border-border/40", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div>
          <Dialog.Title className="text-lg font-bold text-foreground">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
              {description}
            </Dialog.Description>
          )}
        </div>
      </div>
      {onClose && (
        <Dialog.Close
          onClick={onClose}
          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground transition-all cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </Dialog.Close>
      )}
    </div>
  );
}

function ModalFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border/40",
        className
      )}
    >
      {children}
    </div>
  );
}

export { Modal, ModalContent, ModalHeader, ModalFooter };
