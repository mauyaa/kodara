import { Users, Search, Filter } from "lucide-react";
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
import Link from "next/link";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  // Fetch tenancies joined with profiles, units, and properties
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select(`
      id,
      status,
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
    .order('created_at', { ascending: false });

  const { data: balances } = await supabase
    .from('tenancy_balances')
    .select('tenancy_id, balance');

  const balanceByTenancy = new Map(
    (balances || []).map((b) => [b.tenancy_id, Number(b.balance)])
  );

  const query = q?.trim().toLowerCase() ?? "";
  const statusFilter = ["active", "pending", "ended"].includes(status ?? "")
    ? status
    : undefined;

  const filtered = (tenancies || []).filter((tenancy) => {
    if (statusFilter && tenancy.status !== statusFilter) return false;
    if (!query) return true;
    const unit = tenancy.units;
    const property =
      unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
    const haystack = [
      tenancy.profiles?.full_name,
      tenancy.profiles?.phone,
      property?.name,
      unit?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Portfolio
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tenants</h1>
          <p className="text-[15px] text-muted-foreground">
            Directory of all active and past tenants across your portfolio.
          </p>
        </div>
        <Link href="/tenants/new">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl px-4 shadow-sm text-[14px] font-medium active:scale-[0.98] transition-all">
            <Users className="mr-2 h-4 w-4" />
            Onboard Tenant
          </Button>
        </Link>
      </div>

      <Card className="premium-card overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
          <CardTitle className="text-base font-semibold">All Tenants</CardTitle>
          <form action="/tenants" className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search tenants, units..."
                className="h-10 w-[220px] rounded-xl border border-border/50 bg-secondary/30 pl-9 pr-3 text-[14px] outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
            <select
              name="status"
              defaultValue={statusFilter ?? ""}
              aria-label="Filter by lease status"
              className="h-10 rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="ended">Ended</option>
            </select>
            <Button type="submit" variant="outline" size="sm" className="h-10 rounded-xl px-4">
              <Filter className="mr-2 h-4 w-4" />
              Apply
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tenant Details</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Location</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lease Status</TableHead>
                <TableHead className="text-right pr-6 h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Financial Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-[13px] text-muted-foreground">
                    {query || statusFilter
                      ? "No tenants match this search."
                      : "Tenants appear here once you onboard them to a unit."}
                  </TableCell>
                </TableRow>
              ) : filtered.map((tenancy) => {
                const profile = tenancy.profiles;
                const unit = tenancy.units;
                const property = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
                const arrears = balanceByTenancy.get(tenancy.id) ?? 0;

                return (
                  <TableRow key={tenancy.id} className="cursor-pointer hover:bg-secondary/20 transition-colors">
                    <TableCell className="pl-6">
                      <div className="font-medium text-foreground">{profile?.full_name || "Pending Onboarding"}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{profile?.phone || "Invited via Phone"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{property?.name || "Unknown Property"}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Unit {unit?.name || "Unknown"}</div>
                    </TableCell>
                    <TableCell>
                      {tenancy.status === "active" && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-semibold">Active Lease</Badge>}
                      {tenancy.status === "pending" && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] uppercase tracking-wider font-semibold">Pending Invite</Badge>}
                      {tenancy.status === "ended" && <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border/50 text-[10px] uppercase tracking-wider font-semibold">Ended</Badge>}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {arrears > 0 ? (
                        <div>
                          <div className="text-destructive font-semibold tabular-nums">{formatKES(arrears)}</div>
                          <div className="text-[10px] uppercase font-bold tracking-widest text-destructive/80 mt-0.5">In Arrears</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-foreground font-semibold tabular-nums">{formatKES(Number(tenancy.rent_amount))} / mo</div>
                          <div className="text-[10px] uppercase font-bold tracking-widest text-primary/80 mt-0.5">Up to Date</div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
