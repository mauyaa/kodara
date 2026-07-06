import { Banknote, Wrench, ChevronRight, CheckCircle2 } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Sparkline } from "@/components/data/sparkline";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch all active tenancies for expected rent
  const { data: tenancies } = await supabase
    .from('tenancies')
    .select('id, rent_amount, status')
    .eq('status', 'active');

  const expectedRent = (tenancies || []).reduce((acc, curr) => acc + Number(curr.rent_amount), 0);

  // Fetch all-time balance totals across the portfolio for arrears.
  const { data: balances } = await supabase
    .from('tenancy_balances')
    .select('balance');

  const arrears = (balances || []).reduce((acc, b) => acc + Number(b.balance), 0);

  // Monthly collection must use the same period as monthly expected rent.
  // Mixing all-time payments with one month's rent makes the rate meaningless.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: monthlyPayments } = await supabase
    .from('payments')
    .select('amount')
    .in('reconciliation_status', ['matched_auto', 'matched_manual'])
    .gte('paid_at', monthStart);

  const collectedThisMonth = (monthlyPayments || []).reduce(
    (acc, payment) => acc + Number(payment.amount),
    0,
  );
  const collectionRate = expectedRent > 0 ? Math.round((collectedThisMonth / expectedRent) * 100) : 0;

  // 8-week collection trend for the hero sparkline — real weekly totals,
  // not a fabricated series.
  const trendStart = new Date(now);
  trendStart.setDate(trendStart.getDate() - 7 * 8);
  const { data: trendPayments } = await supabase
    .from('payments')
    .select('amount, paid_at')
    .in('reconciliation_status', ['matched_auto', 'matched_manual'])
    .gte('paid_at', trendStart.toISOString());

  const weeklyTotals = Array.from({ length: 8 }, () => 0);
  for (const p of trendPayments || []) {
    const paidAt = new Date(p.paid_at);
    const weeksAgo = Math.floor((now.getTime() - paidAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const bucket = 7 - Math.min(weeksAgo, 7);
    weeklyTotals[bucket] += Number(p.amount);
  }

  // Fetch the most recent payments for the ledger table (display only, not used for totals above)
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      reconciliation_status,
      provider_transaction_id,
      created_at,
      sender_phone,
      tenancies (
        profiles (
          full_name
        ),
        units (
          name,
          properties (
            name
          )
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch maintenance requests
  const { count: maintenanceCount } = await supabase
    .from('maintenance_requests')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'completed');

  const { count: unmatchedPaymentsCount } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('reconciliation_status', 'unmatched');

  const metrics = [
    {
      title: "Expected Rent",
      value: expectedRent,
      formatType: "kes" as const,
      description: "From active tenancies",
    },
    {
      title: "Arrears",
      value: arrears,
      formatType: "kes" as const,
      description: "Remaining balance",
    },
    {
      title: "Open Maintenance",
      value: maintenanceCount || 0,
      formatType: "tickets" as const,
      description: "Requires action",
    },
  ];

  const monthLabel = now.toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-8">
      <Reveal className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {monthLabel} · Portfolio
        </p>
        <h1 className="text-4xl font-bold tracking-tighter text-foreground">Dashboard</h1>
        <p className="text-[15px] text-muted-foreground">
          Portfolio overview and real-time financial ledger.
        </p>
      </Reveal>

      {/* Golden-ratio row: the hero takes ~38% of the width, the three
          supporting metrics share the remaining ~62%. */}
      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <RevealItem className="sm:col-span-2 xl:col-span-2">
          {/* Hero metric — the one number that matters this month */}
          <Card className="h-full overflow-hidden rounded-[var(--radius)] border-0 ring-0 bg-foreground text-background shadow-[var(--shadow-hero)]">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-background/50">
                  Collected This Month
                </CardTitle>
                <Sparkline
                  points={weeklyTotals}
                  width={72}
                  height={24}
                  className="mt-0.5 shrink-0 text-[oklch(72%_0.13_166)]"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[34px] leading-none font-bold tracking-tighter">
                <AnimatedNumber value={collectedThisMonth} formatType="kes" />
              </div>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-background/15">
                <div
                  className="h-full rounded-full bg-[oklch(72%_0.13_166)] transition-[width] duration-700 ease-[var(--ease-out)]"
                  style={{ width: `${Math.min(collectionRate, 100)}%` }}
                />
              </div>
              <p className="text-[13px] text-background/60 mt-2.5">
                {collectionRate}% of expected rent · 8-week trend above
              </p>
            </CardContent>
          </Card>
        </RevealItem>

        {metrics.map((metric) => (
          <RevealItem key={metric.title}>
            <Card className="premium-card h-full overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {metric.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-[28px] leading-none font-bold tracking-tight text-foreground">
                  <AnimatedNumber value={metric.value} formatType={metric.formatType} />
                </div>
                <p className="text-[13px] text-muted-foreground mt-2.5">{metric.description}</p>
              </CardContent>
            </Card>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal delay={0.12} className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <Card className="premium-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4 mb-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Recent M-Pesa Ledger</CardTitle>
              <CardDescription className="text-[13px]">Real-time incoming payments.</CardDescription>
            </div>
            <Link href="/payments" className="transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.96]">
              <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Tenant / Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!payments || payments.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-[13px] text-muted-foreground">
                      Payments appear here in real time as tenants pay via M-Pesa.
                    </TableCell>
                  </TableRow>
                ) : payments.map((payment) => {
                  const tenancy = Array.isArray(payment.tenancies) ? payment.tenancies[0] : payment.tenancies;
                  const profile = tenancy?.profiles;
                  const unit = tenancy?.units;
                  // Handle arrays for relations if supabase returns array for 1-to-many (even if it's 1-to-1 conceptually)
                  const unitProperty = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
                  
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.provider_transaction_id}
                        <div className="text-xs text-muted-foreground font-normal tabular-nums">
                          {new Date(payment.created_at).toLocaleString("en-KE", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {profile?.full_name || payment.sender_phone || "Unknown Sender"}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {unitProperty?.name ? `${unitProperty.name} - ${unit.name}` : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.reconciliation_status.startsWith("matched") ? (
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-semibold">
                            {payment.reconciliation_status === "matched_auto" ? "Auto-matched" : "Matched"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/25 text-[10px] uppercase tracking-wider font-semibold">
                            Unmatched
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatKES(payment.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-2xl border-0 shadow-none bg-secondary/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {(unmatchedPaymentsCount || 0) + (maintenanceCount || 0) === 0 && (
                <div className="flex items-center gap-4 rounded-xl bg-background p-4 ring-1 ring-border/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">All caught up</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Nothing needs your attention right now.</p>
                  </div>
                </div>
              )}
              {(unmatchedPaymentsCount || 0) > 0 && (
              <Link href="/payments?filter=unmatched" className="group block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.98]">
                <div className="flex items-center justify-between rounded-xl bg-background p-4 shadow-sm ring-1 ring-border/50 transition-all group-hover:shadow-float">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Banknote className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{unmatchedPaymentsCount || 0} Unmatched Payments</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Requires manual allocation</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
              )}

              {(maintenanceCount || 0) > 0 && (
              <Link href="/maintenance" className="group block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.98]">
                <div className="flex items-center justify-between rounded-xl bg-background p-4 shadow-sm ring-1 ring-border/50 transition-all group-hover:shadow-float">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                      <Wrench className="h-4 w-4 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{maintenanceCount || 0} Open Tickets</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Maintenance requests</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}
