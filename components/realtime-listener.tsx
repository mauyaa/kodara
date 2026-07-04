"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function RealtimeListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const payloadHasErrors = (payload: unknown): payload is { errors: string[] } =>
      typeof payload === "object" &&
      payload !== null &&
      "errors" in payload &&
      Array.isArray(payload.errors) &&
      payload.errors.length > 0;

    const subscribe = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        console.error("Kodara realtime has no authenticated session", sessionError);
        toast.error("Live updates require a fresh sign-in.");
        return;
      }

      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'payments',
          },
          (payload) => {
            if (payloadHasErrors(payload)) {
              console.error("Payment realtime event was rejected", payload.errors);
              toast.error("A payment arrived, but live refresh was rejected. Refresh to retry.");
              return;
            }

            toast.success("New M-Pesa payment received!");
            router.refresh();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'maintenance_requests',
          },
          (payload) => {
            if (payloadHasErrors(payload)) {
              console.error("Maintenance realtime event was rejected", payload.errors);
              toast.error("A maintenance update arrived, but live refresh was rejected.");
              return;
            }

            toast.info("Maintenance request updated");
            router.refresh();
          }
        )
        .subscribe((status, error) => {
          if (status === "SUBSCRIBED") {
            console.info("Kodara realtime subscribed");
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("Kodara realtime unavailable", { status, error });
            toast.error("Live updates are temporarily unavailable. Refresh to retry.");
          }
        });
    };

    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
