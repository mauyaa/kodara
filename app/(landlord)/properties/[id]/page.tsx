import Link from "next/link";
import { ChevronLeft, DoorOpen, Phone } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const propertyId = resolvedParams.id;
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      address,
      units (
        id,
        name,
        tenancies (
          id,
          rent_amount,
          status,
          profiles (
            full_name,
            phone
          )
        )
      )
    `)
    .eq('id', propertyId)
    .single();

  if (error || !property) {
    return redirect("/properties");
  }

  const activeTenancyIds = (property.units || []).flatMap(unit =>
    (unit.tenancies || []).filter(t => t.status === 'active').map(t => t.id)
  );

  const { data: balances } = activeTenancyIds.length
    ? await supabase
        .from('tenancy_balances')
        .select('tenancy_id, balance')
        .in('tenancy_id', activeTenancyIds)
    : { data: [] };

  const balanceByTenancy = new Map(
    (balances || []).map((b) => [b.tenancy_id, Number(b.balance)])
  );

  // Server action to add a unit inline
  const addUnit = async (formData: FormData) => {
    "use server";
    const name = formData.get("name") as string;
    const sb = await createClient();
    
    await sb.from('units').insert({
      property_id: propertyId,
      name
    });
    
    revalidatePath(`/properties/${propertyId}`);
  };

  const units = (property.units || []).map(unit => {
    // Find active tenancy
    const activeTenancy = unit.tenancies?.find(t => t.status === 'active');
    const rentAmount = activeTenancy ? Number(activeTenancy.rent_amount) : 0;
    const tenantName = activeTenancy?.profiles?.full_name || null;
    const tenantPhone = activeTenancy?.profiles?.phone || null;
    
    let status = 'vacant';
    if (activeTenancy) status = 'occupied';
    
    return {
      id: unit.id,
      number: unit.name,
      rent: rentAmount,
      status,
      tenant: tenantName,
      phone: tenantPhone,
      arrears: activeTenancy ? (balanceByTenancy.get(activeTenancy.id) || 0) : 0
    };
  });

  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status === 'occupied').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const totalArrears = units.reduce((acc, unit) => acc + unit.arrears, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link href="/properties" className="flex items-center text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors w-fit">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Properties
        </Link>
        
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{property.name}</h1>
            <p className="text-[15px] text-muted-foreground mt-1">{property.address}</p>
          </div>
          <div className="flex gap-3 items-center">
            <form action={addUnit} className="flex gap-2 items-center">
              <input 
                type="text" 
                name="name" 
                placeholder="Unit Name" 
                required 
                className="h-10 px-3 text-[14px] border border-border/50 bg-secondary/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl px-4 shadow-sm text-[14px] font-medium active:scale-[0.98] transition-all">Add Unit</Button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums">{totalUnits}</div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Occupancy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums">{occupancyRate}%</div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Arrears</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-[28px] leading-none font-bold tracking-tight tabular-nums ${totalArrears > 0 ? "text-destructive" : "text-foreground"}`}>
              {formatKES(totalArrears)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="premium-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
          <CardTitle className="text-base font-semibold">Units & Tenants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tenant</TableHead>
                <TableHead className="text-right h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rent</TableHead>
                <TableHead className="text-right pr-6 h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arrears</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-[13px] text-muted-foreground">
                    Units appear here once you add them above.
                  </TableCell>
                </TableRow>
              ) : units.map((unit) => (
                <TableRow key={unit.id} className="cursor-pointer hover:bg-secondary/20 transition-colors">
                  <TableCell className="pl-6 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4 text-muted-foreground/60" />
                      {unit.number}
                    </div>
                  </TableCell>
                  <TableCell>
                    {unit.status === "occupied" && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-semibold">Occupied</Badge>}
                    {unit.status === "vacant" && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/25 text-[10px] uppercase tracking-wider font-semibold">Vacant</Badge>}
                  </TableCell>
                  <TableCell>
                    {unit.tenant ? (
                      <div>
                        <div className="font-medium text-foreground">{unit.tenant}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {unit.phone}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60 text-[13px]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatKES(unit.rent)}</TableCell>
                  <TableCell className="text-right pr-6">
                    {unit.arrears > 0 ? (
                      <span className="text-destructive font-semibold tabular-nums">{formatKES(unit.arrears)}</span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
