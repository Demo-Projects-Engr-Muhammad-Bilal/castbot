"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { fetchFromApi } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

export interface ConnectedAccountRef {
  id: string;
  provider: string;
  providerAccountId: string;
  updatedAt: string;
}

export interface TelegramConnectionRef {
  id: string;
  targetChannelId: string;
  isActive: boolean;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  niche?: string | null;
  enabledPlatforms: string[];
  uploadCredits?: number;
  maxWorkspaces?: number;
  role: string;
  planTier?: string;
  plan?: string;
  tier?: string;
  connectedSocialAccounts?: ConnectedAccountRef[];
  telegramConnections?: TelegramConnectionRef[];
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  isLoading: boolean;
  isModalOpen: boolean;
  editingWorkspace: Workspace | null;
  openCreateModal: () => void;
  openEditModal: (ws: Workspace) => void;
  closeModal: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = "castbot_active_workspace_id";

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  // Guards the mount effect so fetchWorkspaces only ever gets triggered once on load
  const hasTriggeredFetchRef = useRef(false);
  // Flips true once the first fetchWorkspaces call has completed (success or failure).
  // Used to distinguish the initial app-shell load from silent background refreshes.
  const hasFetchedRef = useRef(false);

  const setActiveWorkspace = useCallback((ws: Workspace) => {
    setActiveWorkspaceState(ws);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, ws.id);
    }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetchFromApi("/workspaces", {}, token);
      const data = await res.json();

      let fetchedList: Workspace[] = [];
      if (Array.isArray(data)) {
        fetchedList = data;
      } else if (data && data.success && Array.isArray(data.data)) {
        fetchedList = data.data;
      }

      setWorkspaces(fetchedList);

      if (fetchedList.length > 0) {
        const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const matched = fetchedList.find((w) => w.id === savedId);
        const chosen = matched || fetchedList[0];
        setActiveWorkspaceState(chosen);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, chosen.id);
        }

        if (pathname === "/setup") {
          setIsRedirecting(true);
          router.replace("/dashboard");
        }
      } else {
        setActiveWorkspaceState(null);
        if (pathname !== "/setup") {
          setIsRedirecting(true);
          router.replace("/setup");
        }
      }
    } catch (err) {
      console.error("❌ Failed to fetch user workspaces:", err);
    } finally {
      hasFetchedRef.current = true;
      setIsLoading(false);
    }
  }, [getToken, isSignedIn, pathname, router]);

  useEffect(() => {
    if (isSignedIn && !hasTriggeredFetchRef.current) {
      hasTriggeredFetchRef.current = true;
      fetchWorkspaces();
    }
  }, [isSignedIn, fetchWorkspaces]);

  const openCreateModal = () => {
    setEditingWorkspace(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ws: Workspace) => {
    setEditingWorkspace(ws);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingWorkspace(null);
  };

  const showAppShellLoader = (isLoading && !hasFetchedRef.current) || isRedirecting;

  if (showAppShellLoader) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 animate-pulse" />
          <Loader2 className="h-8 w-8 text-primary animate-spin absolute" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Initializing CastBot Workspace...
        </p>
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        refreshWorkspaces: fetchWorkspaces,
        isLoading,
        isModalOpen,
        editingWorkspace,
        openCreateModal,
        openEditModal,
        closeModal,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
