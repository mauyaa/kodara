import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoutMenuItem } from "@/components/layout/logout-menu-item";
import { ThemeToggle } from "@/components/theme/theme-toggle";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "tenant") redirect("/dashboard");

  const fullName = profile?.full_name ?? "Account";

  return (
    <div className="min-h-dvh bg-background">
      <header className="glass-panel sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/portal" className="text-foreground">
          <Logo markClassName="h-6 w-6" wordmarkClassName="text-[17px]" />
        </Link>
        <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full outline-none hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200 ease-[var(--ease-out)]">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                {initials(fullName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{fullName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email ?? profile?.phone ?? ""}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <LogoutMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
