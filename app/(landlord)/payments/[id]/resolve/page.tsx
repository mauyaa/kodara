import { AlertCircle, UserCheck } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export default async function ResolvePaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: actionError } = await searchParams;
  const supabase = await createClient();

  // Fetch the unmatched payment
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !payment || payment.reconciliation_status !== 'unmatched') {
    return redirect("/payments");
  }

  // Fetch all active tenancies to match against
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select(`
      id,
      rent_amount,
      profiles (
        full_name,
        phone
      ),
      units (
        name,
        properties (
          name
        )
      )
    `)
    .eq('status', 'active');

  const resolvePayment = async (formData: FormData) => {
    "use server";
    
    const tenancyId = formData.get("tenancyId");
    const noteValue = formData.get("note");
    const note = typeof noteValue === "string" && noteValue.trim() ? noteValue.trim() : undefined;
    if (typeof tenancyId !== "string" || !tenancyId) {
      redirect(`/payments/${id}/resolve?error=${encodeURIComponent("Select a tenancy.")}`);
    }

    const sb = await createClient();
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData.user) redirect("/login");

    // Call RPC to resolve unmatched payment
    const { error } = await sb.rpc('resolve_unmatched_payment', {
      target_payment_id: id,
      target_tenancy_id: tenancyId,
      resolution_note: note,
    });

    if (error) {
      redirect(`/payments/${id}/resolve?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/dashboard");
    revalidatePath("/payments");
    redirect("/payments");
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Resolve Payment</h1>
        <p className="text-[15px] text-muted-foreground">
          Manually allocate an unmatched M-Pesa payment to a tenant&apos;s account.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="grid gap-6">
        <Card className="premium-card border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-amber-900">Payment Details</CardTitle>
            <CardDescription className="text-amber-700/80">
              This transaction could not be auto-matched to a tenant&apos;s phone number.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between rounded-xl bg-background p-4 shadow-sm border border-amber-100/50">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-amber-700/60 uppercase tracking-wider">Sender Phone</span>
                <span className="font-mono text-lg font-medium text-amber-900">{payment.sender_phone}</span>
              </div>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-[11px] font-medium text-amber-700/60 uppercase tracking-wider">Amount</span>
                <span className="text-xl font-bold text-amber-900 tabular-nums font-mono">{formatKES(Number(payment.amount))}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="text-amber-700/60 block mb-1">Receipt No.</span>
                <span className="font-medium text-amber-900 font-mono">{payment.provider_transaction_id}</span>
              </div>
              <div>
                <span className="text-amber-700/60 block mb-1">Received At</span>
                <span className="font-medium text-amber-900 tabular-nums">{new Date(payment.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Select Tenancy</CardTitle>
            <CardDescription>Choose which tenant this payment belongs to.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={resolvePayment} className="flex flex-col gap-6">
              <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto p-1">
                {(!tenancies || tenancies.length === 0) ? (
                  <p className="text-[13px] text-muted-foreground/60 text-center py-4">No active tenancies found.</p>
                ) : (
                  tenancies.map(tenancy => {
                    const profile = tenancy.profiles;
                    const unit = tenancy.units;
                    const property = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
                    
                    return (
                      <label 
                        key={tenancy.id}
                        className="flex items-start justify-between p-4 rounded-xl border border-border/50 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary"
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="radio" 
                            name="tenancyId" 
                            value={tenancy.id}
                            className="mt-1 h-4 w-4 text-primary border-border focus:ring-primary"
                            required
                          />
                          <div>
                            <p className="font-medium text-foreground">{profile?.full_name || "Pending Tenant"}</p>
                            <p className="text-[13px] text-muted-foreground mt-0.5">{property?.name} - Unit {unit?.name}</p>
                            <p className="text-[11px] text-muted-foreground/60 font-mono mt-1">{profile?.phone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-medium text-foreground">Rent: {formatKES(Number(tenancy.rent_amount))}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="note" className="text-[13px] font-medium text-foreground">
                  Reconciliation note <span className="font-normal text-muted-foreground/60">(optional)</span>
                </label>
                <textarea
                  id="note"
                  name="note"
                  maxLength={500}
                  rows={3}
                  placeholder="Why this payment belongs to the selected tenancy"
                  className="w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/40 mt-2">
                <Link href="/payments?filter=unmatched">
                  <Button type="button" variant="outline" className="text-foreground">Cancel</Button>
                </Link>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Match Payment
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
