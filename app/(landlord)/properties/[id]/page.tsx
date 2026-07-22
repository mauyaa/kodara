import Link from "next/link";
import { AlertCircle, ChevronLeft, DoorOpen, Phone, Trash2 } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AnimatedNumber } from "@/components/motion/animated-number";

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  repair_maintenance: "Repair & maintenance",
  utility: "Utility",
  tax: "Tax",
  insurance: "Insurance",
  management_fee: "Management fee",
  other: "Other",
};

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ expenseError?: string }>;
}) {
  const resolvedParams = await params;
  const propertyId = resolvedParams.id;
  const { expenseError } = await searchParams;
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

  const { data: expenses } = await supabase
    .from("property_expenses")
    .select("id, category, description, amount, expense_date")
    .eq("property_id", propertyId)
    .order("expense_date", { ascending: false });

  const totalExpenses = (expenses || []).reduce((acc, e) => acc + Number(e.amount), 0);

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

  const addExpense = async (formData: FormData) => {
    "use server";
    const category = String(formData.get("category") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const amount = Number(formData.get("amount"));
    const expenseDate = String(formData.get("expense_date") ?? "");

    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;

    const { error } = await sb.from("property_expenses").insert({
      property_id: propertyId,
      category,
      description,
      amount,
      expense_date: expenseDate,
      created_by: user.id,
    });

    if (error) {
      redirect(`/properties/${propertyId}?expenseError=${encodeURIComponent(error.message)}`);
    }

    revalidatePath(`/properties/${propertyId}`);
  };

  const deleteExpense = async (formData: FormData) => {
    "use server";
    const id = String(formData.get("id") ?? "");
    const sb = await createClient();
    await sb.from("property_expenses").delete().eq("id", id);
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
  const vacantUnits = totalUnits - occupiedUnits;
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[28px] leading-none font-bold tracking-tight text-foreground">
              <AnimatedNumber value={totalUnits} formatType="count" />
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Occupancy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[28px] leading-none font-bold tracking-tight text-foreground">
              <AnimatedNumber value={occupancyRate} formatType="percent" />
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Arrears</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-[28px] leading-none font-bold tracking-tight ${totalArrears > 0 ? "text-destructive" : "text-foreground"}`}>
              <AnimatedNumber value={totalArrears} formatType="kes" />
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[28px] leading-none font-bold tracking-tight text-foreground">
              <AnimatedNumber value={totalExpenses} formatType="kes" />
            </div>
          </CardContent>
        </Card>
      </div>

      {vacantUnits > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/30 p-4">
          <p className="text-[13px] text-foreground">
            {vacantUnits} vacant unit{vacantUnits > 1 ? "s" : ""} on this property.{" "}
            <span className="text-muted-foreground">List them on Zeni to find a tenant faster.</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-[12px]"
            render={<a href="https://zeniapp.space/agentlogin" target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            List on Zeni
          </Button>
        </div>
      )}

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
                  <TableCell className="text-right font-semibold tabular-nums font-mono">{formatKES(unit.rent)}</TableCell>
                  <TableCell className="text-right pr-6">
                    {unit.arrears > 0 ? (
                      <span className="text-destructive font-semibold tabular-nums font-mono">{formatKES(unit.arrears)}</span>
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

      <Card className="premium-card overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base font-semibold">Property expenses</CardTitle>
          <CardDescription>Repairs, fees, and other costs against this property.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pt-6">
          {expenseError && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {expenseError}
            </div>
          )}

          <form action={addExpense} className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_1fr_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category" className="text-[12px] font-medium text-foreground">Category</label>
              <select
                id="category"
                name="category"
                required
                className="h-10 rounded-lg border border-border/50 bg-secondary/30 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              >
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-[12px] font-medium text-foreground">Description</label>
              <input
                id="description"
                name="description"
                type="text"
                required
                minLength={2}
                maxLength={240}
                placeholder="e.g. Repainted the exterior wall"
                className="h-10 rounded-lg border border-border/50 bg-secondary/30 px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="amount" className="text-[12px] font-medium text-foreground">Amount (KES)</label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                className="h-10 rounded-lg border border-border/50 bg-secondary/30 px-3 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="expense_date" className="text-[12px] font-medium text-foreground">Date</label>
              <input
                id="expense_date"
                name="expense_date"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="h-10 rounded-lg border border-border/50 bg-secondary/30 px-3 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
            </div>
            <Button type="submit" className="h-10 bg-primary text-primary-foreground hover:bg-primary/90 px-4 text-[13px] font-medium">
              Add expense
            </Button>
          </form>

          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</TableHead>
                <TableHead className="text-right h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                <TableHead className="w-10 pr-6 h-11" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!expenses || expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-[13px] text-muted-foreground">
                    Expenses appear here once you record one above.
                  </TableCell>
                </TableRow>
              ) : expenses.map((expense) => (
                <TableRow key={expense.id} className="hover:bg-secondary/20 transition-colors">
                  <TableCell className="pl-6 text-[13px] text-muted-foreground tabular-nums">{expense.expense_date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold">
                      {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">{expense.description}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums font-mono">{formatKES(Number(expense.amount))}</TableCell>
                  <TableCell className="pr-6">
                    <form action={deleteExpense}>
                      <input type="hidden" name="id" value={expense.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete expense"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
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
