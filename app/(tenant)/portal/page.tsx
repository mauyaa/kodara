import { AlertCircle, BellRing, CheckCircle2, Smartphone, Wrench } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatKES } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

function nextDueDate(billingDay: number, from = new Date()) {
  const candidate = new Date(from.getFullYear(), from.getMonth(), billingDay);
  if (candidate < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}

export default async function TenantPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; ticket?: string }>;
}) {
  const { sent, error: actionError, ticket } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select(`
      id,
      rent_amount,
      billing_day,
      payment_reference,
      units (
        name,
        properties ( name )
      )
    `)
    .eq("tenant_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!tenancy) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-secondary/30 px-4 py-16 text-center ring-1 ring-border/50">
        <h1 className="text-lg font-medium text-foreground">No active tenancy</h1>
        <p className="mt-1 max-w-sm text-[14px] text-muted-foreground">
          Once your landlord assigns you to a unit, your rent details appear here.
        </p>
      </div>
    );
  }

  const unit = Array.isArray(tenancy.units) ? tenancy.units[0] : tenancy.units;
  const property =
    unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;

  const { data: balanceRow } = await supabase
    .from("tenancy_balances")
    .select("balance, total_paid")
    .eq("tenancy_id", tenancy.id)
    .maybeSingle();

  const balance = Number(balanceRow?.balance ?? 0);
  const rent = Number(tenancy.rent_amount);
  const dueDate = nextDueDate(tenancy.billing_day);
  const dueLabel = dueDate.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
  });

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, provider_transaction_id, paid_at, reconciliation_status")
    .eq("tenancy_id", tenancy.id)
    .order("paid_at", { ascending: false })
    .limit(8);

  const { data: tickets } = await supabase
    .from("maintenance_requests")
    .select("id, title, status, created_at")
    .eq("tenancy_id", tenancy.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: reminders } = await supabase
    .from("notifications")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  const tenancyId = tenancy.id;

  const requestStkPush = async (formData: FormData) => {
    "use server";
    const amount = Math.round(Number(formData.get("amount")));
    const phone = String(formData.get("phone") ?? "").trim();

    if (!Number.isFinite(amount) || amount < 1) {
      redirect(`/portal?error=${encodeURIComponent("Enter a valid amount.")}`);
    }
    if (!/^254[17][0-9]{8}$/.test(phone)) {
      redirect(`/portal?error=${encodeURIComponent("Phone must be in 2547XXXXXXXX format.")}`);
    }

    const sb = await createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) redirect("/login");

    const { data, error } = await sb.functions.invoke("mpesa-stk-push", {
      body: {
        tenancyId,
        phone,
        amount,
        idempotencyKey: crypto.randomUUID(),
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      redirect(
        `/portal?error=${encodeURIComponent(
          "Could not send the payment prompt. Please try again shortly."
        )}`
      );
    }

    void data;
    revalidatePath("/portal");
    redirect("/portal?sent=1");
  };

  const createTicket = async (formData: FormData) => {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const priority = String(formData.get("priority") ?? "normal");

    const sb = await createClient();
    const { data: { user: u } } = await sb.auth.getUser();
    if (!u) redirect("/login");

    const { error } = await sb.from("maintenance_requests").insert({
      tenancy_id: tenancyId,
      title,
      description,
      priority,
      created_by: u.id,
    });

    if (error) {
      redirect(`/portal?error=${encodeURIComponent(error.message)}`);
    }
    revalidatePath("/portal");
    redirect("/portal?ticket=1");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {property?.name ?? "Your home"} · Unit {unit?.name ?? ""}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Hello, {(profile?.full_name ?? "there").split(" ")[0]}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Your rent, receipts, and repairs in one place.
        </p>
      </div>

      {/* Reminder — the in-app nudge */}
      {balance > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800"
        >
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <span className="font-semibold tabular-nums">{formatKES(balance)}</span>{" "}
            outstanding on your account. Next rent is due {dueLabel}.
          </div>
        </div>
      )}

      {sent && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm text-primary"
        >
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0" />
          Payment prompt sent. Check your phone and enter your M-Pesa PIN to
          complete the payment.
        </div>
      )}

      {ticket && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm text-primary"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          Maintenance request submitted. Your landlord has been notified.
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Balance hero */}
      <Card className="overflow-hidden rounded-[var(--radius)] border-0 ring-0 bg-foreground text-background shadow-[var(--shadow-elevated)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-background/50">
            {balance > 0 ? "Balance due" : "Account status"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-[32px] leading-none font-bold tracking-tight tabular-nums">
            {balance > 0 ? formatKES(balance) : "All paid up"}
          </div>
          <p className="mt-2.5 text-[13px] text-background/60 tabular-nums">
            Rent {formatKES(rent)} / month · due {dueLabel} · Ref{" "}
            {tenancy.payment_reference}
          </p>
        </CardContent>
      </Card>

      {/* Pay */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Pay with M-Pesa</CardTitle>
          <CardDescription>
            We send a payment prompt straight to your phone — no paybill numbers
            to remember.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={requestStkPush}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="amount" className="text-[13px] font-medium text-foreground">
                Amount (KES)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={balance > 0 ? balance : rent}
                className="h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="phone" className="text-[13px] font-medium text-foreground">
                M-Pesa phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                pattern="254[17][0-9]{8}"
                defaultValue={profile?.phone ?? ""}
                placeholder="2547XXXXXXXX"
                className="h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
            <Button
              type="submit"
              className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Send prompt
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Reminders feed */}
      {(reminders ?? []).length > 0 && (
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recent reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border/40">
              {(reminders ?? []).map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-[14px] font-medium text-foreground">{n.title}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-muted-foreground/70 tabular-nums">
                    {new Date(n.created_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="premium-card overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base font-semibold">Payment history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Receipt
                </TableHead>
                <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="pr-6 text-right h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!payments || payments.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-[13px] text-muted-foreground">
                    Your receipts appear here after your first payment.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6 font-mono text-[13px] font-semibold tracking-tight">
                      {p.provider_transaction_id}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground tabular-nums">
                      {new Date(p.paid_at).toLocaleDateString("en-KE", {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-semibold tabular-nums">
                      {formatKES(Number(p.amount))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Repairs & maintenance</CardTitle>
          <CardDescription>
            Something broken? Report it and track the fix here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(tickets ?? []).length > 0 && (
            <ul className="flex flex-col gap-2">
              {(tickets ?? []).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[14px] font-medium text-foreground">
                      {t.title}
                    </span>
                  </div>
                  {t.status === "pending" && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/25 text-[10px] uppercase tracking-wider font-semibold">
                      Pending
                    </Badge>
                  )}
                  {t.status === "in_progress" && (
                    <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border/60 text-[10px] uppercase tracking-wider font-semibold">
                      In progress
                    </Badge>
                  )}
                  {t.status === "completed" && (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase tracking-wider font-semibold">
                      Completed
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}

          <details className="group rounded-xl border border-border/50">
            <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-medium text-primary">
              Report a new issue
            </summary>
            <form action={createTicket} className="flex flex-col gap-4 border-t border-border/40 p-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="title" className="text-[13px] font-medium text-foreground">
                  What&apos;s the issue?
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="e.g. Kitchen tap leaking"
                  className="h-11 w-full rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="description" className="text-[13px] font-medium text-foreground">
                  Details
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  placeholder="When did it start? How bad is it?"
                  className="w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="priority" className="text-[13px] font-medium text-foreground">
                    Urgency
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue="normal"
                    className="h-11 rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <Button
                  type="submit"
                  className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  Submit request
                </Button>
              </div>
            </form>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
