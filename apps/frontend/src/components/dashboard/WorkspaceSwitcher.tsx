"use client";

import React, { useState } from "react";
import { useWorkspace, Workspace } from "@/context/WorkspaceContext";
import { Layers, ChevronDown, Plus, Check } from "lucide-react";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace, openCreateModal } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectWorkspace = (ws: Workspace) => {
    setActiveWorkspace(ws);
    setIsOpen(false);
  };

  const handleOpenCreateModal = () => {
    setIsOpen(false);
    openCreateModal();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-background hover:bg-muted/50 text-xs font-bold text-foreground transition-all cursor-pointer shadow-xs"
      >
        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="max-w-[120px] sm:max-w-[160px] truncate">
          {activeWorkspace?.name || "Select Workspace"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xl z-50 p-1.5 space-y-1 animate-fade-in">
            <div className="px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Workspaces ({workspaces.length})
            </div>

            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspace?.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => handleSelectWorkspace(ws)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 border-t border-border/60">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Create New Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
