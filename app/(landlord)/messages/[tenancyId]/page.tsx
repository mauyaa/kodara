import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ tenancyId: string }>;
}) {
  const { tenancyId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("id, profiles ( full_name ), units ( name, properties ( name ) )")
    .eq("id", tenancyId)
    .single();

  if (!tenancy) redirect("/messages");

  const profile = tenancy.profiles;
  const unit = tenancy.units;
  const property = unit && Array.isArray(unit.properties) ? unit.properties[0] : unit?.properties;

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("tenancy_id", tenancyId)
    .maybeSingle();

  const { data: messages } = thread
    ? await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  if (thread) {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", thread.id)
      .neq("sender_id", user.id)
      .is("read_at", null);
  }

  const sendMessage = async (formData: FormData) => {
    "use server";
    const body = (formData.get("body") as string)?.trim();
    if (!body) return;
    const supabase = await createClient();
    await supabase.rpc("send_message", { target_tenancy_id: tenancyId, message_body: body });
    redirect(`/messages/${tenancyId}`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/messages">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {profile?.full_name || "Tenant"}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {property?.name ? `${property.name} · Unit ${unit?.name}` : ""}
          </p>
        </div>
      </div>

      <Card className="premium-card">
        <CardHeader className="border-b border-border/40 pb-3">
          <CardTitle className="text-base font-semibold">Conversation</CardTitle>
          <CardDescription>Visible to you and this tenant only.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-5">
          {(!messages || messages.length === 0) ? (
            <p className="text-center text-[13px] text-muted-foreground py-8">
              No messages yet. Say hello.
            </p>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === user.id;
              return (
                <div
                  key={message.id}
                  className={cn("flex flex-col max-w-[75%]", isMine ? "self-end items-end" : "self-start items-start")}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-[14px]",
                      isMine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                    )}
                  >
                    {message.body}
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(message.created_at).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              );
            })
          )}

          <form action={sendMessage} className="mt-4 flex items-center gap-2 border-t border-border/40 pt-4">
            <input
              name="body"
              required
              maxLength={2000}
              placeholder="Write a message…"
              className="h-11 flex-1 rounded-xl border border-border/50 bg-secondary/30 px-3 text-[14px] outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            />
            <Button type="submit" className="h-11 px-5">
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
