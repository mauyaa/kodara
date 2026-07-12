import { Search } from "lucide-react";
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

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('payments')
    .select(`
      id,
      amount,
      reconciliation_status,
      provider_transaction_id,
      created_at,
      sender_phone,
      tax_invoices (
        status,
        kra_invoice_number
      ),
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
    .order('created_at', { ascending: false });

  if (filter === 'unmatched') {
    query = query.eq('reconciliation_status', 'unmatched');
  }

  const safeQ = q?.replace(/[,()]/g, '').trim();
  if (safeQ) {
    query = query.or(`provider_transaction_id.ilike.%${safeQ}%,sender_phone.ilike.%${safeQ}%`);
  }

  const { data: payments } = await query;

  // Also fetch totals for the cards (unfiltered)
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount, reconciliation_status');

  const totalCollected = (allPayments || [])
    .filter(p => p.reconciliation_status !== 'unmatched')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const unmatchedPayments = (allPayments || []).filter(p => p.reconciliation_status === 'unmatched');
  const totalUnmatched = unmatchedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Payments & Ledger</h1>
        <p className="text-[15px] text-muted-foreground">
          Real-time synchronization with M-Pesa. Track every shilling.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums font-mono">{formatKES(totalCollected)}</div>
            <p className="text-[13px] text-muted-foreground mt-2.5">Matched payments, all time</p>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Unmatched Funds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[28px] leading-none font-bold tracking-tight text-foreground tabular-nums font-mono">{formatKES(totalUnmatched)}</div>
            <p className="text-[13px] text-muted-foreground mt-2.5 tabular-nums">
              {unmatchedPayments.length === 1
                ? "1 transaction needs attention"
                : `${unmatchedPayments.length} transactions need attention`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="premium-card overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
          <CardTitle className="text-base font-semibold">{filter === 'unmatched' ? 'Unmatched Transactions' : 'Transaction History'}</CardTitle>
          <div className="flex items-center gap-3">
            {filter === 'unmatched' && (
              <Link href="/payments" className="transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.96]">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 h-9 font-medium">
                  Clear Filter
                </Button>
              </Link>
            )}
            <form action="/payments" className="relative">
              {filter && <input type="hidden" name="filter" value={filter} />}
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search receipt or phone..."
                className="h-9 w-[250px] rounded-md border-0 bg-secondary/80 pl-9 pr-3 text-[14px] outline-none focus:bg-background focus:ring-2 focus:ring-primary transition-all duration-200 ease-[var(--ease-out)] placeholder:text-muted-foreground"
              />
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow>
                <TableHead className="pl-6">Receipt / Time</TableHead>
                <TableHead>Payer Details</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tax Invoice</TableHead>
                <TableHead className="text-right pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!payments || payments.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-[13px] text-muted-foreground">
                    {filter === "unmatched"
                      ? "Every payment is matched to a tenancy. Nothing to resolve."
                      : "Payments appear here in real time as tenants pay via M-Pesa."}
                  </TableCell>
                </TableRow>
              ) : payments.map((payment) => {
                const tenancy = Array.isArray(payment.tenancies) ? payment.tenancies[0] : payment.tenancies;
                const profile = tenancy?.profiles;
                const unit = tenancy?.units;
                const unitProperty = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
                const taxInvoice = Array.isArray(payment.tax_invoices) ? payment.tax_invoices[0] : payment.tax_invoices;

                return (
                  <TableRow key={payment.id} className="cursor-pointer hover:bg-secondary/30 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div className="font-mono text-[13px] font-semibold text-foreground tracking-tight">{payment.provider_transaction_id}</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5 tabular-nums">
                        {new Date(payment.created_at).toLocaleString("en-KE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-medium text-[14px] text-foreground">{profile?.full_name || "Unknown Sender"}</div>
                      <div className="text-[12px] text-muted-foreground font-mono mt-0.5 tracking-tight">{payment.sender_phone}</div>
                    </TableCell>
                    <TableCell className="py-4">
                      {unitProperty ? (
                        <div>
                          <div className="text-[14px] text-foreground">{unitProperty.name}</div>
                          <div className="text-[12px] text-muted-foreground mt-0.5">Unit {unit.name}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {payment.reconciliation_status === "matched_auto" && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-semibold">Auto-matched</Badge>}
                      {payment.reconciliation_status === "matched_manual" && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-semibold">Matched</Badge>}
                      {payment.reconciliation_status === "unmatched" && (
                        <Link href={`/payments/${payment.id}/resolve`} className="inline-block transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.96]">
                          <Button size="sm" variant="outline" className="h-7 px-3 text-[11px] font-medium border-border/80 bg-background text-foreground hover:bg-secondary hover:text-foreground shadow-sm">
                            Match Now
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {!taxInvoice ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : taxInvoice.status === "submitted" ? (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-semibold">
                          Filed
                        </Badge>
                      ) : taxInvoice.status === "pending" ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] uppercase tracking-wider font-semibold">
                          Pending
                        </Badge>
                      ) : taxInvoice.status === "failed" ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] uppercase tracking-wider font-semibold">
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] uppercase tracking-wider font-semibold">
                          Not connected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6 py-4 font-semibold text-[15px] text-foreground tracking-tight tabular-nums font-mono">
                      {formatKES(payment.amount)}
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
