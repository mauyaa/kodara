import { createClient } from "@/lib/supabase/client";

/**
 * Best-effort production error reporting. Always also logs to the console
 * (useful in dev, and Vercel captures server-side console output in its own
 * function logs), but the RPC call is what makes a client-side error visible
 * anywhere once deployed -- console.error alone disappears into the void.
 */
export function reportClientError(error: Error & { digest?: string }, context: string) {
  console.error(error);

  try {
    const supabase = createClient();
    void supabase.rpc("log_client_error", {
      error_message: error.message || "unknown error",
      error_stack: error.stack,
      error_digest: error.digest,
      error_context: context,
      page_url: typeof window !== "undefined" ? window.location.href : undefined,
    });
  } catch {
    // Reporting must never itself throw on top of an already-broken page.
  }
}
