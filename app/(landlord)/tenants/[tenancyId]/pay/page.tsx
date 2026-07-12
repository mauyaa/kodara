import { AlertCircle, Wallet } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function RecordPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenancyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { tenancyId } = await params;
  const { error: actionError } = await searchParams;
  const supabase = await createClient();

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select(
      `
      id, status, rent_amount,
      profiles ( full_name, phone ),
      units ( name, properties ( name ) )
    `,
    )
    .eq("id", tenancyId)
    .single();

  if (!tenancy || tenancy.status === "ended") {
    redirect("/tenants");
  }

  const { data: balanceRow } = await supabase
    .from("tenancy_balances")
    .select("balance")
    .eq("tenancy_id", tenancyId)
    .maybeSingle();

  const profile = tenancy.profiles;
  const unit = tenancy.units;
  const property = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
  const balance = Number(balanceRow?.balance ?? 0);
  const suggestedAmount = balance > 0 ? balance : Number(tenancy.rent_amount);

  const recordPayment = async (formData: FormData) => {
    "use server";
    const amount = Number(formData.get("amount"));
    const paidOn = String(formData.get("paidOn") ?? "");
    const noteValue = formData.get("note");
    const note = typeof noteValue === "string" && noteValue.trim() ? noteValue.trim() : undefined;

    const sb = await createClient();
    const { error } = await sb.rpc("record_manual_payment", {
      target_tenancy_id: tenancyId,
      payment_amount: amount,
      payment_date: paidOn,
      payment_note: note,
    });

    if (error) {
      redirect(`/tenants/${tenancyId}/pay?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/tenants");
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    redirect("/tenants");
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Tenants
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Mark as paid</h1>
        <p className="text-[15px] text-muted-foreground">
          Record rent collected by cash, bank transfer, or a personal till — no M-Pesa connection needed.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          {actionError}
        </div>
      )}

      <Card className="premium-card">
        <CardHeader>
          <CardTitle>{profile?.full_name || "Tenant"}</CardTitle>
          <CardDescription>
            {property?.name} · Unit {unit?.name} · {formatKES(Number(tenancy.rent_amount))} / month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4 border border-border/50">
            <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
              Outstanding balance
            </span>
            <span className="text-xl font-bold text-foreground tabular-nums font-mono">
              {formatKES(balance)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
          <CardDescription>This is recorded immediately and reflected in the balance above.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={recordPayment} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="amount" className="text-[13px] font-medium text-foreground">
                Amount (KES)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                defaultValue={suggestedAmount > 0 ? suggestedAmount : undefined}
                className="h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="paidOn" className="text-[13px] font-medium text-foreground">
                Date paid
              </label>
              <input
                id="paidOn"
                name="paidOn"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="note" className="text-[13px] font-medium text-foreground">
                Note <span className="font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                id="note"
                name="note"
                maxLength={500}
                rows={2}
                placeholder="e.g. Paid via bank transfer, ref 4021"
                className="w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Link href="/tenants">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Wallet className="mr-2 h-4 w-4" />
                Mark as paid
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
