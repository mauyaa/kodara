import Link from "next/link";
import { Building2, MapPin, Users, Wallet } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export default async function PropertiesPage() {
  const supabase = await createClient();

  // Fetch properties and their units/tenancies to calculate metrics
  const { data: propertiesData } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      address,
      units (
        id,
        tenancies (
          id,
          rent_amount,
          status
        )
      )
    `);

  const activeTenancyIds = (propertiesData || []).flatMap(property =>
    (property.units || []).flatMap(u =>
      (u.tenancies || []).filter(t => t.status === 'active').map(t => t.id)
    )
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: monthPayments } = activeTenancyIds.length
    ? await supabase
        .from('payments')
        .select('tenancy_id, amount')
        .in('tenancy_id', activeTenancyIds)
        .eq('status', 'succeeded')
        .gte('paid_at', monthStart.toISOString())
    : { data: [] };

  const paidByTenancy = new Map<string, number>();
  for (const p of monthPayments || []) {
    if (!p.tenancy_id) continue;
    paidByTenancy.set(p.tenancy_id, (paidByTenancy.get(p.tenancy_id) || 0) + Number(p.amount));
  }

  const properties = (propertiesData || []).map(property => {
    const totalUnits = property.units?.length || 0;

    // An occupied unit is one with at least one active tenancy
    const activeTenancies = property.units?.flatMap(u =>
      u.tenancies?.filter(t => t.status === 'active') || []
    ) || [];

    const occupiedUnits = activeTenancies.length;

    // Expected revenue is the sum of rent for all active tenancies
    const expectedRevenue = activeTenancies.reduce((sum, t) => sum + Number(t.rent_amount), 0);

    // Collected revenue is the sum of succeeded payments this month for those tenancies
    const collectedRevenue = activeTenancies.reduce(
      (sum, t) => sum + (paidByTenancy.get(t.id) || 0),
      0
    );

    let status = 'perfect';
    if (totalUnits === 0) status = 'attention';
    else if (occupiedUnits < totalUnits) status = 'attention';

    return {
      ...property,
      totalUnits,
      occupiedUnits,
      expectedRevenue,
      collectedRevenue,
      status
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Portfolio
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Properties</h1>
          <p className="text-[15px] text-muted-foreground">
            Manage your buildings, units, and portfolio performance.
          </p>
        </div>
        <Link href="/properties/new" className="transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.96]">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-9">
            <Building2 className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-secondary/30 ring-1 ring-border/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background ring-1 ring-border shadow-sm mb-5">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No properties yet</h3>
          <p className="text-[14px] text-muted-foreground mt-1 max-w-sm">
            Add your first property to start managing units, tracking tenancies, and collecting rent.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`} className="group block focus:outline-none focus:ring-2 focus:ring-primary rounded-[var(--radius)] transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.98]">
              <Card className="premium-card h-full cursor-pointer transition-all">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">{property.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1.5 text-[12px] mt-0.5 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {property.address}
                        </CardDescription>
                      </div>
                    </div>
                    {property.status === "perfect" && property.totalUnits > 0 && (
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-semibold uppercase tracking-wider">100% Full</Badge>
                    )}
                    {property.status === "attention" && property.totalUnits > 0 && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/25 text-[10px] font-semibold uppercase tracking-wider">Vacancies</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-5 mt-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
                        <Users className="h-3 w-3" />
                        Occupancy
                      </p>
                      <p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
                        {property.occupiedUnits} <span className="text-muted-foreground/60 font-medium text-sm">/ {property.totalUnits}</span>
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
                        <Wallet className="h-3 w-3" />
                        Expected
                      </p>
                      <p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
                        {formatKES(property.expectedRevenue)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                        {formatKES(property.collectedRevenue)} collected
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
