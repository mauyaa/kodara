import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { RealtimeListener } from "@/components/realtime-listener";
import { CommandPalette } from "@/components/command/command-palette";
import { createClient } from "@/lib/supabase/server";

export default async function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let fullName = "Account";
  let phone: string | null = null;
  let initialNotifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    read_at: string | null;
    created_at: string;
  }> = [];
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "tenant") redirect("/portal");
    fullName = profile?.full_name ?? "Account";
    phone = profile?.phone ?? null;

    const { data: notifications } = await supabase
      .from("notifications")
      .select("id, type, title, body, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    initialNotifications = notifications ?? [];
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <RealtimeListener />
      <CommandPalette />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          fullName={fullName}
          email={user?.email ?? null}
          phone={phone}
          userId={user?.id ?? ""}
          initialNotifications={initialNotifications}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
