export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:5000/api";

const TENANT_STORAGE_KEY = "castbot_active_workspace_id";

export async function fetchFromApi(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const base = API_BASE_URL.replace(/\/+$/, "");
  const url = endpoint.startsWith("http") ? endpoint : `${base}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Single source of truth for x-tenant-id: always injected here from the
  // active workspace in localStorage. Call sites should NOT set this header
  // themselves — doing so risks a stale/mismatched tenant id racing against
  // this injection. This call always wins.
  if (typeof window !== "undefined") {
    const activeTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
    if (activeTenantId) {
      headers.set("x-tenant-id", activeTenantId);
    }
  }

  // Default JSON headers if body is a string
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    console.error(`❌ [fetchFromApi] Network request failed for ${url}:`, err);
    throw new Error(`Unable to connect to backend server at ${url}. Please verify Express daemon is running on port 5000.`);
  }
}

/**
 * Unwraps the common `{ success, data }` API envelope shape used across
 * this backend, falling back gracefully to the raw payload for endpoints
 * that respond with a bare array/object instead of the envelope.
 */
export function unwrapApiEnvelope<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in (json as Record<string, unknown>)) {
    const envelope = json as { success?: boolean; data?: T };
    if (envelope.data !== undefined) {
      return envelope.data as T;
    }
  }
  return json as T;
}
