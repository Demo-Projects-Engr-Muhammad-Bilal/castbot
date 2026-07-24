"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fetchFromApi } from "@/lib/api-client";

interface DataContextType {
  accounts: any[];
  accountsLoading: boolean;
  refetchAccounts: () => Promise<void>;

  queueJobs: any[];
  queueLoading: boolean;
  refetchQueue: () => Promise<void>;

  metrics: any;
  metricsLoading: boolean;
  refetchMetrics: () => Promise<void>;

  invalidateAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const activeTenantId = activeWorkspace?.id;

  // Cached states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);

  const [queueJobs, setQueueJobs] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState<boolean>(false);

  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(false);

  const refetchAccounts = useCallback(async () => {
    if (!activeTenantId) return;
    setAccountsLoading(true);
    try {
      const token = await getToken();
      const res = await fetchFromApi(
        "/accounts",
        { headers: { "x-tenant-id": activeTenantId } },
        token
      );
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.accounts)
        ? data.accounts
        : [];
      setAccounts(list);
    } catch {
      // keep previous cache on error
    } finally {
      setAccountsLoading(false);
    }
  }, [activeTenantId, getToken]);

  const refetchQueue = useCallback(async () => {
    if (!activeTenantId) return;
    setQueueLoading(true);
    try {
      const token = await getToken();
      const res = await fetchFromApi(
        "/scheduled",
        { headers: { "x-tenant-id": activeTenantId } },
        token
      );
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data?.data)
        ? data.data.data
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setQueueJobs(list);
    } catch {
      // keep previous cache on error
    } finally {
      setQueueLoading(false);
    }
  }, [activeTenantId, getToken]);

  const refetchMetrics = useCallback(async () => {
    if (!activeTenantId) return;
    setMetricsLoading(true);
    try {
      const token = await getToken();
      const res = await fetchFromApi(
        "/metrics",
        { headers: { "x-tenant-id": activeTenantId } },
        token
      );
      const data = await res.json();
      const payload = data?.data || data || {};
      setMetrics(payload);
    } catch {
      // keep previous cache on error
    } finally {
      setMetricsLoading(false);
    }
  }, [activeTenantId, getToken]);

  const invalidateAll = useCallback(async () => {
    await Promise.all([refetchAccounts(), refetchQueue(), refetchMetrics()]);
  }, [refetchAccounts, refetchQueue, refetchMetrics]);

  // When active workspace changes, refetch in background
  useEffect(() => {
    if (!activeTenantId) {
      setAccounts([]);
      setQueueJobs([]);
      setMetrics(null);
      return;
    }

    refetchAccounts();
    refetchQueue();
    refetchMetrics();
  }, [activeTenantId, refetchAccounts, refetchQueue, refetchMetrics]);

  return (
    <DataContext.Provider
      value={{
        accounts,
        accountsLoading,
        refetchAccounts,
        queueJobs,
        queueLoading,
        refetchQueue,
        metrics,
        metricsLoading,
        refetchMetrics,
        invalidateAll,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useDataContext must be used within a DataProvider");
  }
  return context;
}
