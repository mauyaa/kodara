"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type MpesaStatus = {
  connected: boolean;
  environment: string | null;
  maskedShortcode: string | null;
  verifiedAt: string | null;
};

const inputClassName =
  "flex h-10 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50";

export function MpesaConnectionCard({ initialStatus }: { initialStatus: MpesaStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [editing, setEditing] = useState(!initialStatus.connected);
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);

  const connect = (formData: FormData) => {
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("set_landlord_mpesa_credentials", {
        target_shortcode: (formData.get("shortcode") as string)?.trim(),
        target_consumer_key: (formData.get("consumer_key") as string)?.trim(),
        target_consumer_secret: (formData.get("consumer_secret") as string)?.trim(),
        target_passkey: (formData.get("passkey") as string)?.trim(),
        target_environment: formData.get("environment") as string,
      });

      if (error) {
        toast.error(error.message || "Could not save M-Pesa credentials");
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setStatus({
        connected: true,
        environment: row?.environment ?? null,
        maskedShortcode: row?.shortcode
          ? "*".repeat(Math.max(row.shortcode.length - 3, 0)) + row.shortcode.slice(-3)
          : null,
        verifiedAt: row?.verified_at ?? null,
      });
      setEditing(false);
      toast.success("M-Pesa credentials saved. Test the connection to confirm they work.");
      router.refresh();
    });
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("mpesa-test-connection");
      if (error || !data?.ok) {
        toast.error("Daraja rejected these credentials. Double-check them and try again.");
        return;
      }
      setStatus((s) => ({ ...s, verifiedAt: new Date().toISOString() }));
      toast.success("M-Pesa connection verified.");
      router.refresh();
    } finally {
      setIsTesting(false);
    }
  };

  const disconnect = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("disconnect_landlord_mpesa");
      if (error) {
        toast.error(error.message || "Could not disconnect M-Pesa");
        return;
      }
      setStatus({ connected: false, environment: null, maskedShortcode: null, verifiedAt: null });
      setEditing(true);
      toast.success("M-Pesa disconnected. Tenants cannot pay until you reconnect.");
      router.refresh();
    });
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>M-Pesa</CardTitle>
        <CardDescription>
          Connect your own Paybill or Till so rent lands directly in your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.connected && !editing ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 p-4">
              <div>
                <p className="text-[14px] font-medium text-foreground">
                  Paybill/Till {status.maskedShortcode}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {status.environment === "production" ? "Production" : "Sandbox"} ·{" "}
                  {status.verifiedAt ? "Verified" : "Not yet verified"}
                </p>
              </div>
              <span
                className={
                  status.verifiedAt
                    ? "h-2 w-2 rounded-full bg-primary"
                    : "h-2 w-2 rounded-full bg-amber-500"
                }
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={testConnection} disabled={isTesting}>
                {isTesting ? "Testing…" : "Test connection"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Update credentials
              </Button>
              <Button type="button" variant="destructive" onClick={disconnect} disabled={isPending}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <form action={connect} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="shortcode" className="text-[13px] font-medium text-foreground">
                Paybill / Till number
              </label>
              <input
                id="shortcode"
                name="shortcode"
                required
                placeholder="e.g. 400200"
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="consumer_key" className="text-[13px] font-medium text-foreground">
                Daraja consumer key
              </label>
              <input id="consumer_key" name="consumer_key" required className={inputClassName} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="consumer_secret" className="text-[13px] font-medium text-foreground">
                Daraja consumer secret
              </label>
              <input
                id="consumer_secret"
                name="consumer_secret"
                type="password"
                required
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="passkey" className="text-[13px] font-medium text-foreground">
                Passkey
              </label>
              <input id="passkey" name="passkey" type="password" required className={inputClassName} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="environment" className="text-[13px] font-medium text-foreground">
                Environment
              </label>
              <select
                id="environment"
                name="environment"
                defaultValue="sandbox"
                className={inputClassName}
              >
                <option value="sandbox">Sandbox (testing)</option>
                <option value="production">Production (real money)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              {status.connected && (
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save credentials"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
