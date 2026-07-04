"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Gauge,
  Users,
  Wrench,
  CreditCard,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Gauge },
  { name: "Properties", href: "/properties", icon: Building2 },
  { name: "Tenants", href: "/tenants", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Maintenance", href: "/maintenance", icon: Wrench },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1 px-3">
      {navigation.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-all duration-200 ease-[var(--ease-out)] active:scale-[0.97]",
              isActive
                ? "bg-background shadow-sm ring-1 ring-border text-primary"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground/70"
              )}
            />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex h-dvh w-60 shrink-0 flex-col border-r border-border/40 bg-background/40 backdrop-blur-3xl supports-[backdrop-filter]:bg-background/40">
      <div className="flex h-14 items-center border-b border-border/40 px-5">
        <Link
          href="/dashboard"
          className="text-foreground transition-opacity hover:opacity-80"
        >
          <Logo markClassName="h-6 w-6" wordmarkClassName="text-[17px]" />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-5 pt-8">
        <NavLinks />
      </div>
    </aside>
  );
}

const subscribeNoop = () => () => {};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The glass topbar's backdrop-filter creates a containing block that would
  // trap position:fixed children, so the overlay must portal to <body>.
  const overlay = (
    <div className="lg:hidden">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/25 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background/80 backdrop-blur-3xl shadow-float transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] border-r border-border/50",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/40 pl-5 pr-3">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="text-foreground"
          >
            <Logo markClassName="h-6 w-6" wordmarkClassName="text-[17px]" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-secondary/50"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-5 pt-8">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-foreground/70 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      {mounted ? createPortal(overlay, document.body) : null}
    </>
  );
}
