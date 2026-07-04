import { Wrench, AlertCircle, CheckCircle2, Clock, ArrowRight, History, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const allowedStatusTransitions = new Set(["in_progress", "completed"]);

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: actionError } = await searchParams;
  const supabase = await createClient();

  const { data: tickets, error: ticketsError } = await supabase
    .from('maintenance_requests')
    .select(`
      id,
      title,
      description,
      status,
      priority,
      photo_paths,
      created_at,
      maintenance_status_history (
        status,
        note,
        created_at
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

  const signedPhotoUrls = new Map<string, string>();
  await Promise.all(
    (tickets ?? []).flatMap((ticket) =>
      ticket.photo_paths.map(async (path) => {
        const { data, error } = await supabase.storage
          .from("maintenance-photos")
          .createSignedUrl(path, 900);

        if (!error && data?.signedUrl) signedPhotoUrls.set(path, data.signedUrl);
      }),
    ),
  );

  const updateStatus = async (formData: FormData) => {
    "use server";
    const id = formData.get("id");
    const newStatus = formData.get("status");

    if (typeof id !== "string" || typeof newStatus !== "string" || !allowedStatusTransitions.has(newStatus)) {
      redirect(`/maintenance?error=${encodeURIComponent("Invalid maintenance update.")}`);
    }
    
    const sb = await createClient();
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData.user) redirect("/login");

    const { error } = await sb
      .from('maintenance_requests')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) redirect(`/maintenance?error=${encodeURIComponent(error.message)}`);
    revalidatePath('/maintenance');
  };

  const pendingTickets = (tickets || []).filter(t => t.status === "pending");
  const inProgressTickets = (tickets || []).filter(t => t.status === "in_progress");
  const resolvedTickets = (tickets || []).filter(t => t.status === "completed");

  type Ticket = NonNullable<typeof tickets>[number];

  const renderTicketCard = (ticket: Ticket, nextStatusLabel: string | null, nextStatusValue: string | null) => {
    const tenancy = Array.isArray(ticket.tenancies) ? ticket.tenancies[0] : ticket.tenancies;
    const profile = tenancy?.profiles;
    const unit = tenancy?.units;
    const property = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;

    const timeAgo = Math.floor((new Date().getTime() - new Date(ticket.created_at).getTime()) / (1000 * 3600));
    const timeDisplay = timeAgo < 24 ? `${timeAgo} hours ago` : `${Math.floor(timeAgo / 24)} days ago`;

    return (
      <Card key={ticket.id} className="premium-card mb-3 relative group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <Badge 
              variant="outline" 
              className={`
                ${ticket.priority === 'emergency' || ticket.priority === 'high' ? 'bg-destructive/10 text-destructive border-destructive/20' : ''}
                ${ticket.priority === 'normal' ? 'bg-amber-500/10 text-amber-700 border-amber-500/25' : ''}
                ${ticket.priority === 'low' ? 'bg-secondary text-secondary-foreground border-border/50' : ''}
              `}
            >
              {ticket.priority.toUpperCase()}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground/60">{ticket.id.split('-')[0]}</span>
          </div>
          <h3 className="font-medium text-foreground text-[14px] mb-1">{ticket.title}</h3>
          <p className="mb-2 text-[13px] leading-6 text-muted-foreground">{ticket.description}</p>
          <p className="text-[12px] text-muted-foreground/80 mb-3">{property?.name || "Unknown"} — Unit {unit?.name || "Unknown"}</p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 uppercase tracking-widest font-medium">
            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {timeDisplay}</span>
            <span>{profile?.full_name || "Tenant"}</span>
          </div>
          
          {ticket.photo_paths.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/40 pt-3">
              {ticket.photo_paths.map((path, index) => {
                const url = signedPhotoUrls.get(path);
                return url ? (
                  <a
                    key={path}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-primary hover:border-primary/40 transition-colors shadow-sm"
                  >
                    <Paperclip className="h-3 w-3" /> Photo {index + 1}
                  </a>
                ) : (
                  <span key={path} className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Paperclip className="h-3 w-3" /> Photo unavailable
                  </span>
                );
              })}
            </div>
          )}
          <details className="mt-3 border-t border-border/40 pt-3 group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground">
              <History className="h-3 w-3" /> Status history
            </summary>
            <ol className="mt-2 space-y-2 border-l border-border/60 pl-3">
              {[...ticket.maintenance_status_history]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((entry) => (
                  <li key={`${entry.status}-${entry.created_at}`} className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground uppercase tracking-widest">{entry.status.replace('_', ' ')}</span>
                    {` · ${new Date(entry.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`}
                    {entry.note ? <span className="block mt-1">{entry.note}</span> : null}
                  </li>
                ))}
            </ol>
          </details>

          {nextStatusValue && (
            <form action={updateStatus} className="mt-3 pt-3 border-t border-border/40 flex justify-end">
              <input type="hidden" name="id" value={ticket.id} />
              <input type="hidden" name="status" value={nextStatusValue} />
              <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs text-primary hover:text-primary/90 hover:bg-primary/10">
                Move to {nextStatusLabel} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Maintenance</h1>
        <p className="text-[15px] text-muted-foreground">
          Track and resolve tenant issues efficiently.
        </p>
      </div>

      {(actionError || ticketsError) && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          {actionError || "Maintenance requests could not be loaded. Please retry."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full">
        
        {/* Open Column */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold text-foreground">Pending</h2>
            <Badge className="ml-auto bg-secondary text-muted-foreground hover:bg-secondary border-0">{pendingTickets.length}</Badge>
          </div>
          <div className="bg-secondary/40 rounded-2xl p-3 min-h-[160px] md:min-h-[500px] ring-1 ring-border/50">
            {pendingTickets.map(t => renderTicketCard(t, "In Progress", "in_progress"))}
            {pendingTickets.length === 0 && <p className="text-[13px] text-center text-muted-foreground/60 py-8">No pending tickets</p>}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">In Progress</h2>
            <Badge className="ml-auto bg-secondary text-muted-foreground hover:bg-secondary border-0">{inProgressTickets.length}</Badge>
          </div>
          <div className="bg-secondary/40 rounded-2xl p-3 min-h-[160px] md:min-h-[500px] ring-1 ring-border/50">
            {inProgressTickets.map(t => renderTicketCard(t, "Completed", "completed"))}
            {inProgressTickets.length === 0 && <p className="text-[13px] text-center text-muted-foreground/60 py-8">No tickets in progress</p>}
          </div>
        </div>

        {/* Resolved Column */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Completed</h2>
            <Badge className="ml-auto bg-secondary text-muted-foreground hover:bg-secondary border-0">{resolvedTickets.length}</Badge>
          </div>
          <div className="bg-secondary/40 rounded-2xl p-3 min-h-[160px] md:min-h-[500px] ring-1 ring-border/50">
            {resolvedTickets.map(t => renderTicketCard(t, null, null))}
            {resolvedTickets.length === 0 && <p className="text-[13px] text-center text-muted-foreground/60 py-8">No completed tickets</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
