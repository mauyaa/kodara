import { Banknote, Wrench, ChevronRight, CheckCircle2, FileWarning, TrendingUp, TrendingDown } from "lucide-react";
import { formatKES } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Reveal } from "@/components/motion/reveal";
import { AnimatedNumber } from "@/components/motion/animated-number";

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

  // Week-over-week change for the hero trend chip. Only shown when there's
  // a real prior week to compare against -- no fabricated "+0%" on a
  // portfolio with no payment history yet.
  const [priorWeek, latestWeek] = weeklyTotals.slice(-2);
  const weekChangePercent =
    priorWeek > 0 ? Math.round(((latestWeek - priorWeek) / priorWeek) * 100) : null;

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

  const { count: failedTaxInvoiceCount } = await supabase
    .from('tax_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed');

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

      {/* The one accent moment on this screen: everything else on the page
          (stat row, ledger, action panel) stays neutral so this card is
          unmistakably the thing to look at first. */}
      <Reveal>
        <div className="relative">
          {weekChangePercent !== null && (
            <div
              className={`absolute -top-[18px] right-9 z-10 flex items-center gap-1.5 rounded-full py-2 px-4 text-[13px] font-bold shadow-lg ${
                weekChangePercent >= 0
                  ? "bg-lime-ink text-lime"
                  : "bg-foreground text-background"
              }`}
            >
              {weekChangePercent >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {weekChangePercent >= 0 ? "+" : ""}
              {weekChangePercent}%
            </div>
          )}
          <Card className="overflow-visible rounded-[28px] border-0 ring-0 bg-lime p-1 shadow-[var(--shadow-hero)]">
            <CardHeader className="pb-3.5 pt-9 px-9">
              <CardTitle className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-lime-ink/70">
                Collected This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="px-9 pb-9">
              <div className="font-display text-[64px] sm:text-[76px] font-extrabold leading-[0.88] tracking-[-0.03em] text-lime-ink">
                <span className="mr-1 align-[0.35em] text-[24px] sm:text-[28px] font-bold opacity-60">Ksh</span>
                <AnimatedNumber value={collectedThisMonth} formatType="count" fontClassName="font-display" />
              </div>
              <p className="mt-4 text-[14px] font-semibold text-lime-ink/70">
                {collectionRate}% of {formatKES(expectedRent)} expected
              </p>
            </CardContent>
          </Card>
        </div>
      </Reveal>

      {/* Supporting metrics stay quiet and inline — no boxed cards
          competing with the hero for a second accent moment. */}
      <Reveal delay={0.06}>
        <div className="flex flex-wrap px-1">
          {metrics.map((metric, i) => (
            <div
              key={metric.title}
              className={`flex-1 min-w-[140px] pr-5 ${i > 0 ? "border-l border-border/60 pl-5" : ""}`}
            >
              <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground mb-1.5">
                {metric.title}
              </p>
              <div className="font-display text-[21px] font-semibold tracking-[-0.015em] text-foreground">
                <AnimatedNumber value={metric.value} formatType={metric.formatType} fontClassName="font-display" />
              </div>
            </div>
          ))}
        </div>
      </Reveal>

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
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {payment.reconciliation_status === "matched_auto" ? "Auto-matched" : "Matched"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Unmatched
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-display font-semibold tabular-nums">{formatKES(payment.amount)}</TableCell>
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
              {(unmatchedPaymentsCount || 0) + (maintenanceCount || 0) + (failedTaxInvoiceCount || 0) === 0 && (
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

              {(failedTaxInvoiceCount || 0) > 0 && (
              <Link href="/payments" className="group block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.98]">
                <div className="flex items-center justify-between rounded-xl bg-background p-4 shadow-sm ring-1 ring-border/50 transition-all group-hover:shadow-float">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                      <FileWarning className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{failedTaxInvoiceCount || 0} eTIMS invoices failed</p>
                      <p className="text-xs text-muted-foreground mt-0.5">KRA submission needs attention</p>
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
