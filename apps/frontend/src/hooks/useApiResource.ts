"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchFromApi } from "@/lib/api-client";

export interface ApiResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApiResource<T>(url: string): ApiResourceState<T> {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const cleanUrl = url.replace(/^\/api/, "");
      const res = await fetchFromApi(cleanUrl, {}, token);
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json.data !== undefined ? json.data : json);
      } else {
        setError(json.error || "Failed to fetch resource");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [url, getToken, isSignedIn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
