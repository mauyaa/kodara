"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function NotificationsDropdown({
  userId,
  initialNotifications,
}: {
  userId: string;
  initialNotifications: Notification[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
      <DropdownMenuTrigger className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary/50">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-primary" />
        )}
        <span className="sr-only">Notifications</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-2 py-6 text-center text-[13px] text-muted-foreground">
            Nothing yet. You&apos;ll see payments, messages, and maintenance updates here.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex-col items-start gap-0.5 py-2.5">
                <span className="text-[13px] font-medium text-foreground">{n.title}</span>
                <span className="text-[12px] text-muted-foreground line-clamp-2">{n.body}</span>
                <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                  {new Date(n.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
