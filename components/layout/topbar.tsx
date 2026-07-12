"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/sidebar";
import { CommandPaletteTrigger } from "@/components/command/command-palette";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationsDropdown } from "@/components/layout/notifications-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { logout } from "@/app/(auth)/actions";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

type TopbarNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function Topbar({
  fullName,
  email,
  phone,
  userId,
  initialNotifications,
}: {
  fullName: string;
  email: string | null;
  phone: string | null;
  userId: string;
  initialNotifications: TopbarNotification[];
}) {
  return (
    <header className="bg-background/40 backdrop-blur-3xl supports-[backdrop-filter]:bg-background/40 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 sm:px-6 border-b border-border/40">
      <div className="flex flex-1 items-center gap-2">
        <MobileNav />
        <Link
          href="/dashboard"
          className="text-foreground lg:hidden"
          aria-label="Kodara dashboard"
        >
          <LogoMark className="h-6 w-6" />
        </Link>
        <div className="hidden w-full max-w-sm sm:flex">
          <CommandPaletteTrigger />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeToggle />
        <NotificationsDropdown userId={userId} initialNotifications={initialNotifications} />
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-8 w-8 rounded-full outline-none hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.97]">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">{initials(fullName)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{fullName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{email ?? phone ?? ""}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
              onClick={() => logout()}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
