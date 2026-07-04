import { Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function OnboardTenantPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: actionError } = await props.searchParams;
  const supabase = await createClient();

  // Fetch properties and their units to populate the dropdown
  const { data: properties } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      units (
        id,
        name,
        tenancies (
          status
        )
      )
    `);

  // Filter out units that already have an active tenancy
  const availableUnits = (properties || []).flatMap(prop => 
    (prop.units || [])
      .filter(u => !u.tenancies?.some(t => t.status === 'active'))
      .map(u => ({
        id: u.id,
        name: `${prop.name} - Unit ${u.name}`
      }))
  );

  const onboardTenant = async (formData: FormData) => {
    "use server";
    
    const unitId = formData.get("unitId") as string;
    const phone = formData.get("phone") as string;
    const rentAmount = parseFloat(formData.get("rentAmount") as string);
    const billingDay = parseInt(formData.get("billingDay") as string, 10);
    const startDate = formData.get("startDate") as string;

    const sb = await createClient();

    // Call the RPC to create a tenant invitation
    const { error } = await sb.rpc('create_tenant_invitation', {
      target_unit_id: unitId,
      tenant_phone: phone,
      tenancy_rent: rentAmount,
      tenancy_billing_day: billingDay,
      tenancy_start_date: startDate
    });

    if (error) {
      redirect(`/tenants/new?error=${encodeURIComponent(error.message)}`);
    }

    redirect(`/tenants`);
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Onboard Tenant</h1>
        <p className="text-[15px] text-muted-foreground">
          Invite a new tenant to a vacant unit via SMS.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="font-medium">{actionError}</div>
        </div>
      )}

      <Card className="premium-card">
        <CardHeader>
          <CardTitle>Tenant & Lease Details</CardTitle>
          <CardDescription>We will send them an invite link to complete their profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onboardTenant} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="unitId" className="text-[13px] font-medium text-foreground">Assign to Unit</label>
              <select
                id="unitId"
                name="unitId"
                required
                className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              >
                <option value="">Select a vacant unit</option>
                {availableUnits.map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
              {availableUnits.length === 0 && (
                <p className="text-[11px] text-destructive">You don&apos;t have any vacant units available.</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-[13px] font-medium text-foreground">Tenant Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="254700000000"
                className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
              <p className="text-[11px] text-muted-foreground/80">Must be in 2547XXXXXXXX format for M-Pesa compatibility.</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="rentAmount" className="text-[13px] font-medium text-foreground">Monthly Rent Amount (KES)</label>
              <input
                id="rentAmount"
                name="rentAmount"
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="e.g. 45000"
                className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="billingDay" className="text-[13px] font-medium text-foreground">Billing Day</label>
                <input
                  id="billingDay"
                  name="billingDay"
                  type="number"
                  required
                  min="1"
                  max="28"
                  placeholder="e.g. 5"
                  className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="startDate" className="text-[13px] font-medium text-foreground">Lease Start Date</label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Link href="/tenants">
                <Button type="button" variant="outline" className="text-foreground h-11 rounded-xl">Cancel</Button>
              </Link>
              <Button type="submit" disabled={availableUnits.length === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl px-6 font-semibold shadow-sm active:scale-[0.98] transition-all">
                <Users className="mr-2 h-4 w-4" />
                Send Invitation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
