"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import {
  Building2,
  CreditCard,
  Gauge,
  Search,
  Users,
  Wrench,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Create" | "Search";
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

const STATIC_COMMANDS: Command[] = [
  { id: "dashboard", label: "Dashboard", group: "Navigate", icon: Gauge, href: "/dashboard" },
  { id: "properties", label: "Properties", group: "Navigate", icon: Building2, href: "/properties" },
  { id: "tenants", label: "Tenants", group: "Navigate", icon: Users, href: "/tenants" },
  { id: "payments", label: "Payments", group: "Navigate", icon: CreditCard, href: "/payments" },
  {
    id: "unmatched",
    label: "Unmatched payments",
    hint: "Needs manual allocation",
    group: "Navigate",
    icon: CreditCard,
    href: "/payments?filter=unmatched",
  },
  { id: "maintenance", label: "Maintenance", group: "Navigate", icon: Wrench, href: "/maintenance" },
  { id: "add-property", label: "Add a property", group: "Create", icon: Building2, href: "/properties/new" },
  { id: "onboard-tenant", label: "Onboard a tenant", group: "Create", icon: UserPlus, href: "/tenants/new" },
];

/**
 * Global Cmd/Ctrl+K palette. Opens instantly — no enter/exit animation.
 * Command-palette toggle is Emil Kowalski's canonical example of an
 * interaction used too often (100+ times/day) to ever animate.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Adjusting state when a prop/value changes (React-endorsed pattern,
  // done during render rather than in an effect): reset the search box
  // and selection the moment the palette closes.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? STATIC_COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
      : STATIC_COMMANDS;

    if (!q) return matches;

    const searchCommand: Command = {
      id: "search-tenants",
      label: `Search tenants for "${query.trim()}"`,
      group: "Search",
      icon: Search,
      href: `/tenants?q=${encodeURIComponent(query.trim())}`,
    };
    return [...matches, searchCommand];
  }, [query]);

  const runCommand = useCallback(
    (command: Command) => {
      setOpen(false);
      router.push(command.href);
    },
    [router]
  );

  // Same during-render adjustment: re-aim the selection at the top
  // whenever the query text itself changes.
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    setLastQuery(query);
    setActiveIndex(0);
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const command = filtered[activeIndex];
      if (command) runCommand(command);
    }
  };

  const groups: Command["group"][] = ["Navigate", "Create", "Search"];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px]" />
        <Dialog.Popup
          initialFocus={inputRef}
          className="fixed inset-x-0 top-[12vh] z-50 mx-auto flex w-[92vw] max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-float)] outline-none"
        >
          <div className="flex items-center gap-3 border-b border-border/60 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Jump to a page, or search tenants…"
              className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              Esc
            </kbd>
          </div>

          <div className="max-h-[50vh] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                No matches for &quot;{query}&quot;.
              </p>
            ) : (
              groups.map((group) => {
                const items = filtered.filter((c) => c.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group} className="mb-1 last:mb-0">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {group === "Search" ? "Search" : group}
                    </p>
                    {items.map((command) => {
                      const globalIndex = filtered.indexOf(command);
                      const active = globalIndex === activeIndex;
                      return (
                        <button
                          key={command.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          onClick={() => runCommand(command)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors",
                            active
                              ? "bg-secondary text-foreground"
                              : "text-foreground/90"
                          )}
                        >
                          <command.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{command.label}</span>
                          {command.hint && (
                            <span className="shrink-0 text-[12px] text-muted-foreground">
                              {command.hint}
                            </span>
                          )}
                          {active && (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Topbar affordance: opens the palette on click, discoverable via ⌘K hint. */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true })
        )
      }
      className="flex h-9 w-full max-w-sm items-center gap-2 rounded-full border-0 bg-secondary/80 px-3 text-[14px] text-muted-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 ease-[var(--ease-out)] hover:bg-secondary focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Search or jump to…</span>
      <kbd className="hidden shrink-0 rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}
