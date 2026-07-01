"use client";

import {
  CheckCircle2,
  Database,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { useKodara } from "@/lib/KodaraContext";
import { Button } from "./ui/Button";

export function SettingsModal({
  isOpen,
  onClose,
  onReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => Promise<void>;
}) {
  const { supabaseConnected, usingDemo } = useKodara();
  if (!isOpen) return null;

  const items = [
    {
      icon: Database,
      label: "Supabase database",
      ready: supabaseConnected && !usingDemo,
      detail: supabaseConnected
        ? usingDemo
          ? "Connected; production schema or authenticated session is pending"
          : "Connected and serving live workspace data"
        : "Configure server environment variables",
    },
    {
      icon: Smartphone,
      label: "M-Pesa Daraja",
      ready: false,
      detail:
        "Requires production shortcode, passkey, callback URL, and Safaricom approval",
    },
    {
      icon: ShieldCheck,
      label: "Role-based access",
      ready: !usingDemo,
      detail: usingDemo
        ? "Alpha preview uses local role simulation"
        : "Enforced by Supabase Auth and RLS",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius-xl)] border bg-white shadow-[var(--shadow-modal)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="readiness-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center gap-3">
            <div className="property-icon">
              <KeyRound size={19} />
            </div>
            <div>
              <h2 id="readiness-title">Workspace readiness</h2>
              <p className="text-sm text-muted">
                Production connections are configured on the server.
              </p>
            </div>
          </div>
          <button
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-6">
          {items.map(({ icon: Icon, label, ready, detail }) => (
            <div key={label} className="flex gap-3 rounded-[var(--radius-lg)] border p-4">
              <div
                className={ready ? "readiness-icon ready" : "readiness-icon"}
              >
                {ready ? <CheckCircle2 size={18} /> : <Icon size={18} />}
              </div>
              <div>
                <div className="font-semibold">{label}</div>
                <div className="mt-0.5 text-sm text-muted">{detail}</div>
              </div>
            </div>
          ))}
          <div className="rounded-[var(--radius-lg)] bg-[var(--warning-tint)] p-4 text-sm text-[var(--warning-text)]">
            <strong>Security rule:</strong> service-role and M-Pesa secrets are
            never collected or stored in the browser. Add them through the
            deployment environment described in <code>docs/FINAL_SETUP.md</code>
            .
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t bg-[var(--bg)] p-6 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={onReset}>
            <RotateCcw size={15} />
            Reset alpha data
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
