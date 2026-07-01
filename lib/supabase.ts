// Kodara Supabase clients. Browser clients only receive public credentials.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "kodara-supabase-config";

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let currentClient: SupabaseClient | null = null;
let currentConfig: SupabaseConfig | null = null;

function loadConfigFromStorage(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfigToStorage(config: SupabaseConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function initializeSupabase(
  config?: SupabaseConfig,
): SupabaseClient | null {
  // Priority: explicit config > stored config > env vars
  const effective = config ||
    loadConfigFromStorage() || {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    };

  if (!effective.url || !effective.anonKey) {
    currentClient = null;
    currentConfig = null;
    return null;
  }

  currentConfig = effective;
  currentClient = createClient(effective.url, effective.anonKey, {
    auth: { persistSession: true },
  });

  if (config) {
    saveConfigToStorage(config);
  }

  return currentClient;
}

if (typeof window !== "undefined") initializeSupabase();

// Public exports
export const supabase = () => currentClient;

export const getSupabaseConfig = () => currentConfig;

export const isSupabaseConfigured = () => {
  const cfg = currentConfig || loadConfigFromStorage();
  const envOk = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return !!(cfg?.url && cfg?.anonKey) || envOk;
};

export function clearSupabaseConfig() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  currentClient = null;
  currentConfig = null;
}

// Runtime public-key setup for local diagnostics only.
export function setSupabaseKeys(url: string, anonKey: string): boolean {
  if (!url || !anonKey) return false;
  const client = initializeSupabase({
    url: url.trim(),
    anonKey: anonKey.trim(),
  });
  return !!client;
}

// Helper for profile (when real auth is used)
export async function getCurrentProfile() {
  const client = supabase();
  if (!client) return null;

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

// Realtime subscriptions - call this from context when connected
export function subscribeToTable(
  table: string,
  callback: (payload: unknown) => void,
) {
  const client = supabase();
  if (!client) return () => {};

  const channel = client
    .channel(`kodara-realtime-${table}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        callback(payload);
      },
    )
    .subscribe();

  return () => client?.removeChannel(channel);
}

// Service role client for server-side operations
export function getServiceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey);
}

// Admin client for webhook/database operations
export function getAdminClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export function getRequestClient(request: Request): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !publicKey || !authorization?.startsWith("Bearer ")) return null;

  return createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
}

export function getServerAuthClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) return null;
  return createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
