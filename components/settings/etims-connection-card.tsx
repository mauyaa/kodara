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

type EtimsStatus = {
  connected: boolean;
  kraPin: string | null;
  cuType: string | null;
  environment: string | null;
  verifiedAt: string | null;
};

const inputClassName =
  "flex h-10 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50";

export function EtimsConnectionCard({ initialStatus }: { initialStatus: EtimsStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [editing, setEditing] = useState(!initialStatus.connected);
  const [isPending, startTransition] = useTransition();

  const connect = (formData: FormData) => {
    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("set_landlord_etims_credentials", {
        target_kra_pin: (formData.get("kra_pin") as string)?.trim(),
        target_cu_serial: (formData.get("cu_serial") as string)?.trim(),
        target_cu_type: formData.get("cu_type") as string,
        target_environment: formData.get("environment") as string,
      });

      if (error) {
        toast.error(error.message || "Could not save eTIMS credentials");
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setStatus({
        connected: true,
        kraPin: row?.kra_pin ?? null,
        cuType: row?.cu_type ?? null,
        environment: row?.environment ?? null,
        verifiedAt: row?.verified_at ?? null,
      });
      setEditing(false);
      toast.success("eTIMS connected. Rent invoices will be issued under this PIN.");
      router.refresh();
    });
  };

  const disconnect = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("disconnect_landlord_etims");
      if (error) {
        toast.error(error.message || "Could not disconnect eTIMS");
        return;
      }
      setStatus({ connected: false, kraPin: null, cuType: null, environment: null, verifiedAt: null });
      setEditing(true);
      toast.success("eTIMS disconnected. New rent invoices will be skipped until you reconnect.");
      router.refresh();
    });
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>eTIMS</CardTitle>
        <CardDescription>
          KRA now requires an e-invoice for every rent payment. Connect your own KRA PIN and
          device so Kodara issues them automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.connected && !editing ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 p-4">
              <div>
                <p className="text-[14px] font-medium text-foreground">{status.kraPin}</p>
                <p className="text-[13px] text-muted-foreground">
                  {status.cuType?.toUpperCase()} ·{" "}
                  {status.environment === "production" ? "Production" : "Sandbox"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
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
              <label htmlFor="kra_pin" className="text-[13px] font-medium text-foreground">
                KRA PIN
              </label>
              <input
                id="kra_pin"
                name="kra_pin"
                required
                placeholder="e.g. A123456789Z"
                className={inputClassName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cu_serial" className="text-[13px] font-medium text-foreground">
                Device (CU) serial number
              </label>
              <input id="cu_serial" name="cu_serial" required className={inputClassName} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cu_type" className="text-[13px] font-medium text-foreground">
                Device type
              </label>
              <select id="cu_type" name="cu_type" defaultValue="oscu" className={inputClassName}>
                <option value="oscu">OSCU (always online)</option>
                <option value="vscu">VSCU (bulk / not always online)</option>
              </select>
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
                <option value="production">Production (real invoices)</option>
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
