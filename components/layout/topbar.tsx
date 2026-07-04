"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/sidebar";
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

export function Topbar({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string | null;
  phone: string | null;
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
        <form action="/tenants" className="relative w-full max-w-sm hidden sm:flex">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="Search tenants, units, phones..."
            className="flex h-9 w-full rounded-full border-0 bg-secondary/80 px-3 py-1 text-[14px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 ease-[var(--ease-out)] placeholder:text-muted-foreground focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 pl-9"
          />
        </form>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-secondary/50">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
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
