import { ArrowRight, Building2, CheckCircle2, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const inputClassName =
  "flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50";

function StepProgress({ step }: { step: number }) {
  const steps = ["Add a property", "Invite a tenant", "Done"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === step;
        const done = stepNumber < step;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
            </div>
            <span className={`text-[13px] ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
            {stepNumber < steps.length && <div className="h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; propertyId?: string; error?: string }>;
}) {
  const { step: stepParam, propertyId, error: actionError } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count: existingProperties } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  // Already has a portfolio -- this wizard is only for a brand-new account.
  if ((existingProperties ?? 0) > 0 && !stepParam) {
    redirect("/dashboard");
  }

  const step = Number(stepParam ?? "1");

  const addProperty = async (formData: FormData) => {
    "use server";
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const county = formData.get("county") as string;
    const initialUnits = parseInt((formData.get("initialUnits") as string) || "1");

    const sb = await createClient();
    const {
      data: { user: currentUser },
    } = await sb.auth.getUser();
    if (!currentUser) redirect("/login");

    const { data: property, error } = await sb
      .from("properties")
      .insert({ landlord_id: currentUser.id, name, address, county: county || null })
      .select()
      .single();

    if (error || !property) {
      redirect(`/onboarding?step=1&error=${encodeURIComponent(error?.message || "Could not create property")}`);
    }

    if (initialUnits > 0) {
      const unitsToInsert = Array.from({ length: initialUnits }, (_, i) => ({
        property_id: property.id,
        name: `Unit ${String(i + 1).padStart(2, "0")}`,
      }));
      await sb.from("units").insert(unitsToInsert);
    }

    redirect(`/onboarding?step=2&propertyId=${property.id}`);
  };

  const inviteTenant = async (formData: FormData) => {
    "use server";
    const unitId = formData.get("unitId") as string;
    const phone = formData.get("phone") as string;
    const rentAmount = parseFloat(formData.get("rentAmount") as string);
    const billingDay = parseInt(formData.get("billingDay") as string, 10);
    const startDate = formData.get("startDate") as string;

    const sb = await createClient();
    const { error } = await sb.rpc("create_tenant_invitation", {
      target_unit_id: unitId,
      tenant_phone: phone,
      tenancy_rent: rentAmount,
      tenancy_billing_day: billingDay,
      tenancy_start_date: startDate,
    });

    if (error) {
      redirect(
        `/onboarding?step=2&propertyId=${propertyId}&error=${encodeURIComponent(error.message)}`,
      );
    }

    redirect("/onboarding?step=3");
  };

  let units: { id: string; name: string }[] = [];
  if (step === 2 && propertyId) {
    const { data } = await supabase.from("units").select("id, name").eq("property_id", propertyId);
    units = data ?? [];
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Welcome to Kodara
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {step === 1 && "Add your first property"}
          {step === 2 && "Invite your first tenant"}
          {step === 3 && "You're all set"}
        </h1>
        <StepProgress step={step} />
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {step === 1 && (
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Property details</CardTitle>
            <CardDescription>Your first building or apartment block.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={addProperty} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-[13px] font-medium text-foreground">
                  Property name
                </label>
                <input id="name" name="name" required placeholder="e.g. Sunrise Apartments" className={inputClassName} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="address" className="text-[13px] font-medium text-foreground">
                  Street address
                </label>
                <input id="address" name="address" required placeholder="e.g. Kilimani, Argwings Kodhek Rd" className={inputClassName} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="county" className="text-[13px] font-medium text-foreground">
                  County
                </label>
                <input id="county" name="county" placeholder="e.g. Nairobi" className={inputClassName} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="initialUnits" className="text-[13px] font-medium text-foreground">
                  Number of units
                </label>
                <input
                  id="initialUnits"
                  name="initialUnits"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={1}
                  className={inputClassName}
                />
              </div>
              <div className="flex justify-between gap-3 pt-4 border-t border-border/40">
                <Link href="/dashboard">
                  <Button type="button" variant="outline">
                    Skip for now
                  </Button>
                </Link>
                <Button type="submit">
                  <Building2 className="mr-2 h-4 w-4" />
                  Continue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Tenant &amp; lease details</CardTitle>
            <CardDescription>We&apos;ll send an invite link to their phone number.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={inviteTenant} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="unitId" className="text-[13px] font-medium text-foreground">
                  Unit
                </label>
                <select id="unitId" name="unitId" required className={inputClassName}>
                  <option value="">Select a unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      Unit {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="phone" className="text-[13px] font-medium text-foreground">
                  Tenant phone number
                </label>
                <input id="phone" name="phone" required placeholder="254700000000" className={inputClassName} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="rentAmount" className="text-[13px] font-medium text-foreground">
                  Monthly rent (KES)
                </label>
                <input id="rentAmount" name="rentAmount" type="number" min="0" step="0.01" required placeholder="e.g. 45000" className={inputClassName} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="billingDay" className="text-[13px] font-medium text-foreground">
                    Billing day
                  </label>
                  <input id="billingDay" name="billingDay" type="number" min="1" max="28" required placeholder="e.g. 5" className={inputClassName} />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="startDate" className="text-[13px] font-medium text-foreground">
                    Lease start date
                  </label>
                  <input id="startDate" name="startDate" type="date" required className={inputClassName} />
                </div>
              </div>
              <div className="flex justify-between gap-3 pt-4 border-t border-border/40">
                <Link href="/onboarding?step=3">
                  <Button type="button" variant="outline">
                    Skip for now
                  </Button>
                </Link>
                <Button type="submit" disabled={units.length === 0}>
                  <Users className="mr-2 h-4 w-4" />
                  Send invitation
                </Button>
              </div>
              {units.length === 0 && (
                <p className="text-[12px] text-destructive">
                  No units found on that property. You can invite tenants later from the Tenants page.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="premium-card">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-[17px] font-semibold text-foreground">You&apos;re ready to go</p>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Connect M-Pesa in Settings so rent lands directly in your account.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/settings">
                <Button variant="outline">Connect M-Pesa</Button>
              </Link>
              <Link href="/dashboard">
                <Button>
                  Go to dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
