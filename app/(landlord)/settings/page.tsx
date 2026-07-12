import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MpesaConnectionCard } from "@/components/settings/mpesa-connection-card";
import { EtimsConnectionCard } from "@/components/settings/etims-connection-card";
import { BillingCard } from "@/components/settings/billing-card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error: actionError, saved } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: mpesaStatusRows }, { data: etimsStatusRows }, { data: billingStatusRows }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
      supabase.rpc("landlord_mpesa_connection_status"),
      supabase.rpc("landlord_etims_connection_status"),
      supabase.rpc("landlord_subscription_status"),
    ]);

  const mpesaStatus = Array.isArray(mpesaStatusRows) ? mpesaStatusRows[0] : mpesaStatusRows;
  const etimsStatus = Array.isArray(etimsStatusRows) ? etimsStatusRows[0] : etimsStatusRows;
  const billingStatus = Array.isArray(billingStatusRows) ? billingStatusRows[0] : billingStatusRows;

  const updateProfile = async (formData: FormData) => {
    "use server";
    const fullName = (formData.get("full_name") as string)?.trim();
    if (!fullName || fullName.length < 2) {
      redirect(`/settings?error=${encodeURIComponent("Full name must be at least 2 characters.")}`);
    }
    const sb = await createClient();
    const { error } = await sb.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) {
      redirect(`/settings?error=${encodeURIComponent(error.message)}`);
    }
    revalidatePath("/settings");
    redirect("/settings?saved=1");
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Account
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-[15px] text-muted-foreground">
          Manage your business profile and payment connections.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          {actionError}
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
          Profile updated.
        </div>
      )}

      <Card className="premium-card">
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>{user.email ?? profile?.phone ?? ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateProfile} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="full_name" className="text-[13px] font-medium text-foreground">
                Full name
              </label>
              <input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                required
                minLength={2}
                className="h-10 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <MpesaConnectionCard
        initialStatus={{
          connected: mpesaStatus?.connected ?? false,
          environment: mpesaStatus?.environment ?? null,
          maskedShortcode: mpesaStatus?.masked_shortcode ?? null,
          verifiedAt: mpesaStatus?.verified_at ?? null,
        }}
      />

      <EtimsConnectionCard
        initialStatus={{
          connected: etimsStatus?.connected ?? false,
          kraPin: etimsStatus?.kra_pin ?? null,
          cuType: etimsStatus?.cu_type ?? null,
          environment: etimsStatus?.environment ?? null,
          verifiedAt: etimsStatus?.verified_at ?? null,
        }}
      />

      <BillingCard
        status={{
          planName: billingStatus?.plan_name ?? null,
          priceKesMonthly: billingStatus?.price_kes_monthly ?? null,
          status: billingStatus?.status ?? null,
          trialEndsAt: billingStatus?.trial_ends_at ?? null,
          currentPeriodEnd: billingStatus?.current_period_end ?? null,
          propertiesUsed: billingStatus?.properties_used ?? null,
          maxProperties: billingStatus?.max_properties ?? null,
        }}
      />
    </div>
  );
}
