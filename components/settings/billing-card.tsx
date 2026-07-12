"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type BillingStatus = {
  planName: string | null;
  priceKesMonthly: number | null;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  propertiesUsed: number | null;
  maxProperties: number | null;
};

const inputClassName =
  "flex h-10 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50";

export function BillingCard({ status }: { status: BillingStatus }) {
  const [phone, setPhone] = useState("");
  const [payingMpesa, setPayingMpesa] = useState(false);
  const [payingCard, setPayingCard] = useState(false);

  const amount = status.priceKesMonthly ?? 0;

  const payWithMpesa = async () => {
    if (!/^254[17][0-9]{8}$/.test(phone)) {
      toast.error("Enter a phone number as 2547XXXXXXXX.");
      return;
    }
    setPayingMpesa(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("kodara-subscription-stk-push", {
        body: { phone, amount, idempotencyKey: crypto.randomUUID() },
      });
      if (error || !data) {
        toast.error("Could not send the payment prompt. Please try again shortly.");
        return;
      }
      toast.success("Payment prompt sent. Check your phone and enter your M-Pesa PIN.");
    } finally {
      setPayingMpesa(false);
    }
  };

  const payWithCard = async () => {
    setPayingCard(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("paystack-initialize", {
        body: { amount, idempotencyKey: crypto.randomUUID() },
      });
      if (error || !data?.authorizationUrl) {
        toast.error("Could not start card payment. Please try again shortly.");
        return;
      }
      window.location.href = data.authorizationUrl;
    } finally {
      setPayingCard(false);
    }
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Your Kodara subscription, separate from tenant rent.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="rounded-xl border border-border/40 bg-secondary/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-medium text-foreground">
                {status.planName ?? "No plan"} plan
              </p>
              <p className="text-[13px] text-muted-foreground capitalize">
                {status.status ?? "unknown"}
                {status.status === "trialing" && status.trialEndsAt
                  ? ` · trial ends ${new Date(status.trialEndsAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}`
                  : status.currentPeriodEnd
                    ? ` · renews ${new Date(status.currentPeriodEnd).toLocaleDateString("en-KE", { dateStyle: "medium" })}`
                    : ""}
              </p>
            </div>
            <p className="text-[15px] font-semibold text-foreground tabular-nums">
              {formatKES(amount)}/mo
            </p>
          </div>
          {status.maxProperties != null && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              {status.propertiesUsed ?? 0} of {status.maxProperties} properties used
            </p>
          )}
        </div>

        {amount > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <label htmlFor="billing_phone" className="text-[13px] font-medium text-foreground">
                  M-Pesa phone
                </label>
                <input
                  id="billing_phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.trim())}
                  placeholder="2547XXXXXXXX"
                  className={inputClassName}
                />
              </div>
              <Button type="button" onClick={payWithMpesa} disabled={payingMpesa}>
                {payingMpesa ? "Sending…" : "Pay with M-Pesa"}
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={payWithCard} disabled={payingCard}>
              {payingCard ? "Redirecting…" : "Pay with card / bank"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
