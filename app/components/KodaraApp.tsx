"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  FileText,
  Gauge,
  Home,
  Landmark,
  Menu,
  MessageSquare,
  Settings,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useKodara } from "@/lib/KodaraContext";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PortfolioWorkspace, type WorkspaceView } from "./PortfolioWorkspace";
import { TenantPortal } from "./TenantPortal";
import { SettingsModal } from "./SettingsModal";

const navigation: Array<{
  id: WorkspaceView;
  label: string;
  icon: typeof Gauge;
}> = [
  { id: "dashboard", label: "Overview", icon: Gauge },
  { id: "properties", label: "Properties", icon: Building2 },
  { id: "tenants", label: "Tenants", icon: Users },
  { id: "payments", label: "Payments", icon: Landmark },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "reports", label: "Reports", icon: Gauge },
];

export function KodaraApp({
  initialRole,
}: {
  initialRole: "landlord" | "property_manager" | "tenant";
}) {
  const {
    currentUser,
    switchToUser,
    usingDemo,
    supabaseConnected,
    messages,
    resetDemo,
  } = useKodara();
  const [effectiveRole, setEffectiveRole] = useState<Role>(initialRole);
  const [view, setView] = useState<WorkspaceView>("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => {
    if (!showSettings && !mobileNav) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowSettings(false);
      setMobileNav(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSettings, mobileNav]);
  const changeRole = (next: Role) => {
    switchToUser(next);
    setEffectiveRole(next);
    const url = new URL(window.location.href);
    url.searchParams.set(
      "role",
      next === "property_manager" ? "manager" : next,
    );
    window.history.replaceState({}, "", url);
    setMobileNav(false);
  };

  if (effectiveRole === "tenant") {
    return <TenantPortal onSwitchRole={() => changeRole("landlord")} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <header className="topbar">
        <div className="flex items-center gap-3">
          <button
            className="icon-button lg:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="brand-mark">
            <Home size={17} />
          </div>
          <div>
            <div className="brand-word">
              kodara<span>.</span>
            </div>
            <div className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Property operations
            </div>
          </div>
        </div>
        <div className="hidden md:flex role-switch" aria-label="Preview role">
          <button
            className={effectiveRole === "landlord" ? "active" : ""}
            onClick={() => changeRole("landlord")}
          >
            Owner
          </button>
          <button
            className={effectiveRole === "property_manager" ? "active" : ""}
            onClick={() => changeRole("property_manager")}
          >
            Manager
          </button>
          <button onClick={() => changeRole("tenant")}>Tenant</button>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "environment-pill",
              !usingDemo && supabaseConnected && "live",
            )}
          >
            <span />
            {!usingDemo && supabaseConnected
              ? "Live workspace"
              : "Alpha preview"}
          </div>
          <button
            className="icon-button relative"
            onClick={() => setView("messages")}
            aria-label="Messages"
          >
            <Bell size={17} />
            {messages.some((item) => !item.read) && (
              <span className="notification-dot" />
            )}
          </button>
          <button
            className="avatar-button"
            onClick={() => setShowSettings(true)}
            aria-label="Open settings"
          >
            {currentUser.full_name
              .split(" ")
              .map((name) => name[0])
              .join("")
              .slice(0, 2)}
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-65px)]">
        <aside className="workspace-sidebar hidden lg:flex">
          <nav className="space-y-1">
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={cn("workspace-nav-item", view === id && "active")}
                onClick={() => setView(id)}
              >
                <Icon size={17} />
                {label}
                {id === "messages" &&
                  messages.filter((item) => !item.read).length > 0 && (
                    <span className="nav-count">
                      {messages.filter((item) => !item.read).length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="mt-auto">
            <button
              className="workspace-nav-item"
              onClick={() => setShowSettings(true)}
            >
              <Settings size={17} />
              Workspace settings
            </button>
            <div className="sidebar-profile">
              <div className="avatar-small">{currentUser.full_name[0]}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {currentUser.full_name}
                </div>
                <div className="truncate text-xs text-white/50">
                  {effectiveRole === "property_manager"
                    ? "Property manager"
                    : "Portfolio owner"}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <PortfolioWorkspace view={view} onNavigate={setView} />
        </main>
      </div>

      {mobileNav && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 lg:hidden"
          onClick={() => setMobileNav(false)}
        >
          <div
            className="h-full w-[290px] bg-[var(--ink)] p-4 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="brand-word text-white">
                kodara<span>.</span>
              </div>
              <button onClick={() => setMobileNav(false)}>
                <X />
              </button>
            </div>
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={cn("workspace-nav-item", view === id && "active")}
                onClick={() => {
                  setView(id);
                  setMobileNav(false);
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
            <div className="mt-6 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-white/5 p-1 text-xs">
              <button
                className="rounded-[var(--radius-sm)] p-2"
                onClick={() => changeRole("landlord")}
              >
                Owner
              </button>
              <button
                className="rounded-[var(--radius-sm)] p-2"
                onClick={() => changeRole("property_manager")}
              >
                Manager
              </button>
              <button
                className="rounded-[var(--radius-sm)] p-2"
                onClick={() => changeRole("tenant")}
              >
                Tenant
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onReset={async () => {
          try {
            await resetDemo();
            toast.success("Alpha data reset");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not reset alpha data. Please try again.",
            );
          }
        }}
      />
    </div>
  );
}
