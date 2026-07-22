import { AlertCircle, DoorOpen, ShieldCheck } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

const DEPOSIT_TYPE_LABELS: Record<string, string> = {
  refund: "Refund",
  deduction: "Deduction",
};

export default async function EndTenancyPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenancyId: string }>;
  searchParams: Promise<{ error?: string; depositError?: string }>;
}) {
  const { tenancyId } = await params;
  const { error: actionError, depositError } = await searchParams;
  const supabase = await createClient();

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select(
      `
      id, status, rent_amount, start_date, deposit_amount,
      profiles ( full_name, phone ),
      units ( name, properties ( name ) )
    `,
    )
    .eq("id", tenancyId)
    .single();

  if (!tenancy || !["active", "pending"].includes(tenancy.status)) {
    redirect("/tenants");
  }

  const { data: balanceRow } = await supabase
    .from("tenancy_balances")
    .select("balance")
    .eq("tenancy_id", tenancyId)
    .maybeSingle();

  const { data: depositTransactions } = await supabase
    .from("deposit_transactions")
    .select("id, type, amount, note, created_at")
    .eq("tenancy_id", tenancyId)
    .order("created_at", { ascending: false });

  const profile = tenancy.profiles;
  const unit = tenancy.units;
  const property = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
  const balance = Number(balanceRow?.balance ?? 0);
  const depositAmount = Number(tenancy.deposit_amount ?? 0);
  const depositSettled = (depositTransactions || []).reduce((acc, t) => acc + Number(t.amount), 0);
  const depositRemaining = depositAmount - depositSettled;

  const endTenancy = async (formData: FormData) => {
    "use server";
    const endDate = String(formData.get("endDate") ?? "");
    const noteValue = formData.get("note");
    const note = typeof noteValue === "string" && noteValue.trim() ? noteValue.trim() : undefined;

    const sb = await createClient();
    const { error } = await sb.rpc("end_tenancy", {
      target_tenancy_id: tenancyId,
      target_end_date: endDate,
      note,
    });

    if (error) {
      redirect(`/tenants/${tenancyId}/end?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/tenants");
    revalidatePath("/dashboard");
    redirect("/tenants");
  };

  const recordDeposit = async (formData: FormData) => {
    "use server";
    const type = String(formData.get("type") ?? "");
    const amount = Number(formData.get("amount"));
    const note = String(formData.get("note") ?? "");

    const sb = await createClient();
    const { error } = await sb.rpc("record_deposit_transaction", {
      target_tenancy_id: tenancyId,
      transaction_type: type,
      transaction_amount: amount,
      transaction_note: note,
    });

    if (error) {
      redirect(`/tenants/${tenancyId}/end?depositError=${encodeURIComponent(error.message)}`);
    }

    revalidatePath(`/tenants/${tenancyId}/end`);
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Tenants
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">End tenancy</h1>
        <p className="text-[15px] text-muted-foreground">
          This frees the unit for a new tenant. It cannot be undone.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          {actionError}
        </div>
      )}

      <Card className="premium-card border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="text-amber-900">{profile?.full_name || "Tenant"}</CardTitle>
          <CardDescription className="text-amber-700/80">
            {property?.name} · Unit {unit?.name} · {formatKES(Number(tenancy.rent_amount))} / month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl bg-background p-4 shadow-sm border border-amber-100/50">
            <span className="text-[13px] font-medium text-amber-700/60 uppercase tracking-wider">
              Outstanding balance
            </span>
            <span className="text-xl font-bold text-amber-900 tabular-nums font-mono">
              {formatKES(balance)}
            </span>
          </div>
          {balance > 0 && (
            <p className="mt-3 text-[13px] text-amber-800">
              This tenant still owes {formatKES(balance)}. Ending the tenancy does not clear this
              balance — collect it separately.
            </p>
          )}
        </CardContent>
      </Card>

      {depositAmount > 0 && (
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Security deposit
            </CardTitle>
            <CardDescription>
              {formatKES(depositAmount)} collected · {formatKES(depositRemaining)} remaining
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {depositError && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {depositError}
              </div>
            )}

            {depositTransactions && depositTransactions.length > 0 && (
              <ul className="flex flex-col gap-2">
                {depositTransactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-[13px]">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold">
                        {DEPOSIT_TYPE_LABELS[t.type] ?? t.type}
                      </Badge>
                      <span className="text-muted-foreground">{t.note}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{formatKES(Number(t.amount))}</span>
                  </li>
                ))}
              </ul>
            )}

            {depositRemaining > 0 ? (
              <form action={recordDeposit} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="type" className="text-[12px] font-medium text-foreground">Type</label>
                  <select
                    id="type"
                    name="type"
                    required
                    className="h-10 rounded-lg border border-border/50 bg-secondary/30 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  >
                    <option value="refund">Refund</option>
                    <option value="deduction">Deduction</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="amount" className="text-[12px] font-medium text-foreground">Amount (KES)</label>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    min="1"
                    max={depositRemaining}
                    step="0.01"
                    required
                    className="h-10 rounded-lg border border-border/50 bg-secondary/30 px-3 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="note" className="text-[12px] font-medium text-foreground">Note</label>
                  <input
                    id="note"
                    name="note"
                    type="text"
                    required
                    minLength={2}
                    maxLength={240}
                    placeholder="e.g. Full refund, no damage"
                    className="h-10 rounded-lg border border-border/50 bg-secondary/30 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  />
                </div>
                <Button type="submit" variant="outline" className="h-10 text-[13px]">
                  Record
                </Button>
              </form>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                The full deposit has been settled.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="premium-card">
        <CardHeader>
          <CardTitle>Confirm move-out</CardTitle>
          <CardDescription>The unit becomes available for a new tenancy immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={endTenancy} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="endDate" className="text-[13px] font-medium text-foreground">
                Move-out date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                required
                min={tenancy.start_date}
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
                rows={3}
                placeholder="Reason for move-out, condition notes, etc."
                className="w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Link href="/tenants">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="destructive">
                <DoorOpen className="mr-2 h-4 w-4" />
                End tenancy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
