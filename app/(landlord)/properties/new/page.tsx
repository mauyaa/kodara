import Link from "next/link";
import { Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NewPropertyPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;

  const addProperty = async (formData: FormData) => {
    "use server";

    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const county = formData.get("county") as string;
    const initialUnits = parseInt(formData.get("initialUnits") as string || "0");

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect("/login");

    // Insert property
    const { data: property, error: propError } = await supabase
      .from('properties')
      .insert({
        landlord_id: user.id,
        name,
        address,
        county: county || null
      })
      .select()
      .single();

    if (propError || !property) {
      redirect(`/properties/new?error=${encodeURIComponent(propError?.message || "Failed to create property")}`);
    }

    // Create initial units if requested
    if (initialUnits > 0) {
      const unitsToInsert = Array.from({ length: initialUnits }, (_, i) => ({
        property_id: property.id,
        name: `Unit ${String(i + 1).padStart(2, '0')}`
      }));

      const { error: unitsError } = await supabase
        .from('units')
        .insert(unitsToInsert);

      if (unitsError) {
        redirect(`/properties/${property.id}?error=${encodeURIComponent("Property was created but units could not be added: " + unitsError.message)}`);
      }
    }

    redirect(`/properties`);
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Add New Property</h1>
        <p className="text-[15px] text-muted-foreground">
          Enter the details of your new building or apartment block.
        </p>
      </div>

      {searchParams?.error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="font-medium">{searchParams.error}</div>
        </div>
      )}

      <Card className="premium-card">
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
          <CardDescription>Basic information about the location</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addProperty} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-[13px] font-medium text-foreground">Property Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Sunrise Apartments"
                className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="address" className="text-[13px] font-medium text-foreground">Street Address</label>
              <input
                id="address"
                name="address"
                type="text"
                required
                placeholder="e.g. Kilimani, Argwings Kodhek Rd"
                className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="county" className="text-[13px] font-medium text-foreground">County</label>
              <input
                id="county"
                name="county"
                type="text"
                placeholder="e.g. Nairobi"
                className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="initialUnits" className="text-[13px] font-medium text-foreground">Number of Units (Optional)</label>
              <p className="text-[11px] text-muted-foreground/80 mb-1">We will automatically generate this many numbered units for you.</p>
              <input
                id="initialUnits"
                name="initialUnits"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                className="flex h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Link href="/properties">
                <Button type="button" variant="outline" className="text-foreground h-11 rounded-xl">Cancel</Button>
              </Link>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-xl px-6 font-semibold shadow-sm active:scale-[0.98] transition-all">
                <Building2 className="mr-2 h-4 w-4" />
                Save Property
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
