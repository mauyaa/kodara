import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function MessagesPage() {
  const supabase = await createClient();

  const { data: tenancies } = await supabase
    .from("tenancies")
    .select(
      `
      id,
      status,
      profiles ( full_name, phone ),
      units ( name, properties ( name ) )
    `,
    )
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: false });

  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, tenancy_id, messages ( body, sender_id, read_at, created_at )");

  const threadByTenancy = new Map(
    (threads ?? []).map((thread) => [thread.tenancy_id, thread]),
  );

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Messages</h1>
        <p className="text-[15px] text-muted-foreground">
          Direct conversations with your tenants, per tenancy.
        </p>
      </div>

      <Card className="premium-card overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-base font-semibold">Conversations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(!tenancies || tenancies.length === 0) ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              Conversations appear here once you have an active tenant.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {tenancies.map((tenancy) => {
                const profile = tenancy.profiles;
                const unit = tenancy.units;
                const property = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;
                const thread = threadByTenancy.get(tenancy.id);
                const messages = thread?.messages ?? [];
                const lastMessage = messages[messages.length - 1];
                const unreadCount = messages.filter(
                  (m) => !m.read_at && m.sender_id !== user?.id,
                ).length;

                return (
                  <Link
                    key={tenancy.id}
                    href={`/messages/${tenancy.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-secondary/20 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-[14px] text-foreground">
                        {profile?.full_name || "Pending Onboarding"}
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">
                        {property?.name ? `${property.name} · Unit ${unit?.name}` : "—"}
                      </div>
                      {lastMessage && (
                        <div className="text-[12px] text-muted-foreground mt-1 truncate max-w-md">
                          {lastMessage.body}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {unreadCount > 0 && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold">
                          {unreadCount} new
                        </Badge>
                      )}
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
